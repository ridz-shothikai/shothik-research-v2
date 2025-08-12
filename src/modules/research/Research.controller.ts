import { NextFunction, Request, Response } from "express";
import { default as createHttpError } from "http-errors";
import { JoiError } from "../../helpers/error.js";
import Event from "../events/Events.model.js";
import ResearchService from "./Research.service.js";

export const CreateResearch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const streamCallback = async (
      step: string,
      data: any,
      researchId: string
    ) => {
      const streamData = {
        step,
        data,
        timestamp: new Date().toISOString(),
      };
      res.write(JSON.stringify(streamData) + "\n");
      if (res.flush) {
        res.flush();
      }

      if (researchId && researchId !== "unknown") {
        Event.create({
          research: researchId,
          step,
          data,
          timestamp: new Date().toISOString(),
        }).catch((err) => {
          console.error("Failed to save event:", err);
        });
      }
    };

    const finalData = await ResearchService.CreateWithStreaming(
      req.body,
      streamCallback
    );

    res.write(JSON.stringify(finalData) + "\n");
    res.end();
  } catch (e: any) {
    const errorResponse = {
      step: "error",
      error: e.message || "An error occurred",
      timestamp: new Date().toISOString(),
    };
    res.write(JSON.stringify(errorResponse) + "\n");
    res.end();

    if (e.isJoi === true) {
      const errorMessage = JoiError(e);
      return next(createHttpError.BadRequest(errorMessage));
    }
    next(e);
  }
};
