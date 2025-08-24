import { auth } from "@ridz-shothikai/shothik-auth-service/src/middleware.js";
import express from "express";
import * as ResearchController from "./Research.controller.js";
import * as QueueController from "./Research.controller.queue.js";

const router: express.Router = express.Router();

router.post(
  "/create_research",
  auth,
  ResearchController.CreateResearch
);

router.post(
  "/create_research_queue",
  auth,
  QueueController.CreateResearchWithQueue
);
router.get(
  "/get_chat_researches/:chatId",
  auth,
  QueueController.GetChatResearches
);
router.get(
  "/get_one_research/:id",
  auth,
  QueueController.GetOneResearch
);
router.get(
  "/job/:jobId/status",
  auth,
  QueueController.GetResearchJobStatus
);
router.post(
  "/job/:jobId/cancel",
  auth,
  QueueController.CancelResearchJob
);
router.post(
  "/job/:jobId/retry",
  auth,
  QueueController.RetryResearchJob
);
router.get("/queue/stats", auth, QueueController.GetQueueStats);

export default router;
