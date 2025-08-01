import { describe, it, expect, beforeAll } from 'vitest';
import logger from '../../src/logger';

const mockLogger = {
  type: 'logger',

  log(args) {
    return this.output('log', args);
  },

  warn(args) {
    return this.output('warn', args);
  },

  error(args) {
    return this.output('error', args);
  },

  output(type, args) {
    return {
      type,
      args,
    };
  },
};

describe('logger', () => {
  beforeAll(() => {
    logger.init(mockLogger, { debug: true });
  });

  describe('converting', () => {
    it('it should log', () => {
      expect(logger.log('hello').type).toBe('log');
      expect(logger.log('hello').args[0]).toBe('i18next: hello');
    });

    it('it should warn', () => {
      expect(logger.warn('hello').type).toBe('warn');
      expect(logger.warn('hello').args[0]).toBe('i18next: hello');
    });

    it('it should error', () => {
      expect(logger.error('hello').type).toBe('error');
      expect(logger.error('hello').args[0]).toBe('i18next: hello');
    });

    it('it should warn deprecation', () => {
      expect(logger.deprecate('hello').type).toBe('warn');
      expect(logger.deprecate('hello').args[0]).toBe('WARNING DEPRECATED: i18next: hello');
    });
  });
});
