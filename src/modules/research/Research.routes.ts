import express from "express";
import { verifyAccessToken } from "../../middleware/shared/jwt_helper.js";
import * as ResearchController from "./Research.controller.js";
import * as QueueController from "./Research.controller.queue.js";

const router: express.Router = express.Router();

router.post(
  "/create_research",
  verifyAccessToken,
  ResearchController.CreateResearch
);

router.post(
  "/create_research_queue",
  verifyAccessToken,
  QueueController.CreateResearchWithQueue
);
router.get(
  "/get_chat_researches/:chat",
  verifyAccessToken,
  QueueController.GetChatResearches
);
router.get(
  "/get_one_research/:id",
  verifyAccessToken,
  QueueController.GetOneResearch
);
router.get(
  "/job/:jobId/status",
  verifyAccessToken,
  QueueController.GetResearchJobStatus
);
router.post(
  "/job/:jobId/cancel",
  verifyAccessToken,
  QueueController.CancelResearchJob
);
router.post(
  "/job/:jobId/retry",
  verifyAccessToken,
  QueueController.RetryResearchJob
);
router.get("/queue/stats", verifyAccessToken, QueueController.GetQueueStats);

export default router;
