import { Document } from "mongoose";

export interface IEvent extends Document {
  research: string;
  step: string;
  data: any;
  timestamp: Date;
}
