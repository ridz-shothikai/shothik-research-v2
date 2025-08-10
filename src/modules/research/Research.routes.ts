import express from "express";
import * as ResearchController from "./Research.controller.js";

const router: express.Router = express.Router();

router.post("/create_research", ResearchController.CreateResearch);

export default router;
