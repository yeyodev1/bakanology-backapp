import { Router } from "express";
import * as stripeController from "../controllers/stripe.controller";

const router = Router();

router.post("/create-session", stripeController.createSession);
router.post("/funnel/create-session", stripeController.createFunnelSession);
router.get("/verify/:sessionId", stripeController.verifyPayment);
router.post("/resend-email", stripeController.resendEmail);
router.post("/webhook", stripeController.handleWebhook);

export default router;
