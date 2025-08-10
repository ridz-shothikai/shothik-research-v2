import { ValidationError } from "joi";

export const JoiError = (error: ValidationError | undefined): string => {
  return error?.details?.map((err) => err.message).join(", ") || "";
};
