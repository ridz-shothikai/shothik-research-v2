import dotenv from "dotenv";
import { logger } from "../utils/logger.js";
dotenv.config();

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
    lazyConnect: boolean;
  };
  research: {
    concurrency: number;
    maxJobs: number;
    jobTimeout: number;
    attempts: number;
    backoffDelay: number;
  };
  vectorMemory: {
    concurrency: number;
    maxJobs: number;
    jobTimeout: number;
    attempts: number;
    backoffDelay: number;
  };
}

export const queueConfig: QueueConfig = {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true,
  },
  research: {
    concurrency: parseInt(process.env.RESEARCH_QUEUE_CONCURRENCY || "3"),
    maxJobs: parseInt(process.env.RESEARCH_QUEUE_MAX_JOBS || "5"),
    jobTimeout: parseInt(process.env.RESEARCH_JOB_TIMEOUT || "1800000"),
    attempts: parseInt(process.env.RESEARCH_JOB_ATTEMPTS || "3"),
    backoffDelay: parseInt(process.env.RESEARCH_BACKOFF_DELAY || "2000"),
  },
  vectorMemory: {
    concurrency: parseInt(process.env.VECTOR_QUEUE_CONCURRENCY || "5"),
    maxJobs: parseInt(process.env.VECTOR_QUEUE_MAX_JOBS || "10"),
    jobTimeout: parseInt(process.env.VECTOR_JOB_TIMEOUT || "30000"),
    attempts: parseInt(process.env.VECTOR_JOB_ATTEMPTS || "5"),
    backoffDelay: parseInt(process.env.VECTOR_BACKOFF_DELAY || "1000"),
  },
};

export function validateQueueConfig(): boolean {
  try {
    if (!queueConfig.redis.host) {
      throw new Error("Redis host is required");
    }

    if (queueConfig.redis.port < 1 || queueConfig.redis.port > 65535) {
      throw new Error("Invalid Redis port");
    }

    if (queueConfig.research.concurrency < 1) {
      throw new Error("Research queue concurrency must be at least 1");
    }

    if (queueConfig.vectorMemory.concurrency < 1) {
      throw new Error("Vector memory queue concurrency must be at least 1");
    }

    logger.info("✅ Queue configuration validated successfully");
    return true;
  } catch (error: any) {
    logger.error("❌ Queue configuration validation failed:", error.message);
    return false;
  }
}

export default queueConfig;
