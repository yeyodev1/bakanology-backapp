import express, { Application } from "express";
import authRouter from "./auth.routes";
import paymentRouter from "./payment.routes";
import presaleRouter from "./presale.routes";
import adminRouter from "./admin.routes";
import launchReminderRouter from "./launchReminder.routes";

function routerApi(app: Application) {
  const router = express.Router();
  app.use("/api", router);

  router.use("/auth", authRouter);
  router.use("/payments", paymentRouter);
  router.use("/presale", presaleRouter);
  router.use("/admin", adminRouter);
  router.use("/launch-reminders", launchReminderRouter);
}

export default routerApi;
