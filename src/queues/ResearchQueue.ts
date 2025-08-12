import { Job, Queue, Worker } from "bullmq";
import dotenv from "dotenv";
import { Redis } from "ioredis";
import ResearchService from "../modules/research/Research.service.js";
import { logger } from "../utils/logger.js";
import { ResearchJobData, VectorMemoryJobData } from "./Queue.interface.js";
dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  lazyConnect: true,
};

const connection = new Redis(redisConfig);

export const researchQueue = new Queue("research-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 10,
    removeOnFail: 5,
  },
});

export const vectorMemoryQueue = new Queue("vector-memory", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 20,
    removeOnFail: 10,
  },
});

const researchWorker = new Worker(
  "research-processing",
  async (job: Job<ResearchJobData>) => {
    const { body, connectionId } = job.data;

    logger.info(
      `🚀 Processing research job ${job.id} for connection ${connectionId}`
    );
    const streamCallback = async (
      step: string,
      data: any,
      researchId: string
    ) => {
      await job.updateProgress({
        step,
        data,
        timestamp: new Date().toISOString(),
        researchId,
      });

      logger.info(`📊 Research ${job.id} - Step: ${step}`);

      await job.log(`Step: ${step} - ${JSON.stringify(data)}`);
    };

    try {
      const result = await ResearchService.CreateWithStreaming(
        body,
        streamCallback
      );

      logger.info(`✅ Research job ${job.id} completed successfully`);
      return result;
    } catch (error: any) {
      logger.error(`❌ Research job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 3,
    limiter: {
      max: 5,
      duration: 60000,
    },
    stalledInterval: 300000,
    maxStalledCount: 1,
  }
);

const vectorMemoryWorker = new Worker(
  "vector-memory",
  async (job: Job<VectorMemoryJobData>) => {
    const { type, data, researchId } = job.data;

    logger.info(`🧠 Processing vector memory job ${job.id} - Type: ${type}`);

    try {
      switch (type) {
        case "store":
          await ResearchService.storeResearchMemory(data);
          break;
        case "find-similar":
          return await ResearchService.findSimilarResearch(
            data.query,
            data.excludeChatId,
            data.limit
          );
        case "get-history":
          return await ResearchService.getResearchHistory(data.chatId);
        default:
          throw new Error(`Unknown vector memory job type: ${type}`);
      }

      logger.info(`✅ Vector memory job ${job.id} completed`);
    } catch (error: any) {
      logger.error(`❌ Vector memory job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60000,
    },
    stalledInterval: 60000,
    maxStalledCount: 2,
  }
);

researchWorker.on("completed", (job) => {
  logger.info(`🎉 Research job ${job.id} completed`);
});

researchWorker.on("failed", (job, err) => {
  logger.error(`💥 Research job ${job?.id} failed:`, err);
});

vectorMemoryWorker.on("completed", (job) => {
  logger.info(`🧠 Vector memory job ${job.id} completed`);
});

vectorMemoryWorker.on("failed", (job, err) => {
  logger.error(`🧠 Vector memory job ${job?.id} failed:`, err);
});

process.on("SIGINT", async () => {
  logger.info("🛑 Shutting down queue workers...");
  await researchWorker.close();
  await vectorMemoryWorker.close();
  await connection.quit();
  process.exit(0);
});

export { researchWorker, vectorMemoryWorker };
