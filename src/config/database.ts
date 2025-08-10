import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_LIVE_URI;
    if (!mongoUri) {
      throw new Error("MongoDB URI not found in environment variables");
    }
    const conn = await mongoose.connect(mongoUri);
    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

export default connectDB;
