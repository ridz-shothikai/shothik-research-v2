import { default as createHttpError } from "http-errors";
import client from "../../database/init_redis.js";
import { toObjectId } from "../../helpers/toObjectId.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../middleware/shared/jwt_helper.js";
import { IUser } from "./Users.interface.js";
import User from "./Users.model.js";
import { loginSchema, userSchema } from "./Users.validation.js";

class UserService {
  static async Create(body: Partial<IUser>): Promise<IUser> {
    try {
      const result = await userSchema.validateAsync(body);
      const doesExist = await User.findOne({ email: result.email });
      if (doesExist)
        throw createHttpError.Conflict(
          `${result.email} is already been registered`
        );
      const data = await User.create(result);
      return data;
    } catch (error: any) {
      throw error;
    }
  }
  static async GetOne(userId: string): Promise<IUser | null> {
    try {
      if (!userId) throw createHttpError.BadRequest("User ID is required");
      const data = await User.aggregate([
        {
          $match: {
            $and: [{ _id: toObjectId(userId) }],
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1,
          },
        },
      ]);
      return data[0];
    } catch (error: any) {
      throw error;
    }
  }
  static async Delete(
    userId: string
  ): Promise<{ acknowledged: boolean; deletedCount: number }> {
    try {
      const result = await User.deleteOne({ _id: userId });
      return result;
    } catch (error: any) {
      throw error;
    }
  }
  static async RefreshToken(
    refreshToken: string
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      if (!refreshToken) throw createHttpError.BadRequest();
      const userId = (await verifyRefreshToken(refreshToken)) as string;
      const user = await User.findById(userId);
      if (!user) throw createHttpError.NotFound("User not found");
      const accessToken = await signAccessToken(userId);
      const refToken = await signRefreshToken(userId);
      return { access_token: accessToken, refresh_token: refToken };
    } catch (error: any) {
      throw error;
    }
  }

  static async Login(
    body: Partial<IUser>
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      const result = await loginSchema.validateAsync(body);
      const user = await User.findOne({ email: result.email });
      if (!user) throw createHttpError.NotFound("User not registered");
      const isMatch = await user.isValidPassword(result.password);
      if (!isMatch)
        throw createHttpError.Unauthorized("Username/password not valid");
      const accessToken = await signAccessToken(user.id);
      const refreshToken = await signRefreshToken(user.id);
      return {
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    } catch (error: any) {
      throw error;
    }
  }

  static async Logout(refreshToken: string): Promise<{ message: string }> {
    try {
      if (!refreshToken) throw createHttpError.BadRequest();
      const userId = (await verifyRefreshToken(refreshToken)) as string;
      await (client as any).del(userId);
      return { message: "Successfully Logout" };
    } catch (error: any) {
      throw error;
    }
  }
}

export default UserService;
