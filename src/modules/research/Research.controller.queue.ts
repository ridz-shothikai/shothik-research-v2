import { NextFunction, Response } from "express";
import { default as createHttpError } from "http-errors";
import { JoiError } from "../../helpers/error.js";
import { toObjectId } from "../../helpers/toObjectId.js";
import { AuthRequest } from "../../middleware/shared/jwt_helper.js";
import QueueService from "../../queues/QueueService.js";
import { logger } from "../../utils/logger.js";
import Event from "../events/Events.model.js";
import ResearchResultSchema from "./Research.model.js";

export const CreateResearchWithQueue = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const connectionId = `conn_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const job = await QueueService.addResearchJob(
      req.body,
      connectionId,
      (req as any).user?.id
    );

    const initialResponse = {
      step: "queued",
      data: {
        jobId: job.id,
        connectionId,
        title: "Research Queued",
        message: "Your research request has been queued for processing",
        position: (await job.opts.priority) || 0,
      },
      timestamp: new Date().toISOString(),
    };

    res.write(JSON.stringify(initialResponse) + "\n");
    res.flush();

    let lastProgress: any = null;
    let isCompleted = false;

    const pollInterval = setInterval(async () => {
      try {
        const jobStatus = await QueueService.getResearchJobStatus(job.id!);

        if (jobStatus.status === "completed") {
          isCompleted = true;
          clearInterval(pollInterval);
          const finalResponse = {
            step: "completed",
            data: jobStatus.result,
            timestamp: new Date().toISOString(),
          };

          res.write(JSON.stringify(finalResponse) + "\n");
          res.end();
          return;
        }

        if (jobStatus.status === "failed") {
          isCompleted = true;
          clearInterval(pollInterval);

          const errorResponse = {
            step: "error",
            error: jobStatus.failedReason || "Research processing failed",
            timestamp: new Date().toISOString(),
          };

          res.write(JSON.stringify(errorResponse) + "\n");
          res.end();
          return;
        }

        if (
          jobStatus.progress &&
          JSON.stringify(jobStatus.progress) !== JSON.stringify(lastProgress)
        ) {
          lastProgress = jobStatus.progress;

          res.write(JSON.stringify(jobStatus.progress) + "\n");
          res.flush();

          const progress = jobStatus.progress as any;
          if (progress.researchId && progress.researchId !== "unknown") {
            Event.create({
              research: progress.researchId,
              step: progress.step,
              data: progress.data,
              timestamp: progress.timestamp,
            }).catch((err) => {
              logger.error("Failed to save event:", err);
            });
          }
        }
      } catch (error) {
        logger.error("Error polling job status:", error);
        if (!isCompleted) {
          clearInterval(pollInterval);
          const errorResponse = {
            step: "error",
            error: "Failed to monitor research progress",
            timestamp: new Date().toISOString(),
          };
          res.write(JSON.stringify(errorResponse) + "\n");
          res.end();
        }
      }
    }, 1000);

    req.on("close", () => {
      logger.info(`🔌 Client disconnected for job ${job.id}`);
      clearInterval(pollInterval);
      if (!isCompleted) {
      }
    });

    setTimeout(() => {
      if (!isCompleted) {
        clearInterval(pollInterval);
        const timeoutResponse = {
          step: "timeout",
          error:
            "Research processing timeout. Please check job status manually.",
          jobId: job.id,
          timestamp: new Date().toISOString(),
        };
        res.write(JSON.stringify(timeoutResponse) + "\n");
        res.end();
      }
    }, 1800000);
  } catch (e: any) {
    const errorResponse = {
      step: "error",
      error: e.message || "An error occurred while queuing research",
      timestamp: new Date().toISOString(),
    };
    res.write(JSON.stringify(errorResponse) + "\n");
    res.end();

    if (e.isJoi === true) {
      const errorMessage = JoiError(e);
      return next(createHttpError.BadRequest(errorMessage));
    }
    next(e);
  }
};

export const GetResearchJobStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return next(createHttpError.BadRequest("Job ID is required"));
    }

    const jobStatus = await QueueService.getResearchJobStatus(jobId);
    res.json(jobStatus);
  } catch (e: any) {
    next(e);
  }
};

export const CancelResearchJob = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return next(createHttpError.BadRequest("Job ID is required"));
    }

    const cancelled = await QueueService.cancelResearchJob(jobId);

    if (cancelled) {
      res.json({ success: true, message: "Job cancelled successfully" });
    } else {
      res.json({
        success: false,
        message: "Job not found or could not be cancelled",
      });
    }
  } catch (e: any) {
    next(e);
  }
};

export const RetryResearchJob = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return next(createHttpError.BadRequest("Job ID is required"));
    }

    const retried = await QueueService.retryResearchJob(jobId);

    if (retried) {
      res.json({ success: true, message: "Job retried successfully" });
    } else {
      res.json({
        success: false,
        message: "Job not found or could not be retried",
      });
    }
  } catch (e: any) {
    next(e);
  }
};

export const GetQueueStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await QueueService.getQueueStats();
    res.json(stats);
  } catch (e: any) {
    next(e);
  }
};

export const GetChatResearches = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { chat } = req.params;
    const data = await ResearchResultSchema.aggregate([
      {
        $match: {
          $and: [{ chat: toObjectId(chat) }],
        },
      },
      {
        $lookup: {
          from: "events",
          let: { researchId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$research", "$$researchId"],
                },
              },
            },
          ],
          as: "events",
        },
      },
      {
        $project: {
          _id: 1,
          chat: 1,
          query: 1,
          result: 1,
          sources: 1,
          images: 1,
          research_loops: 1,
          search_queries: 1,
          config: 1,
          events: 1,
        },
      },
    ]);
    res.json(data);
  } catch (e: any) {
    next(e);
  }
};

export const GetOneResearch = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = await ResearchResultSchema.aggregate([
      {
        $match: {
          $and: [{ _id: toObjectId(id) }],
        },
      },
      {
        $lookup: {
          from: "events",
          let: { researchId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$research", "$$researchId"],
                },
              },
            },
          ],
          as: "events",
        },
      },
      {
        $project: {
          _id: 1,
          chat: 1,
          query: 1,
          result: 1,
          sources: 1,
          images: 1,
          research_loops: 1,
          search_queries: 1,
          config: 1,
          events: 1,
        },
      },
    ]);
    res.json(data[0]);
  } catch (e: any) {
    next(e);
  }
};
