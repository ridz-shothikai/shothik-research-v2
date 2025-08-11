import { default as createHttpError } from "http-errors";
import { toObjectId } from "../../helpers/toObjectId.js";
import { IChat } from "./Chat.interface.js";
import Chat from "./Chat.model.js";
import { chatSchema } from "./Chat.validation.js";

class ChatService {
  static async Create(body: Partial<IChat>): Promise<IChat> {
    try {
      const result = await chatSchema.validateAsync(body);
      const data = await Chat.create(result);
      return data;
    } catch (error: any) {
      throw error;
    }
  }

  static async UpdateName(
    chatId: string,
    name: string
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    try {
      const result = await Chat.updateOne({ _id: chatId }, { $set: { name } });
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  static async GetOne(chatId: string): Promise<IChat | null> {
    try {
      if (!chatId) throw createHttpError.BadRequest("Chat ID is required");
      const data = await Chat.aggregate([
        {
          $match: {
            $and: [{ _id: toObjectId(chatId) }],
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);
      return data[0];
    } catch (error: any) {
      throw error;
    }
  }

  static async GetMyChats(userId: string): Promise<IChat[] | null> {
    try {
      const data = await Chat.aggregate([
        {
          $match: {
            $and: [{ user: toObjectId(userId) }],
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);
      return data;
    } catch (error: any) {
      throw error;
    }
  }

  static async Delete(
    chatId: string
  ): Promise<{ acknowledged: boolean; deletedCount: number }> {
    try {
      const result = await Chat.deleteOne({ _id: chatId });
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}

export default ChatService;
