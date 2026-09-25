import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { User } from "../models/User";
import { hashPassword } from "../helpers/password.helper";
import { sendBakanoClientAccessEmail } from "../helpers/email.helper";
import { successResponse } from "../helpers/response.helper";
import { CustomError } from "../errors/customError.error";

/**
 * Acceso a la academia para un cliente de Bakano.
 *
 * Lo llama Metrics cuando se suma a alguien a un entorno: el cliente contrata
 * y desde ese mismo momento tiene la academia, sin que nadie tenga que
 * acordarse de darle el acceso a mano.
 *
 * Es servidor a servidor, asi que no va por JWT: se valida una clave
 * compartida. Si ya tiene cuenta, se le extiende el acceso en vez de crear
 * otra.
 */
const MESES_POR_DEFECTO = 12;

function sumarMeses(fecha: Date, meses: number): Date {
  const r = new Date(fecha);
  r.setMonth(r.getMonth() + meses);
  return r;
}

export async function otorgarAccesoCliente(req: Request, res: Response, next: NextFunction) {
  try {
    const clave = process.env.BAKANO_METRICS_KEY;
    if (!clave || req.headers["x-bakano-key"] !== clave) {
      throw new CustomError("No autorizado", 401);
    }

    const { email, name, lastName, months } = req.body as {
      email?: string;
      name?: string;
      lastName?: string;
      months?: number;
    };
    const correo = String(email || "").toLowerCase().trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw new CustomError("Correo inválido", 400);

    const meses = Number(months) > 0 ? Number(months) : MESES_POR_DEFECTO;
    const accessUntil = sumarMeses(new Date(), meses);
    const frontendUrl = (process.env.FRONTEND_URL || "").replace(/\/$/, "");

    const existente = await User.findOne({ email: correo });

    // A un admin no se le toca la cuenta.
    if (existente?.role === "admin") {
      successResponse(res, { email: correo, accion: "omitido" }, "Es admin: no se modifica");
      return;
    }

    let password: string | null = null;
    if (existente) {
      if (!existente.accessUntil || existente.accessUntil < accessUntil) {
        existente.accessUntil = accessUntil;
      }
      existente.subscriptionStatus = "active";
      existente.isVerified = true;
      await existente.save();
    } else {
      password = crypto.randomBytes(9).toString("base64url");
      await User.create({
        name: name || correo.split("@")[0],
        lastName: lastName || "-",
        email: correo,
        password: await hashPassword(password),
        role: "user",
        isVerified: true,
        subscriptionStatus: "active",
        accessUntil,
      });
    }

    await sendBakanoClientAccessEmail(
      correo,
      name || "cliente Bakano",
      password,
      `${frontendUrl}/login`,
      `${frontendUrl}/recuperar-contrasena`,
    );

    successResponse(
      res,
      { email: correo, accion: existente ? "extendido" : "creado", accessUntil },
      "Acceso otorgado",
    );
  } catch (error) {
    next(error);
  }
}
