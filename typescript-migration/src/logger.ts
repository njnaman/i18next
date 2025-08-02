/**
 * Logger implementation for i18next TypeScript migration
 */

import type { LoggerInterface, LoggerOptions, LogLevel, LogArgs } from '../types';
import { isString } from './utils';

class ConsoleLogger implements LoggerInterface {
  public type = 'logger';

  log(...args: LogArgs): void {
    this.output('log', args);
  }

  warn(...args: LogArgs): void {
    this.output('warn', args);
  }

  error(...args: LogArgs): void {
    this.output('error', args);
  }

  output(type: LogLevel, args: LogArgs): void {
    /* eslint no-console: 0 */
    console?.[type]?.apply?.(console, args);
  }
}

class Logger implements LoggerInterface {
  public type = 'logger' as const;

  public prefix: string = 'i18next:';

  public options: LoggerOptions = {};

  public debug: boolean = false;

  public logger: LoggerInterface = new ConsoleLogger();

  constructor(concreteLogger?: LoggerInterface | null, options: LoggerOptions = {}) {
    this.init(concreteLogger, options);
  }

  init(concreteLogger?: LoggerInterface | null, options: LoggerOptions = {}) {
    this.prefix = options.prefix || 'i18next:';
    this.logger = concreteLogger || new ConsoleLogger();
    this.options = options;
    this.debug = options.debug || false;
  }
  log(...args: LogArgs): void {
   return  this.forward(args, 'log', '', true);
  }

  warn(...args: LogArgs): void {
    return this.forward(args, 'warn', '', true);
  }

  error(...args: LogArgs): void {
    return this.forward(args, 'error', '');
  }

  deprecate(...args: LogArgs): void {
    return this.forward(args, 'warn', 'WARNING DEPRECATED: ', true);
  }

  forward(
    args: LogArgs,
    lvl: LogLevel,
    prefix: string,
    debugOnly?: boolean,
  ): void {
    if (debugOnly && !this.debug) return;
    if (isString(args[0])) args[0] = `${prefix}${this.prefix} ${args[0]}`;
    this.logger[lvl](...args);
  }

  create(moduleName: string): Logger {
    return new Logger(this.logger, {
      ...this.options,
      prefix: `${this.prefix}:${moduleName}:`,
    });
  }

  clone(options?: LoggerOptions): Logger {
    options = options || this.options;
    options.prefix = options.prefix || this.prefix;
    return new Logger(this.logger, options);
  }
}

export default new Logger();
