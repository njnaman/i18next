/**
 * Main i18next type definitions for TypeScript migration
 */

import type {
  BaseModule,
  Callback,
  Language,
  Namespace,
  Resource,
  ResourceLanguage,
  Deferred,
} from './core.js';
import type { EventEmitterInterface } from './events.js';

// Import actual class implementations
import type ResourceStore from '../src/ResourceStore.js';
import type LanguageUtils from '../src/LanguageUtils.js';
import type PluralResolver from '../src/PluralResolver.js';
import type Interpolator from '../src/Interpolator.js';
import type BackendConnector from '../src/BackendConnector.js';
import type Formatter from '../src/Formatter.js';
import type { LoggerInterface } from './logger';

// Translation function types
export interface TFunction {
  (key: string, options?: TOptions): string;

  (key: string, defaultValue?: string, options?: TOptions): string;

  (key: string[], options?: TOptions): string;

  (key: string[], defaultValue?: string, options?: TOptions): string;
}

export interface TOptions {
  lng?: Language;
  lngs?: Language[];
  ns?: Namespace | Namespace[];
  defaultValue?: string;
  count?: number;
  context?: string;
  replace?: Record<string, unknown>;
  interpolation?: InterpolationOptions;
  keySeparator?: string | false;
  nsSeparator?: string | false;
  returnObjects?: boolean;
  joinArrays?: string | false;
  postProcess?: string | string[];
  returnNull?: boolean;
  returnEmptyString?: boolean;
  returnedObjectHandler?: (key: string, value: unknown, options: TOptions) => void;
  parseMissingKeyHandler?: (key: string) => string;
  appendNamespaceToMissingKey?: boolean;
  appendNamespaceToCIMode?: boolean;
}

// Interpolation options
export interface InterpolationOptions {
  escapeValue?: boolean;
  format?: FormatFunction;
  prefix?: string;
  suffix?: string;
  formatSeparator?: string;
  unescapePrefix?: string;
  nestingPrefix?: string;
  nestingSuffix?: string;
  nestingOptionsSeparator?: string;
  maxReplaces?: number;
  skipOnVariables?: boolean;
  defaultVariables?: Record<string, unknown>;
}

// Format function type
export type FormatFunction = (
  value: unknown,
  format?: string,
  lng?: Language,
  options?: Record<string, unknown>,
) => string;

// Init options
export interface InitOptions {
  debug?: boolean;
  initAsync?: boolean;
  lng?: Language;
  fallbackLng?: Language | Language[] | false;
  supportedLngs?: Language[] | false;
  nonExplicitSupportedLngs?: boolean;
  load?: 'all' | 'currentOnly' | 'languageOnly';
  preload?: Language[] | false;
  maxParallelReads?: number;
  maxRetries?: number;
  retryTimeout?: number;
  backend?: Record<string, unknown>;
  ns?: Namespace | Namespace[];
  defaultNS?: Namespace | Namespace[];
  fallbackNS?: Namespace | Namespace[] | false;
  partialBundledLanguages?: boolean;
  saveMissing?: boolean;
  updateMissing?: boolean;
  saveMissingTo?: 'current' | 'all' | 'fallback';
  saveMissingPlurals?: boolean;
  missingKeyHandler?: MissingKeyHandler | false;
  missingInterpolationHandler?: MissingInterpolationHandler | false;
  postProcess?: string | string[] | false;
  postProcessPassResolved?: boolean;
  returnNull?: boolean;
  returnEmptyString?: boolean;
  returnObjects?: boolean;
  joinArrays?: string | false;
  returnedObjectHandler?: ReturnedObjectHandler | false;
  parseMissingKeyHandler?: ParseMissingKeyHandler | false;
  appendNamespaceToMissingKey?: boolean;
  appendNamespaceToCIMode?: boolean;
  overloadTranslationOptionHandler?: OverloadTranslationOptionHandler;
  interpolation?: InterpolationOptions;
  resources?: Resource;
  keySeparator?: string | false;
  nsSeparator?: string | false;
  pluralSeparator?: string;
  contextSeparator?: string;
  simplifyPluralSuffix?: boolean;
  isClone?: boolean;
  userDefinedKeySeparator?: string;
  userDefinedNsSeparator?: string;
  cacheInBuiltFormats?: boolean;
}

// Handler function types
export type MissingKeyHandler = (
  lngs: Language[],
  ns: Namespace,
  key: string,
  fallbackValue: string,
  updateMissing: boolean,
  options: TOptions,
) => void;

export type MissingInterpolationHandler = (str: string, match: RegExpMatchArray) => string;

export type ReturnedObjectHandler = (key: string, value: unknown, options: TOptions) => void;

export type ParseMissingKeyHandler = (key: string) => string;

export type OverloadTranslationOptionHandler = (args: unknown[]) => TOptions;

// Services interface using actual class types
export interface Services {
  logger: LoggerInterface;
  resourceStore: ResourceStore;
  languageUtils: LanguageUtils;
  pluralResolver: PluralResolver;
  interpolator: Interpolator;
  backendConnector: BackendConnector;
  formatter?: Formatter;
  languageDetector?: LanguageDetector;
  i18nFormat?: I18nFormat;
  utils: ServiceUtils;
}

export interface LanguageDetector extends BaseModule {
  type: 'languageDetector';
  async?: boolean;

  init?(
    services: Services,
    detectorOptions: Record<string, unknown>,
    i18nextOptions: InitOptions,
  ): void;

  detect(): Language | Language[] | undefined;

  detect(callback: (lng: Language | Language[] | undefined) => void): void;

  cacheUserLanguage?(lng: Language): void;
}

export interface I18nFormat extends BaseModule {
  type: 'i18nFormat';

  init?(i18next: I18n): void;
}

export interface ServiceUtils {
  hasLoadedNamespace(ns: Namespace): boolean;
}

// Backend module interface
export interface BackendModule extends BaseModule {
  type: 'backend';

  init(
    services: Services,
    backendOptions: Record<string, unknown>,
    i18nextOptions: InitOptions,
  ): void;

  read(language: Language, namespace: Namespace, callback: ReadCallback): void;

  create?(
    languages: Language[],
    namespace: Namespace,
    key: string,
    fallbackValue: string,
    callback?: (err: Error | null, data?: unknown) => void,
    options?: Record<string, unknown>,
  ): void;

  readMulti?(languages: Language[], namespaces: Namespace[], callback: ReadCallback): void;

  save?(language: Language, namespace: Namespace, data: ResourceLanguage): void;
}

// Callback types
export type ReadCallback = (error: string | null, data: ResourceLanguage | boolean | null) => void;
export type MultiReadCallback = (
  error: string | null,
  data: ResourceLanguage | boolean | null,
) => void;

// Plural rule type
export type PluralRule = (count: number, ordinal?: boolean) => number;

// Modules interface using actual class types
export interface Modules {
  backend?: BackendModule;
  logger?: LoggerInterface;
  languageDetector?: LanguageDetector;
  i18nFormat?: I18nFormat;
  formatter?: Formatter;
  external: BaseModule[];
}

// Main I18n class interface using actual class types
export interface I18n extends EventEmitterInterface {
  options: InitOptions;
  services: Services;
  modules: Modules;
  store: ResourceStore;
  language: Language | undefined;
  languages: Language[] | undefined;
  resolvedLanguage?: Language | undefined;
  isInitialized: boolean;
  isInitializing: boolean;
  initializedStoreOnce: boolean;
  initializedLanguageOnce: boolean;
  format: FormatFunction;
  t: TFunction;

  init(options?: InitOptions, callback?: Callback): Deferred<TFunction>;

  init(callback?: Callback): Deferred<TFunction>;

  use(module: BaseModule): this;

  loadResources(language?: Language, callback?: Callback): void;

  reloadResources(
    lngs?: Language | Language[],
    ns?: Namespace | Namespace[],
    callback?: () => void,
  ): Deferred<void>;

  changeLanguage(lng?: Language, callback?: Callback): Deferred<TFunction>;

  getFixedT(
    lng?: Language | Language[],
    ns?: Namespace | Namespace[],
    keyPrefix?: string,
  ): TFunction;

  exists(key: string | string[], options?: TOptions): boolean;

  setDefaultNamespace(ns: Namespace | Namespace[]): void;

  hasLoadedNamespace(
    ns: Namespace | Namespace[],
    options?: {
      lng?: Language;
      precheck?: (
        i18n: I18n,
        loadNotPending: (lng: Language, ns: Namespace) => boolean,
      ) => boolean | undefined;
    },
  ): boolean;

  loadNamespaces(ns: Namespace | Namespace[], callback?: Callback): Deferred<void>;

  loadLanguages(lngs: Language | Language[], callback?: Callback): Deferred<void>;

  dir(lng?: Language): 'ltr' | 'rtl';

  createInstance(options?: InitOptions, callback?: Callback): I18n;

  cloneInstance(options?: CloneOptions, callback?: Callback): I18n;

  toJSON(): I18nState;

  // Resource store methods
  getResource(
    lng: Language,
    ns: Namespace,
    key: string,
    options?: {
      keySeparator?: string;
      ignoreJSONStructure?: boolean;
    },
  ): unknown;

  addResource(
    lng: Language,
    ns: Namespace,
    key: string,
    value: unknown,
    options?: {
      keySeparator?: string;
      silent?: boolean;
    },
  ): this;

  addResources(lng: Language, ns: Namespace, resources: ResourceLanguage): this;

  addResourceBundle(
    lng: Language,
    ns: Namespace,
    resources: ResourceLanguage,
    deep?: boolean,
    overwrite?: boolean,
    options?: { silent?: boolean; skipCopy?: boolean },
  ): this;

  hasResourceBundle(lng: Language, ns: Namespace): boolean;

  getResourceBundle(lng: Language, ns: Namespace): ResourceLanguage | undefined;

  getDataByLanguage(lng: Language): Record<string, ResourceLanguage> | undefined;

  removeResourceBundle(lng: Language, ns: Namespace): this;
}

// Clone options
export interface CloneOptions extends InitOptions {
  forkResourceStore?: boolean;
}

// I18n state for serialization
export interface I18nState {
  options: InitOptions;
  store: Record<string, any>;
  language: Language | undefined;
  languages: Language[] | undefined;
  resolvedLanguage: Language;
}

// Static methods
export interface I18nStatic {
  createInstance(options?: InitOptions, callback?: Callback): I18n;
}
