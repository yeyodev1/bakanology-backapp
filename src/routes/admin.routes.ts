import { Router } from "express";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { upload } from "../middlewares/upload.middleware";
import * as adminController from "../controllers/admin.controller";
import * as manualPaymentController from "../controllers/manualPayment.controller";
import { otorgarAccesoCliente } from "../controllers/accesoBakano.controller";
import * as academyController from "../controllers/adminAcademy.controller";

const router = Router();

// Servidor a servidor desde Metrics: valida su propia clave, no JWT.
router.post("/acceso-cliente", otorgarAccesoCliente);

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

router.get("/comments", adminMiddleware, academyController.listComments);
router.put(
  "/comments/:id/status",
  adminMiddleware,
  academyController.moderateComment,
);
router.delete("/comments/:id", adminMiddleware, academyController.deleteComment);

export default router;
