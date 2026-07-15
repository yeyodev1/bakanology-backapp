import express from "express";
import cors from "cors";
import http from "http";
import routerApi from "./routes";
import { globalErrorHandler } from "./middlewares/globalErrorHandler.middleware";

const whitelist = [
  "http://localhost:8101",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://localhost:8101",
  "https://testing-storybrand-frontend.bakano.ec",
  "https://bakanology-funnel.vercel.app",
  "https://bakanology-funnel.netlify.app",
  "https://academy.bakano.ec",
  "https://bakanology.bakano.ec",
  "https://bakanology.com",
  "https://www.bakanology.com",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

export function createApp() {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json({
    limit: "50mb",
    verify: (req, _res, buffer) => {
      if (req.url?.startsWith("/api/stripe/webhook")) {
        (req as typeof req & { rawBody?: Buffer }).rawBody = buffer;
      }
    },
  }));

  app.get("/", (_req, res) => {
    res.send("Server is alive");
  });

  routerApi(app);

  app.use(globalErrorHandler);

  const server = http.createServer(app);

  return { app, server };
}
