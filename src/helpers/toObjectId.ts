import { Types } from "mongoose";

export const toObjectId = (id: string): Types.ObjectId => {
  return new Types.ObjectId(id);
};
