import { Document } from "mongoose";

export interface IChat extends Document {
  name?: string;
  user: string;
}
