import { Router } from "express";
import { createReminder } from "../controllers/launchReminder.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", authMiddleware, createReminder);

export default router;
