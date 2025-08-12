import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express, {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import "./database/init_mongodb.js";
import routes from "./routes/routes.js";
import { CustomError } from "./types/index.js";
import { logger } from "./utils/logger.js";
import { initializeQueues, shutdownQueues } from "./queues/index.js";

dotenv.config();

const app = express();
const PORT: number = parseInt(process.env.PORT || "3000", 10);

app.use(helmet());
app.use(cors());
app.use(compression());

app.use(morgan("combined"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "DeepResearch Node.js Backend API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      research: "/api/research",
    },
  });
});

const errorHandler: ErrorRequestHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(err.status || 500);

  const errorResponse = {
    error: {
      status: err.status || 500,
      ...err,
      message: err.message,
    },
  };
  logger.error(err.stack || err.message);
  res.send(errorResponse);
};

app.use(errorHandler);

process.on("unhandledRejection", (err: Error) => {
  console.log(`Error: ${err.message}`);
  process.exit(1);
});

const server = app.listen(PORT, async () => {
  console.log(`🚀 DeepResearch Node.js Backend running on port ${PORT}`);
  
  // Initialize Bull MQ queues and workers
  try {
    await initializeQueues();
    console.log("✅ Bull MQ queues and workers initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize Bull MQ queues:", error);
    logger.error("Queue initialization failed", error);
  }
});

process.on("SIGINT", () => {
  logger.info("SIGINT Received");
  server.close(async () => {
    try {
      await shutdownQueues();
      console.log("✅ Bull MQ queues shut down gracefully");
    } catch (error) {
      console.error("❌ Error shutting down queues:", error);
    }
    
    mongoose.connection.close().then(() => {
      process.exit(0);
    });
    logger.info("Server Closed ....");
  });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM Received");
  server.close(async () => {
    try {
      await shutdownQueues();
      console.log("✅ Bull MQ queues shut down gracefully");
    } catch (error) {
      console.error("❌ Error shutting down queues:", error);
    }
    
    mongoose.connection.close().then(() => {
      process.exit(0);
    });
    logger.info("Server Closed ....");
  });
});

export default app;
