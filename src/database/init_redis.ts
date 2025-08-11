import { cyan } from "console-log-colors";
import dotenv from "dotenv";
import redis from "redis";
import { logger } from "../utils/logger.js";
dotenv.config();

type RedisClient = ReturnType<typeof redis.createClient>;

const client: RedisClient = redis.createClient({
  port: 6379,
  host: "127.0.0.1",
  retry_strategy: function (options: any) {
    if (options.error && options.error.code === "ECONNREFUSED") {
      return new Error("The server refused the connection");
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error("Retry time exhausted");
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  },
} as any);

client.on("connect", () => {
  logger.info("Client connected to redis...");
});

client.on("ready", () => {
  logger.info(cyan("Client connected to redis and ready to use..."));
});

client.on("error", (err) => {
  logger.error(`Redis client error: ${err.message}`);
});

client.on("end", () => {
  logger.info("Client disconnected from redis");
});

export { client };
export default client;
