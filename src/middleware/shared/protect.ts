import { NextFunction, Request, Response } from "express";
import createError from "http-errors";

interface AuthRequest extends Request {
  payload?: {
    aud: string;
    role: string;
  };
}

export const protect = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.payload) {
        throw createError.Unauthorized();
      }

      const userRole = req.payload.role;

      if (!roles.includes(userRole)) {
        throw createError.Forbidden(
          "You do not have permission to access this resource"
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
