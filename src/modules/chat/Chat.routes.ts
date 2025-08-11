import express from "express";
import { verifyAccessToken } from "../../middleware/shared/jwt_helper.js";
import * as ChatController from "./Chat.controller.js";

const router: express.Router = express.Router();

router.post("/create_chat", verifyAccessToken, ChatController.CreateChat);

router.put(
  "/update_name/:id",
  verifyAccessToken,
  ChatController.UpdateChatName
);

router.get("/get_one_chat/:id", verifyAccessToken, ChatController.GetOneChat);

router.get("/get_my_chats", verifyAccessToken, ChatController.GetMyChats);

router.delete(
  "/delete_chat/:id",
  verifyAccessToken,
  ChatController.DeleteOneChat
);

export default router;
