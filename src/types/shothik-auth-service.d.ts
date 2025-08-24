declare module "@ridz-shothikai/shothik-auth-service/src/middleware.js" {
  import { NextFunction, Request, Response } from "express";

  export function verifyAuth(
    req: Request,
    res: Response,
    next: NextFunction
  ): void;

  export const auth: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => void;
}
