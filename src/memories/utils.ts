export function sourcesToStringArray(sources: any[]): string[] {
  return sources.map((source) => {
    if (typeof source === "string") {
      return source;
    }
    return source.url || source.title || String(source);
  });
}
