/**
 * Type definitions index for i18next TypeScript migration
 */

// Core types
export type {
  Primitive,
  DeepPartial,
  DeepReadonly,
  NonNullable,
  StringKeys,
  PathKeys,
  Callback,
  AsyncCallback,
  EventListener,
  EventMap,
  ModuleType,
  BaseModule,
  Language,
  Namespace,
  Key,
  Value,
  LanguageCode,
  NamespaceKey,
  TranslationKey,
  TranslationValue,
  ResourceLanguage,
  ResourceNamespace,
  Resource,
  BaseOptions,
  I18nextError,
  Deferred,
} from './core.js';

export { I18nextBaseError, createDeferred } from './core.js';

// Logger types
export type { LogLevel, LogArgs, LoggerInterface, LoggerOptions } from './logger.js';
export type { LoggerInterface as Logger } from './logger.js';

// Event types
export type {
  EventObservers,
  EventEmitterInterface,
  I18nextEvents,
  EventEmitter,
  EventHandler,
  EventHandlerMap,
  EventSubscription,
  EventEmitterFactory,
  EventContext,
  EventMiddleware,
  EnhancedEventEmitter,
} from './events.js';

// Utility types
export type {
  PathSeparator,
  PathOptions,
  PathResult,
  StringUtilities,
  ObjectUtilities,
  PromiseUtilities,
  RegExpCache,
  PathDetection,
  EntityMap,
  UtilityFunctions,
  UtilityConstants,
  Utils,
  UtilsFactory,
} from './utils.js';

// Main i18next types
export type {
  TFunction,
  TOptions,
  InterpolationOptions,
  FormatFunction,
  InitOptions,
  MissingKeyHandler,
  MissingInterpolationHandler,
  ReturnedObjectHandler,
  ParseMissingKeyHandler,
  OverloadTranslationOptionHandler,
  Services,
  LanguageDetector,
  I18nFormat,
  ServiceUtils,
  BackendModule,
  ReadCallback,
  MultiReadCallback,
  PluralRule,
  Modules,
  I18n,
  CloneOptions,
  I18nState,
  I18nStatic,
} from './i18next.js';

// Export class types that are imported in i18next.ts
export type { default as LanguageUtils } from '../src/LanguageUtils.js';

// Type guards and utilities from core
export { isString, isNumber, isBoolean, isObject, isArray, isFunction, isDefined } from './core.js';

// Also export common module types that tests expect
export type {
  BackendModule as Backend,
  LanguageDetector as LanguageDetectorModule,
  LanguageDetector as LanguageDetectorAsyncModule,
  LoggerInterface as LoggerModule,
  I18nFormat as I18nFormatModule,
  BaseModule as ThirdPartyModule,
  BaseModule as FormatterModule,
} from './i18next.js';

// Export WithT type for components
export interface WithT {
  t: TFunction;
}

// Export interpolator types that some tests expect
export type { default as Interpolator } from '../src/Interpolator.js';
