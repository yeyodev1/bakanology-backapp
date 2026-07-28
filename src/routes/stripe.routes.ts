import { Router } from "express";
import * as stripeController from "../controllers/stripe.controller";
import * as productController from "../controllers/product.controller";

const router = Router();

router.post("/create-session", stripeController.createSession);
router.post("/funnel/create-session", stripeController.createFunnelSession);
router.post("/products/create-session", productController.createSession);
router.get("/verify/:sessionId", stripeController.verifyPayment);
router.post("/resend-email", stripeController.resendEmail);
router.post("/webhook", stripeController.handleWebhook);

export default router;
