import express, { Router } from "express";
import * as stripeController from "../controllers/stripe.controller";

const router = Router();

router.post("/create-session", stripeController.createSession);
router.get("/verify/:sessionId", stripeController.verifyPayment);
router.post("/resend-email", stripeController.resendEmail);
router.post("/webhook", express.raw({ type: "application/json" }), stripeController.handleWebhook);

export default router;
