import Joi from "joi";

export const chatSchema = Joi.object({
    name: Joi.string().optional(),
    user: Joi.string().required(),
});