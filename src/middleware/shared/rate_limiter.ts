import { rateLimit } from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message:
    "Too many accounts created from this IP, please try again after 15 minutes",
});

export default apiLimiter;
