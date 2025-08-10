class SearchQueryList {
  public query: string[];
  public rationale: string;

  constructor(query: string[] = [], rationale: string = "") {
    this.query = query;
    this.rationale = rationale;
  }

  validate() {
    if (!Array.isArray(this.query)) {
      throw new Error("Query must be an array");
    }
    if (typeof this.rationale !== "string") {
      throw new Error("Rationale must be a string");
    }
    return true;
  }

  static fromObject(obj: any) {
    return new SearchQueryList(obj.query, obj.rationale);
  }

  toObject() {
    return {
      query: this.query,
      rationale: this.rationale,
    };
  }
}

class Reflection {
  public is_sufficient: boolean;
  public knowledge_gap: string;
  public follow_up_queries: string[];

  constructor(
    is_sufficient: boolean = false,
    knowledge_gap: string = "",
    follow_up_queries: string[] = []
  ) {
    this.is_sufficient = is_sufficient;
    this.knowledge_gap = knowledge_gap;
    this.follow_up_queries = follow_up_queries;
  }

  validate() {
    if (typeof this.is_sufficient !== "boolean") {
      throw new Error("is_sufficient must be a boolean");
    }
    if (typeof this.knowledge_gap !== "string") {
      throw new Error("knowledge_gap must be a string");
    }
    if (!Array.isArray(this.follow_up_queries)) {
      throw new Error("follow_up_queries must be an array");
    }
    return true;
  }

  static fromObject(obj: any) {
    return new Reflection(
      obj.is_sufficient,
      obj.knowledge_gap,
      obj.follow_up_queries
    );
  }

  toObject() {
    return {
      is_sufficient: this.is_sufficient,
      knowledge_gap: this.knowledge_gap,
      follow_up_queries: this.follow_up_queries,
    };
  }
}

export { Reflection, SearchQueryList };
