import { NextFunction, Request, Response } from "express";
import { default as createHttpError } from "http-errors";
import { JoiError } from "../../helpers/error.js";
import UserService from "./Users.service.js";

export const UserRegister = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await UserService.Create(req.body);
    res.send(data);
  } catch (e: any) {
    if (e.isJoi === true) {
      const errorMessage = JoiError(e);
      return next(createHttpError.BadRequest(errorMessage));
    }
    next(e);
  }
};

export const GetOneUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id: string = req.params.id;
    const data = await UserService.GetOne(id);
    res.send(data);
  } catch (e: any) {
    next(e);
  }
};

export const DeleteOneUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id: string = req.params.id;
    const data = await UserService.Delete(id);
    res.send(data);
  } catch (e: any) {
    next(e);
  }
};

export const RefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const data = await UserService.RefreshToken(refreshToken);
    res.send(data);
  } catch (error: any) {
    next(error);
  }
};

export const Logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const data = await UserService.Logout(refreshToken);
    res.send(data);
  } catch (error: any) {
    next(error);
  }
};

export const UserLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await UserService.Login(req.body);
    res.send(data);
  } catch (error: any) {
    if (error.isJoi === true)
      return next(createHttpError.BadRequest("Invalid Username/Password"));
    next(error);
  }
};
