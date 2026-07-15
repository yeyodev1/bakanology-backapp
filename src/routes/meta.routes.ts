import { Router } from "express";
import { trackBrowserEvent } from "../controllers/meta.controller";

const router = Router();

router.post("/events", trackBrowserEvent);

export default router;
