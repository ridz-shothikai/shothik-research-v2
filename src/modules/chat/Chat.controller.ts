import { NextFunction, Response } from "express";
import { default as createHttpError } from "http-errors";
import { JoiError } from "../../helpers/error.js";
import VectorMemoryService from "../../memories/VectorMemoryService.js";
import { AuthRequest } from "../../middleware/shared/jwt_helper.js";
import Event from "../events/Events.model.js";
import ResearchResultSchema from "../research/Research.model.js";
import Chat from "./Chat.model.js";
import ChatService from "./Chat.service.js";

export const CreateChat = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.id || "";
    const data = await ChatService.Create({ ...req.body, user });
    res.send(data);
  } catch (e: any) {
    if (e.isJoi === true) {
      const errorMessage = JoiError(e);
      return next(createHttpError.BadRequest(errorMessage));
    }
    next(e);
  }
};

export const ReplicateChat = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.id || "";
    const { chat, replicate_to } = req.body;
    if (!chat || !replicate_to) {
      return next(
        createHttpError.BadRequest("Chat and replicate_to are required")
      );
    }
    const oneChat = await Chat.findOne({ _id: chat, user: user });
    if (!oneChat) {
      return next(createHttpError.NotFound("Chat not found"));
    }
    const researches = await ResearchResultSchema.find({ chat: chat });
    const newChat = {
      name: oneChat?.name || "",
      user: replicate_to,
    };
    const newCreatedChat = await Chat.create(newChat);
    const newConversations = researches.map(({ _id, ...rest }) => {
      return {
        ...rest,
        chat: newCreatedChat._id,
      };
    });
    await ResearchResultSchema.insertMany(newConversations);
    res.send(newCreatedChat);
  } catch (e: any) {
    next(e);
  }
};

export const GetOneChat = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id: string = req.params.id;
    const data = await ChatService.GetOne(id);
    res.send(data);
  } catch (e: any) {
    next(e);
  }
};

export const GetMyChats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.id || "";
    const data = await ChatService.GetMyChats(id);
    res.send(data);
  } catch (e: any) {
    next(e);
  }
};

export const UpdateChatName = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id: string = req.params.id;
    const name: string = req.body.name;
    const data = await ChatService.UpdateName(id, name);
    res.send(data);
  } catch (e: any) {
    next(e);
  }
};

export const DeleteOneChat = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id: string = req.params.id;
    const data = await ChatService.Delete(id);
    const researchIds = await ResearchResultSchema.find({ chat: id });
    await ResearchResultSchema.deleteMany({ chat: id });
    await VectorMemoryService.getInstance().deleteResearchMemory(id);
    await Event.deleteMany({ research: researchIds });
    res.send(data);
  } catch (e: any) {
    next(e);
  }
};
