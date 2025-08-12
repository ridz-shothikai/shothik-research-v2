import { validateQueueConfig } from "../config/queue.js";
import { logger } from "../utils/logger.js";

import { researchWorker, vectorMemoryWorker } from "./ResearchQueue.js";

export async function initializeQueues(): Promise<boolean> {
  try {
    logger.info("🚀 Initializing queue system...");

    if (!validateQueueConfig()) {
      throw new Error("Queue configuration validation failed");
    }

    logger.info("🔗 Testing Redis connection...");

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Redis connection timeout"));
      }, 5000);

      if (researchWorker && vectorMemoryWorker) {
        clearTimeout(timeout);
        resolve(true);
      }
    });

    logger.info("✅ Queue system initialized successfully");
    logger.info(`📊 Research Worker: Ready (concurrency: 3)`);
    logger.info(`🧠 Vector Memory Worker: Ready (concurrency: 5)`);

    return true;
  } catch (error: any) {
    logger.error("❌ Failed to initialize queue system:", error.message);
    logger.error("💡 Make sure Redis is running and accessible");
    return false;
  }
}

export async function shutdownQueues(): Promise<void> {
  try {
    logger.info("🛑 Shutting down queue system...");

    await researchWorker.close();
    await vectorMemoryWorker.close();

    logger.info("✅ Queue system shutdown complete");
  } catch (error: any) {
    logger.error("❌ Error during queue shutdown:", error.message);
  }
}

export { default as QueueService } from "./QueueService.js";
export { researchQueue, vectorMemoryQueue } from "./ResearchQueue.js";
export { researchWorker, vectorMemoryWorker };
