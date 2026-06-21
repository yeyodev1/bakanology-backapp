import { Router } from "express";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { upload } from "../middlewares/upload.middleware";
import * as adminController from "../controllers/admin.controller";
import * as manualPaymentController from "../controllers/manualPayment.controller";

const router = Router();

router.get("/users", adminMiddleware, adminController.listUsers);
router.post("/users", adminMiddleware, adminController.createUser);
router.delete("/users/:id", adminMiddleware, adminController.deleteUser);
router.put("/users/:id/access", adminMiddleware, adminController.updateAccess);
router.put("/users/:id/founding-member", adminMiddleware, adminController.setFoundingMember);

router.get("/payments", adminMiddleware, manualPaymentController.list);
router.post(
  "/payments",
  adminMiddleware,
  upload.single("receipt"),
  manualPaymentController.create,
);
router.delete(
  "/payments/:id",
  adminMiddleware,
  manualPaymentController.remove,
);

export default router;
