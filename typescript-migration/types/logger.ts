/**
 * Logger type definitions for i18next TypeScript migration
 */

import type { BaseModule } from './core.js';

// Log levels
export type LogLevel = 'log' | 'warn' | 'error';

// Logger arguments
export type LogArgs = unknown[];

// Logger interface
export interface LoggerInterface {
  log(...args: LogArgs): void;

  warn(...args: LogArgs): void;

  error(...args: LogArgs): void;
}

// Extended logger interface for testing
export interface TestLoggerInterface extends LoggerInterface {
  type?: string;
  output(type: LogLevel, args: LogArgs): void;
}

// Logger options
export type LoggerOptions = {
  prefix?: string;
  debug?: boolean;
};
