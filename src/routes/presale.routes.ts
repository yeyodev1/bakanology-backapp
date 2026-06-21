import { Router } from "express";
import * as presaleController from "../controllers/presale.controller";

const router = Router();

router.get("/status", presaleController.getStatus);

export default router;
