/**
 * Core type definitions for i18next TypeScript migration
 */

// Basic utility types
export type Primitive = string | number | boolean | null | undefined;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type NonNullable<T> = T extends null | undefined ? never : T;

// String manipulation types
export type StringKeys<T> = Extract<keyof T, string>;

export type PathKeys<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, unknown>
    ? T[K] extends unknown[]
      ? K | `${K}.${PathKeys<T[K], Exclude<keyof T[K], keyof unknown[]>>}`
      : K | `${K}.${PathKeys<T[K], keyof T[K]>}`
    : K
  : never;

// Function types
export type Callback<T = void> = (error: Error | null, result?: T) => void;

export type AsyncCallback<T = void> = (error: Error | null, result?: T) => void | Promise<void>;

// Event types
export type EventListener<T extends unknown[] = unknown[]> = (...args: T) => void;

export type EventMap = Record<string, EventListener>;

// Module types
export type ModuleType =
  | 'backend'
  | 'logger'
  | 'languageDetector'
  | 'postProcessor'
  | 'i18nFormat'
  | 'formatter'
  | '3rdParty';

export interface BaseModule {
  type: ModuleType;
}

// Language and namespace types
export type Language = string;
export type Namespace = string;
export type Key = string;
export type Value = string;

export type LanguageCode = string;
export type NamespaceKey = string;
export type TranslationKey = string;
export type TranslationValue = string | Record<string, unknown> | number;

// Resource types
export interface ResourceLanguage {
  [key: string]: TranslationValue;
}

export interface ResourceNamespace {
  [namespace: string]: ResourceLanguage;
}

export interface Resource {
  [language: string]: ResourceNamespace;
}

// Options types
export interface BaseOptions {
  debug?: boolean;
  lng?: Language;
  fallbackLng?: Language | Language[] | false;
  ns?: Namespace | Namespace[];
  defaultNS?: Namespace | Namespace[];
}

// Error types
export interface I18nextError extends Error {
  code?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

export class I18nextBaseError extends Error implements I18nextError {
  public code?: string | undefined;
  public details?: Record<string, unknown> | undefined;

  constructor(message: string, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'I18nextError';
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, I18nextBaseError);
    }
  }
}

// Utility type guards
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

// Promise utility types
export interface Deferred<T> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  }) as Deferred<T>;

  promise.resolve = resolve;
  promise.reject = reject;

  return promise;
}

// LanguageUtils types
export interface LanguageUtilsOptions {
  supportedLngs?: string[] | false;
  load?: 'languageOnly' | 'currentOnly' | 'all';
  nonExplicitSupportedLngs?: boolean;
  lowerCaseLng?: boolean;
  cleanCode?: boolean;
  fallbackLng?: string | string[] | false | ((code?: string) => string | string[] | false);
}

export type FallbackLng =
  | string
  | string[]
  | false
  | ((code?: string) => string | string[] | false);

export interface FallbackLngObject {
  [key: string]: string | string[] | undefined;

  default?: string | string[];
}

// ResourceStore types
export interface ResourceStoreOptions {
  ns?: string[];
  defaultNS?: string;
  keySeparator?: string | false;
  ignoreJSONStructure?: boolean;
}

export interface ResourceStoreData {
  [language: string]: {
    [namespace: string]: ResourceLanguage;
  };
}

export interface AddResourceOptions {
  silent?: boolean;
  keySeparator?: string | false;
}

export interface AddResourceBundleOptions {
  silent?: boolean;
  skipCopy?: boolean;
}

export interface GetResourceOptions {
  keySeparator?: string | false;
  ignoreJSONStructure?: boolean;
}

// Translator types
export interface TranslatorServices extends Record<string, unknown> {
  resourceStore?: unknown;
  languageUtils?: unknown;
  pluralResolver?: unknown;
  interpolator?: unknown;
  backendConnector?: unknown;
  i18nFormat?: unknown;
  utils?: unknown;
}

export interface TranslatorOptions {
  keySeparator?: string | false;
  nsSeparator?: string;
  defaultNS?: string | string[];
  ns?: string[];
  fallbackNS?: string[];
  fallbackLng?: string | string[] | false;
  returnObjects?: boolean;
  returnDetails?: boolean;
  joinArrays?: string;
  postProcess?: string | string[];
  interpolation?: {
    defaultVariables?: Record<string, unknown>;
    skipOnVariables?: boolean;
  };
  missingKeyHandler?: (
    lng: string,
    ns: string,
    key: string,
    fallbackValue: string,
    updateMissing: boolean,
    options: TranslateOptions,
  ) => void;
  saveMissing?: boolean;
  saveMissingTo?: 'current' | 'all' | 'fallback';
  saveMissingPlurals?: boolean;
  missingKeyNoValueFallbackToKey?: boolean;
  updateMissing?: boolean;
  returnNull?: boolean;
  returnEmptyString?: boolean;
  appendNamespaceToMissingKey?: boolean;
  appendNamespaceToCIMode?: boolean;
  parseMissingKeyHandler?: (
    key: string,
    defaultValue?: string,
    options?: TranslateOptions,
  ) => string;
  returnedObjectHandler?: (key: string, value: unknown, options: TranslateOptions) => string;
  pluralSeparator?: string;
  contextSeparator?: string;
  userDefinedKeySeparator?: boolean;
  userDefinedNsSeparator?: boolean;
  overloadTranslationOptionHandler?: (args: unknown[]) => TranslateOptions;
  postProcessPassResolved?: boolean;
}

export interface TranslateOptions {
  defaultValue?: string | undefined;
  count?: number;
  ordinal?: boolean;
  context?: string | number;
  replace?: Record<string, unknown>;
  lng?: string;
  lngs?: string[];
  fallbackLng?: string | string[] | false;
  ns?: string | string[];
  keySeparator?: string | false;
  nsSeparator?: string;
  returnObjects?: boolean;
  returnDetails?: boolean;
  joinArrays?: string | false;
  postProcess?: string | string[];
  interpolation?: {
    skipOnVariables?: boolean;
    defaultVariables?: Record<string, unknown>;
  };
  nest?: boolean;
  missingKeyNoValueFallbackToKey?: boolean;
  applyPostProcessor?: boolean;
  skipInterpolation?: boolean;

  [key: string]: unknown; // For dynamic defaultValue properties
}

export interface TranslationResult {
  res: string;
  usedKey: string;
  exactUsedKey: string;
  usedLng: string;
  usedNS: string;
  usedParams: Record<string, unknown>;
}

export interface ResolveResult {
  res: TranslationValue | undefined;
  usedKey: string;
  exactUsedKey: string;
  usedLng: string;
  usedNS: string;
  usedParams?: Record<string, unknown>;
}
