import * as dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { identify, prisma } from "./identityService";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    service: "Bitespeed Identity Reconciliation",
    version: "1.0.0",
    status: "operational",
    endpoints: {
      identify: "POST /identify",
      health: "GET /health",
    },
  });
});

app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({ status: "unhealthy", database: "disconnected" });
  }
});

app.post("/identify", async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body;

    if (
      (email === undefined || email === null) &&
      (phoneNumber === undefined || phoneNumber === null)
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: "At least one of 'email' or 'phoneNumber' must be provided",
      });
    }

    if (email !== null && email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof email !== "string" || !emailRegex.test(email)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Invalid email format",
        });
      }
    }

    const normalizedPhone =
      phoneNumber !== null && phoneNumber !== undefined
        ? String(phoneNumber)
        : null;

    const result = await identify({
      email: email ?? null,
      phoneNumber: normalizedPhone,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in /identify:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: "Route does not exist",
  });
});

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 POST /identify ready`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

bootstrap();

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});