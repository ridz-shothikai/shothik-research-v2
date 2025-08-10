interface Logger {
  info: (message: string) => void;
  error: (message: string, error?: any) => void;
  warn: (message: string) => void;
  debug: (message: string) => void;
}

export const logger: Logger = {
  info: (message: string) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`);
  },
  error: (message: string, error?: any) => {
    console.error(
      `[ERROR] ${new Date().toISOString()}: ${message}`,
      error || ""
    );
  },
  warn: (message: string) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`);
  },
  debug: (message: string) => {
    console.debug(`[DEBUG] ${new Date().toISOString()}: ${message}`);
  },
};
