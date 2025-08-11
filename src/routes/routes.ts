import express from "express";
import ChatRoutes from "../modules/chat/Chat.routes.js";
import ResearchRoutes from "../modules/research/Research.routes.js";
import UserRoutes from "../modules/users/Users.routes.js";

const router: express.Router = express.Router();

// Auth
router.use("/auth", UserRoutes);

// Chat
router.use("/chat", ChatRoutes);

// Research
router.use("/research", ResearchRoutes);

export default router;
