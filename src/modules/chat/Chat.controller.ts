import { NextFunction, Response } from "express";
import { default as createHttpError } from "http-errors";
import { JoiError } from "../../helpers/error.js";
import VectorMemoryService from "../../memories/VectorMemoryService.js";
import { AuthRequest } from "../../middleware/shared/jwt_helper.js";
import Event from "../events/Events.model.js";
import ResearchResultSchema from "../research/Research.model.js";
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
