import express from "express";
import * as ResearchController from "./Research.controller.js";
import * as QueueController from "./Research.controller.queue.js";

const router: express.Router = express.Router();

router.post("/create_research", ResearchController.CreateResearch);

router.post("/create_research_queue", QueueController.CreateResearchWithQueue);
router.get("/get_chat_researches/:chat", QueueController.GetChatResearches);
router.get("/job/:jobId/status", QueueController.GetResearchJobStatus);
router.post("/job/:jobId/cancel", QueueController.CancelResearchJob);
router.post("/job/:jobId/retry", QueueController.RetryResearchJob);
router.get("/queue/stats", QueueController.GetQueueStats);

export default router;
