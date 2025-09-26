/**
 * Simple logging utility for the application
 * Provides pluggable interface for future telemetry integration
 */

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

class ConsoleLogger implements Logger {
  info(message: string, ...args: unknown[]): void {
    console.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    console.debug(message, ...args);
  }
}

// Default logger instance - can be replaced with telemetry logger in the future
let logger: Logger = new ConsoleLogger();

export const setLogger = (newLogger: Logger): void => {
  logger = newLogger;
};

export const getLogger = (): Logger => logger;

// Convenience functions
export const logInfo = (message: string, ...args: unknown[]): void => logger.info(message, ...args);
export const logWarn = (message: string, ...args: unknown[]): void => logger.warn(message, ...args);
export const logError = (message: string, ...args: unknown[]): void => logger.error(message, ...args);
export const logDebug = (message: string, ...args: unknown[]): void => logger.debug(message, ...args);