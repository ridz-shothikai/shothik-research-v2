import express from "express";
import ResearchRoutes from "../modules/research/Research.routes.js";

const router: express.Router = express.Router();

// // Auth
// router.use("/auth", UserRoutes);

// // Chat/File
// router.use("/chat", ChatRoutes);

// Research
router.use("/research", ResearchRoutes);

export default router;
