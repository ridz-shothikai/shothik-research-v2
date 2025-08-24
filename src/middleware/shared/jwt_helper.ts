import dotenv from "dotenv";
import { NextFunction, Request, Response } from "express";
import createError from "http-errors";
import JWT, { SignOptions, VerifyErrors } from "jsonwebtoken";
dotenv.config();

export interface AuthRequest extends Request {
  id?: string;
  payload?: {
    aud: string;
    role?: string;
    iat?: number;
    exp?: number;
    iss?: string;
  };
}

export const signAccessToken = (userId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const secret = process.env.ACCESS_TOKEN_SECRET || "";
      if (!secret) {
        console.error("ACCESS_TOKEN_SECRET is not defined");
        return reject(
          createError.InternalServerError("Token secret not configured")
        );
      }

      const options: SignOptions = {
        expiresIn: "30d",
        issuer: "shothik.ai",
        audience: userId,
      };

      JWT.sign({}, secret, options, (err, token) => {
        if (err) {
          console.error("JWT sign error:", err.message);
          return reject(createError.InternalServerError());
        }
        if (!token) {
          console.error("JWT sign returned null token");
          return reject(
            createError.InternalServerError("Failed to generate token")
          );
        }
        resolve(token);
      });
    } catch (error) {
      console.error("Unexpected error in signAccessToken:", error);
      reject(createError.InternalServerError());
    }
  });
};

export const verifyAccessToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.headers["authorization"]) return next(createError.Unauthorized());
  const authHeader = req.headers["authorization"] as string;
  const bearerToken = authHeader.split(" ");
  const token = bearerToken[1];
  JWT.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET || "",
    (err: VerifyErrors | null, payload: any) => {
      if (err) {
        const message =
          err.name === "JsonWebTokenError" ? "Unauthorized" : err.message;
        return next(createError.Unauthorized(message));
      }
      req.payload = payload;
      next();
    }
  );
};

export const signRefreshToken = (userId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const secret = process.env.REFRESH_TOKEN_SECRET || "";
      if (!secret) {
        console.error("REFRESH_TOKEN_SECRET is not defined");
        return reject(
          createError.InternalServerError("Token secret not configured")
        );
      }

      const options: SignOptions = {
        expiresIn: "30d",
        issuer: "shothik.ai",
        audience: userId,
      };

      JWT.sign({}, secret, options, (err, token) => {
        if (err) {
          console.error("JWT sign error:", err.message);
          return reject(createError.InternalServerError());
        }
        if (!token) {
          console.error("JWT sign returned null token");
          return reject(
            createError.InternalServerError("Failed to generate token")
          );
        }
        resolve(token);
      });
    } catch (error) {
      console.error("Unexpected error in signRefreshToken:", error);
      reject(createError.InternalServerError());
    }
  });
};

export const verifyRefreshToken = (refreshToken: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    JWT.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET || "",
      (err: VerifyErrors | null, payload: any) => {
        if (err) {
          console.error("JWT verify error:", err.message);
          return reject(createError.Unauthorized());
        }

        const userId = payload.aud as string;
        return resolve(userId);
      }
    );
  });
};
