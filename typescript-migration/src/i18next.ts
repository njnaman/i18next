/**
 * Main i18next implementation for TypeScript migration
 * Complete migration from src/i18next.js (678 lines)
 */

import type {
  I18n as I18nInterface,
  InitOptions,
  TFunction,
  Callback,
  Services,
  Modules,
  BaseModule,
  Language,
  Namespace,
  Deferred,
  CloneOptions,
  I18nState,
  TOptions,
  FormatFunction,
} from '../types';
import type { TranslatorServices, TranslatorOptions } from '../types/core';
import baseLogger from './logger';
import EventEmitter from './EventEmitter';
import ResourceStore from './ResourceStore';
import Translator from './Translator';
import LanguageUtils from './LanguageUtils';
import PluralResolver from './PluralResolver';
import Interpolator from './Interpolator';
import Formatter from './Formatter';
import BackendConnector from './BackendConnector';
import { get as getDefaults, transformOptions } from './defaults';
import postProcessor from './postProcessor';
import { defer, isString, noop } from './utils';

// Binds the member functions of the given class instance so that they can be
// destructured or used as callbacks.
function bindMemberFunctions(inst: I18n): void {
  const mems = Object.getOwnPropertyNames(Object.getPrototypeOf(inst));
  mems.forEach(mem => {
    // Skip if it's a getter/setter or other property descriptor
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inst), mem);
    if (descriptor && (descriptor.get || descriptor.set)) {
      return; // Skip getters/setters
    }

    const member = (inst as unknown as Record<string, unknown>)[mem];
    if (typeof member === 'function') {
      (inst as unknown as Record<string, unknown>)[mem] = (
        member as (...args: unknown[]) => unknown
      ).bind(inst);
    }
  });
}

class I18n extends EventEmitter implements I18nInterface {
  private _options: InitOptions = {};
  private _services: Services = {} as Services;
  private _modules: Modules = { external: [] };
  private _store: I18nInterface['store'];
  private _language: Language = '';
  private _languages: Language[] = [];
  private _resolvedLanguage?: Language | undefined;
  private _isInitialized: boolean = false;
  private _isInitializing: boolean = false;
  private _initializedStoreOnce: boolean = false;
  private _initializedLanguageOnce: boolean = false;
  private _format: FormatFunction = (value: unknown) => String(value);
  private translator: Translator;
  private isLanguageChangingTo?: Language | undefined;

  constructor(options: InitOptions = {}, callback?: Callback) {
    super();

    this._options = transformOptions(options);
    this._services = {} as Services;
    this._modules = { external: [] };

    // Initialize store and translator to avoid definite assignment errors
    this._store = new ResourceStore() as I18nInterface['store'];
    this.translator = new Translator({} as TranslatorServices, {} as TranslatorOptions);

    bindMemberFunctions(this);

    if (callback && !this._isInitialized && !options.isClone) {
      // https://github.com/i18next/i18next/issues/879
      if (!this._options.initAsync) {
        this.init(options, callback);
        return;
      }
      setTimeout(() => {
        this.init(options, callback);
      }, 0);
    }
  }

  // Readonly getters for interface compliance
  get options(): InitOptions {
    return this._options;
  }
  get services(): Services {
    return this._services;
  }
  get logger(): typeof baseLogger {
    return baseLogger;
  }
  get modules(): Modules {
    return this._modules;
  }
  get store(): I18nInterface['store'] {
    return this._store;
  }
  get language(): Language {
    return this._language;
  }
  get languages(): Language[] {
    return this._languages;
  }
  get resolvedLanguage(): Language | undefined {
    return this._resolvedLanguage;
  }
  get isInitialized(): boolean {
    return this._isInitialized;
  }
  get isInitializing(): boolean {
    return this._isInitializing;
  }
  get initializedStoreOnce(): boolean {
    return this._initializedStoreOnce;
  }
  get initializedLanguageOnce(): boolean {
    return this._initializedLanguageOnce;
  }
  get format(): FormatFunction {
    return this._format;
  }

  init(options?: InitOptions, callback?: Callback): Deferred<TFunction>;
  init(callback?: Callback): Deferred<TFunction>;
  init(optionsOrCallback?: InitOptions | Callback, callback?: Callback): Deferred<TFunction> {
    this._isInitializing = true;

    let actualOptions: InitOptions = {};
    let actualCallback: Callback = noop;

    if (typeof optionsOrCallback === 'function') {
      actualCallback = optionsOrCallback;
      actualOptions = {};
    } else if (optionsOrCallback) {
      actualOptions = optionsOrCallback;
      actualCallback = callback || noop;
    } else {
      actualCallback = callback || noop;
    }

    // Handle defaultNS assignment with mutable copy
    const mutableOptions = { ...actualOptions };
    if (mutableOptions.defaultNS == null && mutableOptions.ns) {
      if (isString(mutableOptions.ns)) {
        mutableOptions.defaultNS = mutableOptions.ns;
      } else if (Array.isArray(mutableOptions.ns) && mutableOptions.ns.indexOf('translation') < 0) {
        mutableOptions.defaultNS = mutableOptions.ns[0] || 'translation';
      }
    }

    const defOpts = getDefaults();
    this._options = { ...defOpts, ...this._options, ...transformOptions(mutableOptions) };

    // Handle interpolation with mutable assignment
    const mutableInterpolation = { ...defOpts.interpolation, ...this._options.interpolation };
    (this._options as InitOptions & { interpolation: typeof mutableInterpolation }).interpolation =
      mutableInterpolation;

    if (mutableOptions.keySeparator !== undefined) {
      if (typeof mutableOptions.keySeparator === 'string') {
        (
          this._options as InitOptions & { userDefinedKeySeparator: string }
        ).userDefinedKeySeparator = mutableOptions.keySeparator;
      }
    }
    if (mutableOptions.nsSeparator !== undefined) {
      if (typeof mutableOptions.nsSeparator === 'string') {
        (this._options as InitOptions & { userDefinedNsSeparator: string }).userDefinedNsSeparator =
          mutableOptions.nsSeparator;
      }
    }

    const createClassOnDemand = (ClassOrObject: any): any => {
      if (!ClassOrObject) return null;
      if (typeof ClassOrObject === 'function') return new ClassOrObject();
      return ClassOrObject;
    };

    // init services
    if (!this._options.isClone) {
      if (this._modules.logger) {
        baseLogger.init(createClassOnDemand(this._modules.logger), this._options);
      } else {
        baseLogger.init(null, this._options);
      }

      let formatter: any;
      if (this._modules.formatter) {
        formatter = this._modules.formatter;
      } else {
        formatter = Formatter;
      }

      const lu = new LanguageUtils(this._options);

      this._store = new ResourceStore(
        this._options.resources,
        this._options as any,
      ) as I18nInterface['store'];

      const s = this._services as any;
      s.logger = baseLogger;
      s.resourceStore = this._store;
      s.languageUtils = lu;
      s.pluralResolver = new PluralResolver(
        lu as any,
        {
          prepend: this._options.pluralSeparator,
          simplifyPluralSuffix: this._options.simplifyPluralSuffix,
        } as any,
      );

      const usingLegacyFormatFunction =
        this._options.interpolation?.format &&
        this._options.interpolation.format !== defOpts.interpolation?.format;
      if (usingLegacyFormatFunction) {
        baseLogger.warn(
          `init: you are still using the legacy format function, please use the new approach: https://www.i18next.com/translation-function/formatting`,
        );
      }

      if (
        formatter &&
        (!this._options.interpolation?.format ||
          this._options.interpolation.format === defOpts.interpolation?.format)
      ) {
        s.formatter = createClassOnDemand(formatter);
        if (s.formatter?.init) s.formatter.init(s, this._options);
        if (this._options.interpolation && s.formatter?.format) {
          (this._options.interpolation as any).format = s.formatter.format.bind(s.formatter);
        }
      }

      s.interpolator = new Interpolator(this._options as any);
      s.utils = {
        hasLoadedNamespace: this.hasLoadedNamespace.bind(this),
      };

      s.backendConnector = new BackendConnector(
        createClassOnDemand(this._modules.backend),
        s.resourceStore,
        s,
        this._options,
      );
      // pipe events from backendConnector
      s.backendConnector.on('*', (...args: unknown[]) => {
        this.emit(args[0] as string, ...args.slice(1));
      });

      if (this._modules.languageDetector) {
        s.languageDetector = createClassOnDemand(this._modules.languageDetector);
        if (s.languageDetector?.init)
          s.languageDetector.init(s, (this._options as any).detection, this._options);
      }

      if (this._modules.i18nFormat) {
        s.i18nFormat = createClassOnDemand(this._modules.i18nFormat);
        if (s.i18nFormat?.init) s.i18nFormat.init(this);
      }

      this.translator = new Translator(
        this._services as unknown as TranslatorServices,
        this._options as unknown as TranslatorOptions,
      );
      // pipe events from translator
      this.translator.on('*', (...args: unknown[]) => {
        this.emit(args[0] as string, ...args.slice(1));
      });

      this._modules.external.forEach(m => {
        if ((m as any).init) (m as any).init(this);
      });
    }

    this._format = this._options.interpolation?.format || ((value: unknown) => String(value));
    if (!actualCallback) actualCallback = noop;

    if (this._options.fallbackLng && !this._services.languageDetector && !this._options.lng) {
      const codes = this._services.languageUtils.getFallbackCodes(this._options.fallbackLng);
      if (codes.length > 0 && codes[0] !== 'dev') {
        (this._options as any).lng = codes[0];
      }
    }
    if (!this._services.languageDetector && !this._options.lng) {
      baseLogger.warn('init: no languageDetector is used and no lng is defined');
    }

    // append api
    const storeApi = ['getResource', 'hasResourceBundle', 'getResourceBundle', 'getDataByLanguage'];
    storeApi.forEach((fcName: string) => {
      (this as any)[fcName] = (...args: unknown[]) => (this._store as any)[fcName](...args);
    });
    const storeApiChained = [
      'addResource',
      'addResources',
      'addResourceBundle',
      'removeResourceBundle',
    ];
    storeApiChained.forEach((fcName: string) => {
      (this as any)[fcName] = (...args: unknown[]) => {
        (this._store as any)[fcName](...args);
        return this;
      };
    });

    const deferred = defer<TFunction>();

    const load = (): void => {
      const finish = (err: Error | null, t?: TFunction): void => {
        this._isInitializing = false;
        if (this._isInitialized && !this._initializedStoreOnce)
          baseLogger.warn('init: i18next is already initialized. You should call init just once!');
        this._isInitialized = true;
        if (!this._options.isClone) baseLogger.log('initialized', this._options);
        this.emit('initialized', this._options);

        const tFunction = t || this.t;
        deferred.resolve(tFunction);
        actualCallback(err || null, undefined);
      };
      // fix for use cases when calling changeLanguage before finished to initialized (i.e. https://github.com/i18next/i18next/issues/1552)
      if (this._languages && !this._isInitialized) return finish(null, this.t);
      this.changeLanguage(this._options.lng, finish as any);
    };

    if (this._options.resources || !this._options.initAsync) {
      load();
    } else {
      setTimeout(load, 0);
    }

    return deferred;
  }

  /* eslint consistent-return: 0 */
  loadResources(language?: Language | Callback, callback: Callback = noop): void {
    let usedCallback = callback;
    const usedLng = isString(language) ? (language as Language) : this._language;
    if (typeof language === 'function') usedCallback = language;

    if (!this._options.resources || this._options.partialBundledLanguages) {
      if (
        usedLng?.toLowerCase() === 'cimode' &&
        (!this._options.preload || this._options.preload.length === 0)
      ) {
        return usedCallback(null, undefined);
      }

      const toLoad: Language[] = [];

      const append = (lng?: Language): void => {
        if (!lng) return;
        if (lng === 'cimode') return;
        const lngs = this._services.languageUtils.toResolveHierarchy(lng);
        lngs.forEach(l => {
          if (l === 'cimode') return;
          if (toLoad.indexOf(l) < 0) toLoad.push(l);
        });
      };

      if (!usedLng) {
        // at least load fallbacks in this case
        const fallbacks = this._services.languageUtils.getFallbackCodes(
          this._options.fallbackLng || [],
        );
        fallbacks.forEach(l => append(l));
      } else {
        append(usedLng);
      }

      if (Array.isArray(this._options.preload)) {
        this._options.preload.forEach((l: Language) => append(l));
      }

      const nsArray = Array.isArray(this._options.ns)
        ? this._options.ns
        : this._options.ns
          ? [this._options.ns]
          : [];
      this._services.backendConnector.load(toLoad, nsArray, (errors?: Error[]) => {
        const e = errors && errors.length > 0 ? errors[0] : null;
        if (!e && !this._resolvedLanguage && this._language)
          this.setResolvedLanguage(this._language);
        usedCallback(e || null, undefined);
      });
    } else {
      usedCallback(null, undefined);
    }
  }

  reloadResources(
    lngs?: Language | Language[] | Callback,
    ns?: Namespace | Namespace[] | Callback,
    callback?: Callback,
  ): Deferred<void> {
    const deferred = defer<void>();
    let actualLngs = lngs;
    let actualNs = ns;
    let actualCallback = callback;

    if (typeof lngs === 'function') {
      actualCallback = lngs;
      actualLngs = undefined;
    }
    if (typeof ns === 'function') {
      actualCallback = ns;
      actualNs = undefined;
    }
    if (!actualLngs) actualLngs = this._languages;
    if (!actualNs) actualNs = this._options.ns;
    if (!actualCallback) actualCallback = noop;

    const lngsArray = Array.isArray(actualLngs)
      ? (actualLngs as Language[])
      : actualLngs
        ? [actualLngs as Language]
        : [];
    const nsArray = Array.isArray(actualNs)
      ? (actualNs as Namespace[])
      : actualNs
        ? [actualNs as Namespace]
        : [];

    this._services.backendConnector.reload(lngsArray, nsArray, (errors?: Error[]) => {
      const err = errors && errors.length > 0 ? errors[0] : null;
      deferred.resolve();
      if (actualCallback) actualCallback(err || null, undefined);
    });
    return deferred;
  }

  use(module: BaseModule): this {
    if (!module)
      throw new Error(
        'You are passing an undefined module! Please check the object you are passing to i18next.use()',
      );
    if (!module.type)
      throw new Error(
        'You are passing a wrong module! Please check the object you are passing to i18next.use()',
      );

    const mutableModules = this._modules as any;

    if (module.type === 'backend') {
      mutableModules.backend = module;
    }

    if (module.type === 'logger' || ('log' in module && 'warn' in module && 'error' in module)) {
      mutableModules.logger = module;
    }

    if (module.type === 'languageDetector') {
      mutableModules.languageDetector = module;
    }

    if (module.type === 'i18nFormat') {
      mutableModules.i18nFormat = module;
    }

    if (module.type === 'postProcessor') {
      postProcessor.addPostProcessor(module as any);
    }

    if (module.type === 'formatter') {
      mutableModules.formatter = module;
    }

    if (module.type === '3rdParty') {
      mutableModules.external.push(module);
    }

    return this;
  }

  setResolvedLanguage(l?: Language): void {
    if (!l || !this._languages) return;
    if (['cimode', 'dev'].indexOf(l) > -1) return;
    for (let li = 0; li < this._languages.length; li++) {
      const lngInLngs = this._languages[li];
      if (!lngInLngs || ['cimode', 'dev'].indexOf(lngInLngs) > -1) continue;
      if ((this._store as any).hasLanguageSomeTranslations(lngInLngs)) {
        this._resolvedLanguage = lngInLngs;
        break;
      }
    }
    if (
      !this._resolvedLanguage &&
      this._languages.indexOf(l) < 0 &&
      (this._store as any).hasLanguageSomeTranslations(l)
    ) {
      this._resolvedLanguage = l;
      (this._languages as Language[]).unshift(l);
    }
  }

  changeLanguage(lng?: Language, callback?: Callback): Deferred<TFunction> {
    this.isLanguageChangingTo = lng;
    const deferred = defer<TFunction>();
    this.emit('languageChanging', lng);

    const setLngProps = (l: Language): void => {
      this._language = l;
      this._languages = [...this._services.languageUtils.toResolveHierarchy(l)];
      // find the first language resolved language
      this._resolvedLanguage = undefined;
      this.setResolvedLanguage(l);
    };

    const done = (err?: Error | null, l?: Language): void => {
      if (l) {
        if (this.isLanguageChangingTo === lng) {
          setLngProps(l);
          this.translator.changeLanguage(l);
          this.isLanguageChangingTo = undefined;
          this.emit('languageChanged', l);
          baseLogger.log('languageChanged', l);
        }
      } else {
        this.isLanguageChangingTo = undefined;
      }

      deferred.resolve(this.t);
      if (callback) callback(err || null, undefined);
    };

    const setLng = (lngs?: Language | Language[]): void => {
      // if detected lng is falsy, set it to empty array, to make sure at least the fallbackLng will be used
      if (!lng && !lngs && this._services.languageDetector) lngs = [];
      // depending on API in detector lng can be a string (old) or an array of languages ordered in priority
      const fl = isString(lngs) ? (lngs as Language) : (lngs as Language[])?.[0];
      const l =
        fl && (this._store as any).hasLanguageSomeTranslations(fl)
          ? fl
          : this._services.languageUtils.getBestMatchFromCodes(
              isString(lngs) ? [lngs as Language] : (lngs as Language[]),
            );

      if (l) {
        if (!this._language) {
          setLngProps(l);
        }
        if (!this.translator.language) this.translator.changeLanguage(l);

        (this._services.languageDetector as any)?.cacheUserLanguage?.(l);
      }

      this.loadResources(l || '', (err?: Error | null) => {
        done(err, l || '');
      });
    };

    if (
      !lng &&
      this._services.languageDetector &&
      !(this._services.languageDetector as any).async
    ) {
      setLng((this._services.languageDetector as any).detect());
    } else if (
      !lng &&
      this._services.languageDetector &&
      (this._services.languageDetector as any).async
    ) {
      if ((this._services.languageDetector as any).detect.length === 0) {
        (this._services.languageDetector as any).detect().then(setLng);
      } else {
        (this._services.languageDetector as any).detect(setLng);
      }
    } else {
      setLng(lng);
    }

    return deferred;
  }

  getFixedT(
    lng?: Language | Language[],
    ns?: Namespace | Namespace[],
    keyPrefix?: string,
  ): TFunction {
    const fixedT = (
      key: string | string[],
      opts?: TOptions | string,
      ...rest: unknown[]
    ): string => {
      let o: any;
      if (typeof opts !== 'object') {
        o = this._options.overloadTranslationOptionHandler?.([key, opts].concat(rest as any)) || {};
      } else {
        o = { ...opts };
      }

      o.lng = o.lng || (fixedT as any).lng;
      o.lngs = o.lngs || (fixedT as any).lngs;
      o.ns = o.ns || (fixedT as any).ns;
      if (o.keyPrefix !== '') o.keyPrefix = o.keyPrefix || keyPrefix || (fixedT as any).keyPrefix;

      const keySeparator = this._options.keySeparator || '.';
      let resultKey: string | string[];
      if (o.keyPrefix && Array.isArray(key)) {
        resultKey = key.map(k => `${o.keyPrefix}${keySeparator}${k}`);
      } else {
        resultKey = o.keyPrefix ? `${o.keyPrefix}${keySeparator}${key}` : key;
      }
      return this.t(Array.isArray(resultKey) ? resultKey : [resultKey], o);
    };
    if (isString(lng)) {
      (fixedT as any).lng = lng;
    } else {
      (fixedT as any).lngs = lng;
    }
    (fixedT as any).ns = ns;
    (fixedT as any).keyPrefix = keyPrefix;
    return fixedT as TFunction;
  }

  t(...args: any[]): any {
    return (this.translator as any)?.translate?.(...args);
  }

  exists(...args: any[]): boolean {
    return (this.translator as any)?.exists?.(...args) || false;
  }

  setDefaultNamespace(ns: Namespace | Namespace[]): void {
    (this._options as any).defaultNS = ns;
  }

  hasLoadedNamespace(
    ns: Namespace | Namespace[],
    options: {
      lng?: Language;
      precheck?: (
        i18n: I18nInterface,
        loadNotPending: (lng: Language, ns: Namespace) => boolean,
      ) => boolean | undefined;
    } = {},
  ): boolean {
    if (!this._isInitialized) {
      baseLogger.warn('hasLoadedNamespace: i18next was not initialized', this._languages);
      return false;
    }
    if (!this._languages || !this._languages.length) {
      baseLogger.warn(
        'hasLoadedNamespace: i18n.languages were undefined or empty',
        this._languages,
      );
      return false;
    }

    const lng = options.lng || this._resolvedLanguage || this._languages[0];
    const fallbackLng = this._options ? this._options.fallbackLng : false;
    const lastLng = this._languages[this._languages.length - 1];

    // we're in cimode so this shall pass
    if (lng?.toLowerCase() === 'cimode') return true;

    const loadNotPending = (l: Language, n: Namespace): boolean => {
      const loadState = this._services.backendConnector.state[`${l}|${n}`];
      return loadState === -1 || loadState === 0 || loadState === 2;
    };

    // optional injected check
    if (options.precheck) {
      const preResult = options.precheck(this as unknown as I18nInterface, loadNotPending);
      if (preResult !== undefined) return preResult;
    }

    // Handle both single namespace and array of namespaces
    const namespacesToCheck = Array.isArray(ns) ? ns : [ns];

    // Check if all namespaces are loaded
    for (const namespace of namespacesToCheck) {
      // loaded -> SUCCESS
      if ((this as any).hasResourceBundle(lng!, namespace)) continue;

      // were not loading at all -> SEMI SUCCESS
      if (
        !this._services.backendConnector.backend ||
        (this._options.resources && !this._options.partialBundledLanguages)
      )
        continue;

      // failed loading ns - but at least fallback is not pending -> SEMI SUCCESS
      if (loadNotPending(lng!, namespace) && (!fallbackLng || loadNotPending(lastLng!, namespace)))
        continue;

      // If any namespace is not loaded, return false
      return false;
    }

    return true;
  }

  loadNamespaces(ns: Namespace | Namespace[], callback?: Callback): Deferred<void> {
    const deferred = defer<void>();

    if (!this._options.ns) {
      if (callback) callback(null, undefined);
      return Promise.resolve() as any;
    }
    let actualNs = isString(ns) ? [ns] : [...ns];

    actualNs.forEach((n: Namespace) => {
      if (this._options.ns && this._options.ns.indexOf(n) < 0)
        (this._options.ns as Namespace[]).push(n);
    });

    this.loadResources((err?: Error | null) => {
      deferred.resolve();
      if (callback) callback(err || null, undefined);
    });

    return deferred;
  }

  loadLanguages(lngs: Language | Language[], callback?: Callback): Deferred<void> {
    const deferred = defer<void>();

    const actualLngs = isString(lngs) ? [lngs] : [...lngs];
    const preloaded = this._options.preload || [];

    const newLngs = actualLngs.filter(
      lng => preloaded.indexOf(lng) < 0 && this._services.languageUtils.isSupportedCode(lng),
    );
    // Exit early if all given languages are already preloaded
    if (!newLngs.length) {
      if (callback) callback(null, undefined);
      return Promise.resolve() as any;
    }

    (this._options as any).preload = preloaded.concat(newLngs);
    this.loadResources((err?: Error | null) => {
      deferred.resolve();
      if (callback) callback(err || null, undefined);
    });

    return deferred;
  }

  dir(lng?: Language): 'ltr' | 'rtl' {
    const actualLng =
      lng ||
      this._resolvedLanguage ||
      (this._languages?.length > 0 ? this._languages[0] : this._language);
    if (!actualLng) return 'rtl';

    try {
      const l = new Intl.Locale(actualLng);
      if (l && (l as any).getTextInfo) {
        const ti = (l as any).getTextInfo();
        if (ti && ti.direction) return ti.direction;
      }
    } catch (e) {
      /* fall through */
    }

    const rtlLngs = [
      'ar',
      'shu',
      'sqr',
      'ssh',
      'xaa',
      'yhd',
      'yud',
      'aao',
      'abh',
      'abv',
      'acm',
      'acq',
      'acw',
      'acx',
      'acy',
      'adf',
      'ads',
      'aeb',
      'aec',
      'afb',
      'ajp',
      'apc',
      'apd',
      'arb',
      'arq',
      'ars',
      'ary',
      'arz',
      'auz',
      'avl',
      'ayh',
      'ayl',
      'ayn',
      'ayp',
      'bbz',
      'pga',
      'he',
      'iw',
      'ps',
      'pbt',
      'pbu',
      'pst',
      'prp',
      'prd',
      'ug',
      'ur',
      'ydd',
      'yds',
      'yih',
      'ji',
      'yi',
      'hbo',
      'men',
      'xmn',
      'fa',
      'jpr',
      'peo',
      'pes',
      'prs',
      'dv',
      'sam',
      'ckb',
    ];

    const languageUtils = this._services?.languageUtils || new LanguageUtils(getDefaults()); // for uninitialized usage
    if (actualLng.toLowerCase().indexOf('-latn') > 1) return 'ltr';

    return rtlLngs.indexOf(languageUtils.getLanguagePartFromCode(actualLng)) > -1 ||
      actualLng.toLowerCase().indexOf('-arab') > 1
      ? 'rtl'
      : 'ltr';
  }

  createInstance(options: InitOptions = {}, callback?: Callback): I18nInterface {
    return new I18n(options, callback) as unknown as I18nInterface;
  }

  cloneInstance(options: CloneOptions = {}, callback: Callback = noop): I18nInterface {
    const forkResourceStore = options.forkResourceStore;
    if (forkResourceStore) delete (options as any).forkResourceStore;
    const mergedOptions = { ...this._options, ...options, ...{ isClone: true } };
    const clone = new I18n(mergedOptions);
    if (options.debug !== undefined || (options as any).prefix !== undefined) {
      (clone as any).logger = (clone as any).logger.clone(options);
    }
    const membersToCopy = ['store', 'services', 'language'];
    membersToCopy.forEach(m => {
      (clone as any)[`_${m}`] = (this as any)[`_${m}`];
    });
    (clone as any)._services = { ...this._services };
    (clone as any)._services.utils = {
      hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone),
    };
    if (forkResourceStore) {
      // faster than const clonedData = JSON.parse(JSON.stringify(this.store.data))
      const clonedData = Object.keys((this._store as any).data).reduce((prev: any, l) => {
        prev[l] = { ...(this._store as any).data[l] };
        prev[l] = Object.keys(prev[l]).reduce((acc: any, n) => {
          acc[n] = { ...prev[l][n] };
          return acc;
        }, prev[l]);
        return prev;
      }, {});
      (clone as any)._store = new ResourceStore(
        clonedData,
        mergedOptions as any,
      ) as I18nInterface['store'];
      (clone as any)._services.resourceStore = (clone as any)._store;
    }
    (clone as any).translator = new Translator(
      (clone as any)._services as unknown as TranslatorServices,
      mergedOptions as unknown as TranslatorOptions,
    );
    (clone as any).translator.on('*', (...args: unknown[]) => {
      clone.emit(args[0] as string, ...args.slice(1));
    });
    clone.init(mergedOptions, callback);
    (clone as any).translator.options = mergedOptions; // sync options
    ((clone as any).translator as any).backendConnector.services.utils = {
      hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone),
    };

    return clone as unknown as I18nInterface;
  }

  // Required interface methods
  toJSON(): I18nState {
    return {
      options: this._options,
      store: (this._store as any).data,
      language: this._language,
      languages: [...this._languages],
      resolvedLanguage: this._resolvedLanguage || '',
    };
  }

  // Resource store methods (delegated)
  getResource(
    lng: Language,
    ns: Namespace,
    key: string,
    options?: { keySeparator?: string; ignoreJSONStructure?: boolean },
  ): unknown {
    return (this._store as any).getResource(lng, ns, key, options);
  }

  addResource(
    lng: Language,
    ns: Namespace,
    key: string,
    value: unknown,
    options?: { keySeparator?: string; silent?: boolean },
  ): this {
    (this._store as any).addResource(lng, ns, key, value, options);
    return this;
  }

  addResources(lng: Language, ns: Namespace, resources: any): this {
    (this._store as any).addResources(lng, ns, resources);
    return this;
  }

  addResourceBundle(
    lng: Language,
    ns: Namespace,
    resources: any,
    deep?: boolean,
    overwrite?: boolean,
    options?: { silent?: boolean; skipCopy?: boolean },
  ): this {
    (this._store as any).addResourceBundle(lng, ns, resources, deep, overwrite, options);
    return this;
  }

  hasResourceBundle(lng: Language, ns: Namespace): boolean {
    return (this._store as any).hasResourceBundle(lng, ns);
  }

  getResourceBundle(lng: Language, ns: Namespace): any {
    return (this._store as any).getResourceBundle(lng, ns);
  }

  getDataByLanguage(lng: Language): Record<string, any> | undefined {
    return (this._store as any).getDataByLanguage(lng);
  }

  removeResourceBundle(lng: Language, ns: Namespace): this {
    (this._store as any).removeResourceBundle(lng, ns);
    return this;
  }
}

const instance = new I18n();

// Add createInstance method to the instance
(instance as any).createInstance = (options?: InitOptions, callback?: Callback) =>
  new I18n(options, callback);

export default instance as unknown as I18nInterface;
