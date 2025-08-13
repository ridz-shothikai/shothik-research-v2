import { Job, QueueEvents } from "bullmq";
import { IResearchResult } from "../modules/research/Research.interface.js";
import { logger } from "../utils/logger.js";
import { ResearchJobData, VectorMemoryJobData } from "./Queue.interface.js";
import { researchQueue, vectorMemoryQueue } from "./ResearchQueue.js";

export class QueueService {
  static async addResearchJob(
    body: Partial<IResearchResult>,
    connectionId: string,
    userId?: string,
    priority?: number
  ): Promise<Job<ResearchJobData>> {
    const jobData: ResearchJobData = {
      body,
      connectionId,
      userId,
    };

    const job = await researchQueue.add("process-research", jobData, {
      priority: priority || 0,
      delay: 0,
      jobId: `research-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
    });

    logger.info(
      `📋 Added research job ${job.id} to queue for connection ${connectionId}`
    );
    return job;
  }

  static async getResearchJobStatus(jobId: string) {
    const job = await Job.fromId(researchQueue, jobId);

    if (!job) {
      return { status: "not_found", error: "Job not found" };
    }

    const state = await job.getState();
    const progress = job.progress;
    const logs: string[] = [];

    return {
      id: job.id,
      status: state,
      progress,
      logs,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  static async addVectorMemoryJob(
    type: "store" | "find-similar" | "get-history",
    data: any,
    researchId?: string
  ): Promise<Job<VectorMemoryJobData>> {
    const jobData: VectorMemoryJobData = {
      type,
      data,
      researchId,
    };

    const job = await vectorMemoryQueue.add(`vector-${type}`, jobData, {
      delay: type === "store" ? 1000 : 0,
    });

    logger.info(`🧠 Added vector memory job ${job.id} (${type}) to queue`);
    return job;
  }

  static async waitForVectorMemoryJob(
    job: Job<VectorMemoryJobData>,
    timeoutMs: number = 30000
  ) {
    try {
      const queueEvents = new QueueEvents(vectorMemoryQueue.name, {
        connection: vectorMemoryQueue.opts.connection,
      });
      const result = await job.waitUntilFinished(queueEvents, timeoutMs);
      await queueEvents.close();
      return result;
    } catch (error: any) {
      logger.error(
        `⏰ Vector memory job ${job.id} timed out or failed:`,
        error
      );
      throw error;
    }
  }

  static async getQueueStats() {
    const researchStats = await researchQueue.getJobCounts();
    const vectorStats = await vectorMemoryQueue.getJobCounts();

    return {
      research: {
        waiting: researchStats.waiting,
        active: researchStats.active,
        completed: researchStats.completed,
        failed: researchStats.failed,
        delayed: researchStats.delayed,
      },
      vectorMemory: {
        waiting: vectorStats.waiting,
        active: vectorStats.active,
        completed: vectorStats.completed,
        failed: vectorStats.failed,
        delayed: vectorStats.delayed,
      },
    };
  }

  static async cancelResearchJob(jobId: string): Promise<boolean> {
    try {
      const job = await Job.fromId(researchQueue, jobId);
      if (job) {
        await job.remove();
        logger.info(`🚫 Cancelled research job ${jobId}`);
        return true;
      }
      return false;
    } catch (error: any) {
      logger.error(`❌ Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  static async retryResearchJob(jobId: string): Promise<boolean> {
    try {
      const job = await Job.fromId(researchQueue, jobId);
      if (job) {
        await job.retry();
        logger.info(`🔄 Retrying research job ${jobId}`);
        return true;
      }
      return false;
    } catch (error: any) {
      logger.error(`❌ Failed to retry job ${jobId}:`, error);
      return false;
    }
  }
}

export default QueueService;
