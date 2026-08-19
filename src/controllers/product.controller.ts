import { NextFunction, Request, Response } from "express";
import axios from "axios";
import { CustomError } from "../errors/customError.error";
import { successResponse } from "../helpers/response.helper";
import * as productService from "../services/product.service";
import { AuthRequest } from "../types/AuthRequest";

export async function createSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { product, email, name, lastName, origin } = req.body;
    if (!product || !email || !name || !lastName) {
      throw new CustomError("Incomplete data", 400);
    }
    const result = await productService.createProductCheckoutSession({
      product,
      email,
      name,
      lastName,
      origin,
    });
    successResponse(res, result, "Product checkout session created successfully");
  } catch (error) {
    next(error);
  }
}

export async function purchased(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);
    const result = await productService.getPurchasedProducts(req.user.userId);
    successResponse(res, result, "Purchased products retrieved successfully");
  } catch (error) {
    next(error);
  }
}

export async function read(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new CustomError("Unauthorized", 401);
    const url = await productService.getOwnedProductReaderUrl(req.user.userId, req.params.slug);
    const asset = await axios.get<NodeJS.ReadableStream>(url, {
      responseType: "stream",
      timeout: 15_000,
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    asset.data.pipe(res);
  } catch (error) {
    next(error);
  }
}
