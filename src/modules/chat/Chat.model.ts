import mongoose, { Model, Schema } from "mongoose";
import { IChat } from "./Chat.interface.js";

const ChatSchema = new Schema(
  {
    name: {
      type: String,
    },
    user: {
      type: Schema.Types.ObjectId,
      required: [true, "User is required"],
    },
  },
  { timestamps: true, versionKey: false }
);

const Chat: Model<IChat> = mongoose.model<IChat>("chats", ChatSchema);
export default Chat;
