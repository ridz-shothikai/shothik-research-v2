import mongoose, { Model, Schema } from "mongoose";
import { IEvent } from "./Events.interface.js";

const EventSchema = new Schema(
  {
    research: {
      type: Schema.Types.ObjectId,
      required: [true, "Research is required"],
    },
    step: {
      type: String,
      required: [true, "Step is required"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
    },
    timestamp: {
      type: Date,
      required: [true, "Timestamp is required"],
    },
  },
  { timestamps: true, versionKey: false }
);

const Event: Model<IEvent> = mongoose.model<IEvent>("events", EventSchema);
export default Event;
