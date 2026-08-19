import { Router } from "express";
import * as productController from "../controllers/product.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/purchased", authMiddleware, productController.purchased);
router.get("/:slug/read", authMiddleware, productController.read);

export default router;
