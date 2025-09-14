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

        if (jobStatus.progress) {
          const progress = jobStatus.progress as any;

          // Handle new events array structure
          if (progress.events && Array.isArray(progress.events)) {
            const lastEventCount = (lastProgress as any)?.events?.length || 0;
            const currentEventCount = progress.events.length;

            // Send any new events that weren't sent before
            if (currentEventCount > lastEventCount) {
              const newEvents = progress.events.slice(lastEventCount);

              for (const event of newEvents) {
                res.write(JSON.stringify(event) + "\n");
                res.flush();

                // Save to database
                if (event.researchId && event.researchId !== "unknown") {
                  Event.create({
                    research: event.researchId,
                    step: event.step,
                    data: event.data,
                    timestamp: event.timestamp,
                  }).catch((err) => {
                    logger.error("Failed to save event:", err);
                  });
                }
              }

              lastProgress = progress;
            }
          } else {
            // Fallback for old single-event structure
            const currentProgress = JSON.stringify(jobStatus.progress);
            const lastProgressStr = JSON.stringify(lastProgress);

            if (currentProgress !== lastProgressStr) {
              lastProgress = jobStatus.progress;

              res.write(JSON.stringify(jobStatus.progress) + "\n");
              res.flush();

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
    const { chatId } = req.params;
    const data = await ResearchResultSchema.aggregate([
      {
        $match: {
          $and: [{ chat: toObjectId(chatId) }],
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

export const SimulateResearch = async (
  req: any,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return next(createHttpError.BadRequest("Chat ID is required"));
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    const researchData = await ResearchResultSchema.aggregate([
      {
        $match: {
          chat: toObjectId(chatId),
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
            {
              $sort: { timestamp: 1 },
            },
          ],
          as: "events",
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $limit: 1,
      },
    ]);

    if (!researchData || researchData.length === 0) {
      const errorResponse = {
        step: "error",
        error: "No research data found for the provided chat ID",
        timestamp: new Date().toISOString(),
      };
      res.write(JSON.stringify(errorResponse) + "\n");
      res.end();
      return;
    }

    const research = researchData[0];
    const events = research.events || [];
    const initialResponse = {
      step: "queued",
      data: {
        jobId: `sim_${Date.now()}`,
        connectionId: `sim_conn_${Date.now()}`,
        title: "Research Simulation Started",
        message: "Simulating research from existing data",
        position: 0,
      },
      timestamp: new Date().toISOString(),
    };

    res.write(JSON.stringify(initialResponse) + "\n");
    res.flush();
    let eventIndex = 0;
    const simulateNextEvent = () => {
      if (eventIndex < events.length) {
        const event = events[eventIndex];
        const simulatedEvent = {
          step: event.step,
          data: event.data,
          researchId: research._id.toString(),
          timestamp: new Date().toISOString(),
        };

        res.write(JSON.stringify(simulatedEvent) + "\n");
        res.flush();

        eventIndex++;
        setTimeout(simulateNextEvent, 1000 + Math.random() * 2000);
      } else {
        const finalResponse = {
          step: "completed",
          data: {
            _id: research._id,
            chat: research.chat,
            query: research.query,
            result: research.result,
            sources: research.sources,
            images: research.images,
            research_loops: research.research_loops,
            search_queries: research.search_queries,
            config: research.config,
            createdAt: research.createdAt,
            updatedAt: research.updatedAt,
          },
          timestamp: new Date().toISOString(),
        };

        res.write(JSON.stringify(finalResponse) + "\n");
        res.end();
      }
    };
    setTimeout(simulateNextEvent, 1000);
    req.on("close", () => {
      logger.info("Client disconnected from simulation");
    });
  } catch (e: any) {
    const errorResponse = {
      step: "error",
      error: e.message || "An error occurred during simulation",
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
