interface ConfigurationOptions {
  query_generator_model?: string;
  reflection_model?: string;
  answer_model?: string;
  number_of_initial_queries?: number;
  max_research_loops?: number;
}

interface RunnableConfig {
  configurable?: ConfigurationOptions;
}

class Configuration {
  public query_generator_model: string;
  public reflection_model: string;
  public answer_model: string;
  public number_of_initial_queries: number;
  public max_research_loops: number;

  constructor(options: ConfigurationOptions = {}) {
    this.query_generator_model =
      options.query_generator_model || "gemini-2.5-pro";
    this.reflection_model = options.reflection_model || "gemini-2.5-pro";
    this.answer_model = options.answer_model || "gemini-2.5-pro";
    this.number_of_initial_queries = options.number_of_initial_queries || 3;
    this.max_research_loops = options.max_research_loops || 2;
  }

  static fromRunnableConfig(
    config: RunnableConfig | null = null
  ): Configuration {
    const configurable =
      config && config.configurable ? config.configurable : {};

    return new Configuration({
      query_generator_model: configurable.query_generator_model,
      reflection_model: configurable.reflection_model,
      answer_model: configurable.answer_model,
      number_of_initial_queries: configurable.number_of_initial_queries,
      max_research_loops: configurable.max_research_loops,
    });
  }

  toObject(): ConfigurationOptions {
    return {
      query_generator_model: this.query_generator_model,
      reflection_model: this.reflection_model,
      answer_model: this.answer_model,
      number_of_initial_queries: this.number_of_initial_queries,
      max_research_loops: this.max_research_loops,
    };
  }
}

export default Configuration;
