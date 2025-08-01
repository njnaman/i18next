/**
 * Basic usage example for i18next TypeScript migration
 */

import type { InitOptions, TFunction } from '../types/index.js';
import { isString, deepExtend } from '../src/utils.js';
import logger from '../src/logger.js';
import EventEmitter from '../src/EventEmitter.js';
import { get as getDefaults } from '../src/defaults.js';

// Example 1: Type-safe utility functions
console.log('=== Utility Functions Example ===');

// String type checking
const testValue: unknown = 'hello world';
if (isString(testValue)) {
  // TypeScript knows testValue is string here
  console.log(`String length: ${testValue.length}`);
}

// Deep object extension
const baseConfig = {
  debug: false,
  language: 'en',
  features: {
    logging: true,
  },
};

const userConfig = {
  debug: true,
  features: {
    analytics: false,
  },
  newFeature: 'enabled',
};

const mergedConfig = deepExtend(baseConfig, userConfig, true);
console.log('Merged configuration:', mergedConfig);

// Example 2: Logger usage
console.log('\n=== Logger Example ===');

logger.init(null, { debug: true, prefix: 'example:' });
logger.log('This is a log message');
logger.warn('This is a warning');
logger.error('This is an error');

const moduleLogger = logger.create('module');
moduleLogger.log('Module-specific log');

// Example 3: Event system
console.log('\n=== Event System Example ===');

const eventEmitter = new EventEmitter();

// Type-safe event listeners
const handleUserAction = (...args: unknown[]): void => {
  const [action, data] = args;
  console.log(`User action: ${action}`, data);
};

const handleSystemEvent = (...args: unknown[]): void => {
  console.log('System event:', args);
};

eventEmitter.on('user:action', handleUserAction);
eventEmitter.on('system:*', handleSystemEvent);

// Emit events
eventEmitter.emit('user:action', 'login', { userId: 123, timestamp: Date.now() });
eventEmitter.emit('system:startup', 'Application started');

// Example 4: Configuration with type safety
console.log('\n=== Configuration Example ===');

const defaultOptions = getDefaults();
console.log('Default debug setting:', defaultOptions.debug);
console.log('Default namespaces:', defaultOptions.ns);

// Type-safe configuration
const customOptions: InitOptions = {
  debug: true,
  lng: 'en-US',
  fallbackLng: ['en', 'dev'],
  ns: ['common', 'validation', 'errors'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
    format: (value: unknown, format?: string): string => {
      if (format === 'uppercase' && isString(value)) {
        return value.toUpperCase();
      }
      return String(value);
    },
  },
};

console.log('Custom configuration:', customOptions);

// Example 5: Type guards and validation
console.log('\n=== Type Guards Example ===');

function processTranslationValue(value: unknown): string {
  if (isString(value)) {
    return value;
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (value === null || value === undefined) {
    return '';
  }

  // For objects, stringify them
  return JSON.stringify(value);
}

const testValues: unknown[] = [
  'string value',
  42,
  true,
  null,
  undefined,
  { key: 'value' },
  ['array', 'value'],
];

testValues.forEach((value, index) => {
  const processed = processTranslationValue(value);
  console.log(`Value ${index}: ${typeof value} -> "${processed}"`);
});

// Example 6: Error handling with custom types
console.log('\n=== Error Handling Example ===');

import { I18nextBaseError } from '../types/index.js';

class TranslationError extends I18nextBaseError {
  constructor(message: string, key: string, language: string) {
    super(message, 'TRANSLATION_ERROR', { key, language });
    this.name = 'TranslationError';
  }
}

function simulateTranslation(key: string, language: string): string {
  if (!key) {
    throw new TranslationError('Translation key is required', key, language);
  }

  if (language === 'unsupported') {
    throw new TranslationError('Unsupported language', key, language);
  }

  return `Translated: ${key} (${language})`;
}

try {
  console.log(simulateTranslation('hello.world', 'en'));
  console.log(simulateTranslation('hello.world', 'unsupported'));
} catch (error) {
  if (error instanceof TranslationError) {
    console.error(`Translation error: ${error.message}`);
    console.error(`Details:`, error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}

console.log('\n=== TypeScript Migration Example Complete ===');
