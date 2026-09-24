import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import mongoose from "mongoose";
import { dbConnect } from "../config/mongo";
import { User } from "../models/User";
import { hashPassword } from "../helpers/password.helper";
import { sendBakanoClientAccessEmail } from "../helpers/email.helper";

// Da acceso a Bakanology a los clientes de Bakano y les envía el correo poco a poco.
//
// Uso:
// pnpm ts-node src/scripts/grant-client-access.ts <clientes.csv> [--months=12] [--batch=10] [--delay=120] [--send]
//
// El CSV lleva cabecera: email,name,lastName
// Sin --send solo muestra qué haría (modo prueba). Los correos ya enviados quedan en
// <clientes.csv>.sent.json y no se repiten si el script se vuelve a correr.

type Client = { email: string; name: string; lastName: string };

function readFlag(name: string, fallback: number): number {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  const value = raw ? Number(raw.split("=")[1]) : fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseCsv(filePath: string): Client[] {
  const [header, ...rows] = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const columns = header.split(",").map((column) => column.trim());
  const index = (key: string) => columns.indexOf(key);
  if (index("email") === -1) throw new Error("El CSV necesita una columna email");

  const seen = new Set<string>();
  return rows
    .map((row) => row.split(",").map((cell) => cell.trim()))
    .map((cells) => ({
      email: (cells[index("email")] || "").toLowerCase(),
      name: cells[index("name")] || "",
      lastName: cells[index("lastName")] || "",
    }))
    .filter((client) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(client.email))
    .filter((client) => !seen.has(client.email) && seen.add(client.email));
}

function generatePassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath || csvPath.startsWith("--")) {
    console.error(
      "Uso: pnpm ts-node src/scripts/grant-client-access.ts <clientes.csv> [--months=12] [--batch=10] [--delay=120] [--send]",
    );
    process.exit(1);
  }

  const send = process.argv.includes("--send");
  const months = readFlag("months", 12);
  const batchSize = readFlag("batch", 10);
  const delaySeconds = readFlag("delay", 120);
  const frontendUrl = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  if (!frontendUrl) throw new Error("FRONTEND_URL es requerido");

  const logPath = `${csvPath}.sent.json`;
  const sent: Record<string, string> = fs.existsSync(logPath)
    ? JSON.parse(fs.readFileSync(logPath, "utf8"))
    : {};

  const clients = parseCsv(csvPath).filter((client) => !sent[client.email]);
  const accessUntil = addMonths(new Date(), months);

  await dbConnect();

  console.log(send ? "🚀 MODO ENVÍO" : "🧪 MODO PRUEBA (agrega --send para enviar)");
  console.log(
    `Pendientes: ${clients.length} | acceso: ${months} meses | lotes de ${batchSize} cada ${delaySeconds}s\n`,
  );

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const existing = await User.findOne({ email: client.email });

    if (existing?.role === "admin") {
      console.log(`⏭️  ${client.email} es admin, se omite`);
      continue;
    }

    const action = existing ? "extender acceso" : "crear cuenta";
    console.log(`[${i + 1}/${clients.length}] ${client.email} → ${action}`);
    if (!send) continue;

    try {
      let password: string | null = null;
      if (existing) {
        if (!existing.accessUntil || existing.accessUntil < accessUntil) {
          existing.accessUntil = accessUntil;
        }
        existing.subscriptionStatus = "active";
        existing.isVerified = true;
        await existing.save();
      } else {
        password = generatePassword();
        await User.create({
          name: client.name || client.email.split("@")[0],
          lastName: client.lastName || "-",
          email: client.email,
          password: await hashPassword(password),
          role: "user",
          isVerified: true,
          subscriptionStatus: "active",
          accessUntil,
        });
      }

      await sendBakanoClientAccessEmail(
        client.email,
        client.name || "cliente Bakano",
        password,
        `${frontendUrl}/login`,
        `${frontendUrl}/recuperar-contrasena`,
      );

      sent[client.email] = new Date().toISOString();
      fs.writeFileSync(logPath, JSON.stringify(sent, null, 2));
      console.log("   ✅ enviado");
    } catch (error) {
      console.error(`   ❌ ${(error as Error).message}`);
    }

    const endOfBatch = (i + 1) % batchSize === 0 && i + 1 < clients.length;
    await new Promise((resolve) =>
      setTimeout(resolve, endOfBatch ? delaySeconds * 1000 : 1500),
    );
  }

  console.log(`\n🎉 Listo. Registro de envíos: ${logPath}`);
  await mongoose.connection.close();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
