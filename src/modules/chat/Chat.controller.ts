import { NextFunction, Request, Response } from "express";
import { default as createHttpError } from "http-errors";
import { JoiError } from "../../helpers/error.js";
import { AuthRequest } from "../../middleware/shared/jwt_helper.js";
import ChatService from "./Chat.service.js";

export const CreateChat = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.payload?.aud || "";
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
  req: Request,
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
    const id = req.payload?.aud || "";
    const data = await ChatService.GetMyChats(id);
    res.send(data);
  } catch (e: any) {
    next(e);
  }
};

export const UpdateChatName = async (
  req: Request,
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
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id: string = req.params.id;
    const data = await ChatService.Delete(id);
    res.send(data);
  } catch (e: any) {
    next(e);
  }
};
