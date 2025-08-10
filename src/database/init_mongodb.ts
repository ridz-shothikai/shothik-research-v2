import { cyanBright } from "console-log-colors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
dotenv.config();

const connectDB = async (): Promise<mongoose.Connection> => {
    try {
        const mongoUri = process.env.MONGODB_LIVE_URI;

        if (!mongoUri) {
            throw new Error("MONGODB_LIVE_URI environment variable is not set");
        }

        logger.info(`Connecting to MongoDB: ${mongoUri.substring(0, 20)}...`);

        const con = await mongoose.connect(mongoUri, {
            maxPoolSize: 50,
            serverSelectionTimeoutMS: 3000000,
            socketTimeoutMS: 30000000,
        });
        logger.info(
            cyanBright(`${process.env.DB_NAME} Connected: ${con.connection.host}`)
        );

        mongoose.connection.on("disconnected", () => {
            logger.error("Mongoose connection is disconnected.");
        });
        return con.connection;
    } catch (error) {
        logger.error("found Error on Connection=>", error);
        process.exit(1);
    }
};

connectDB();

process.on("SIGINT", async () => {
    await mongoose.connection.close();
    process.exit(0);
});
