import mongoose, { Schema } from "mongoose";
import {
  IImage,
  IResearchResult,
  ISearchQuery,
  ISource,
} from "./Research.interface.js";

const sourcesSchema = new Schema<ISource>(
  {
    url: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    resolved_url: {
      type: String,
      required: false,
    },
    reference: {
      type: Number,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const searchQuerySchema = new Schema<ISearchQuery>(
  {
    query: {
      type: String,
      required: true,
    },
    rationale: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const imagesSchema = new Schema<IImage>(
  {
    url: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      required: true,
    },
    alt_text: {
      type: String,
      required: false,
    },
    thumbnail_url: {
      type: String,
      required: false,
    },
    width: {
      type: Number,
      required: false,
    },
    height: {
      type: Number,
      required: false,
    },
    context_url: {
      type: String,
      required: false,
    },
    relevance_score: {
      type: Number,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const ResearchResultSchema = new Schema<IResearchResult>(
  {
    query: {
      type: String,
      required: true,
      trim: true,
    },
    result: {
      type: String,
      required: true,
    },
    sources: [sourcesSchema],
    images: [imagesSchema],
    research_loops: {
      type: Number,
      required: true,
      min: 0,
    },
    search_queries: [searchQuerySchema],
    config: {
      query_generator_model: {
        type: String,
        default: "gemini-2.5-pro",
      },
      reflection_model: {
        type: String,
        default: "gemini-2.5-pro",
      },
      answer_model: {
        type: String,
        default: "gemini-2.5-pro",
      },
      number_of_initial_queries: {
        type: Number,
        default: 1,
        min: 1,
        max: 10,
      },
      max_research_loops: {
        type: Number,
        default: 1,
        min: 1,
        max: 10,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ResearchResultSchema.index({ query: 1 });
ResearchResultSchema.index({ createdAt: -1 });

export default mongoose.model<IResearchResult>(
  "research_results",
  ResearchResultSchema
);
