import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";
import * as authController from "../controllers/auth.controller";

const router = Router();

router.post("/register", authController.register);
router.get("/verify", authController.verifyEmail);
router.post("/login", authController.login);
router.get("/me", authMiddleware, authController.getMe);
router.put("/profile", authMiddleware, authController.updateProfile);
router.put(
  "/profile-picture",
  authMiddleware,
  upload.single("image"),
  authController.uploadProfilePicture,
);
router.put("/change-password", authMiddleware, authController.changePassword);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

export default router;
