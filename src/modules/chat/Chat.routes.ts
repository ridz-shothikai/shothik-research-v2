import { auth } from "@ridz-shothikai/shothik-auth-service/src/middleware.js";
import express from "express";
import * as ChatController from "./Chat.controller.js";

const router: express.Router = express.Router();

router.post("/create_chat", auth, ChatController.CreateChat);

router.put("/update_name/:id", auth, ChatController.UpdateChatName);

router.get("/get_one_chat/:id", auth, ChatController.GetOneChat);

router.get("/get_my_chats", auth, ChatController.GetMyChats);

router.delete("/delete_chat/:id", auth, ChatController.DeleteOneChat);

export default router;
