import Joi from "joi";

export const researchSchema = Joi.object({
  query: Joi.string().required(),
  config: Joi.object({
    query_generator_model: Joi.string().optional().default("gemini-2.5-pro"),
    reflection_model: Joi.string().optional().default("gemini-2.5-pro"),
    answer_model: Joi.string().optional().default("gemini-2.5-pro"),
    number_of_initial_queries: Joi.number()
      .integer()
      .min(1)
      .max(10)
      .optional()
      .default(1),
    max_research_loops: Joi.number()
      .integer()
      .min(1)
      .max(10)
      .optional()
      .default(1),
  }).optional(),
});
