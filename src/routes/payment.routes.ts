import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import * as paymentController from "../controllers/payment.controller";
import * as manualPaymentController from "../controllers/manualPayment.controller";

const router = Router();

router.get("/history", authMiddleware, paymentController.history);
router.post("/cancel-pending", authMiddleware, paymentController.cancelPending);
router.post("/cancel-subscription", authMiddleware, paymentController.cancelSubscription);
router.get("/history-manual", authMiddleware, manualPaymentController.history);

export default router;
