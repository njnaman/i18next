import baseLogger from './logger';
import EventEmitter from './EventEmitter';
import postProcessor from './postProcessor';
import { copy as utilsCopy, looksLikeObjectPath, isString } from './utils';
import type {
  TranslatorServices,
  TranslatorOptions,
  TranslateOptions,
  TranslationResult,
  ResolveResult,
  TranslationValue,
} from '../types/core';
import LanguageUtils from './LanguageUtils';
import type { LoggerInterface } from '../types/logger';
import type PluralResolver from './PluralResolver';
import ResourceStore from './ResourceStore';

const checkedLoadedFor: Record<string, boolean> = {};

const shouldHandleAsObject = (res: unknown): boolean =>
  !isString(res) && typeof res !== 'boolean' && typeof res !== 'number';

/**
 * Core translation class that handles key resolution, interpolation, and formatting
 */
class Translator extends EventEmitter {
  public options: TranslatorOptions;
  public language?: string;
  private logger: LoggerInterface;

  // Service dependencies (copied from services)
  public resourceStore?: ResourceStore;
  public languageUtils?: LanguageUtils;
  public pluralResolver?: PluralResolver;
  public interpolator?: {
    nestingRegexp: RegExp;
    init: (options: TranslateOptions) => void;
    reset: () => void;
    interpolate: (
      str: string,
      data: Record<string, unknown>,
      lng: string,
      options: TranslateOptions,
    ) => string;
    nest: (
      str: string,
      fc: (...args: unknown[]) => string | null,
      options: TranslateOptions,
    ) => string;
  };
  public backendConnector?: {
    saveMissing?: (
      lng: string,
      ns: string,
      key: string,
      fallbackValue: string,
      updateMissing: boolean,
      options: TranslateOptions,
    ) => void;
  };
  public i18nFormat?: {
    handleAsObject?: boolean;
    parse?: (
      res: string,
      options: Record<string, unknown>,
      lng: string,
      ns: string,
      key: string,
      info: {
        resolved: ResolveResult;
      },
    ) => string;
    addLookupKeys?: (
      finalKeys: string[],
      key: string,
      code: string,
      ns: string,
      options: TranslateOptions,
    ) => void;
    getResource?: (
      code: string,
      ns: string,
      key: string,
      options: Record<string, unknown>,
    ) => TranslationValue | undefined;
  };
  public utils?: {
    hasLoadedNamespace?: (ns: string) => boolean;
  };

  constructor(services: TranslatorServices, options: TranslatorOptions = {}) {
    super();

    utilsCopy(
      [
        'resourceStore',
        'languageUtils',
        'pluralResolver',
        'interpolator',
        'backendConnector',
        'i18nFormat',
        'utils',
      ],
      services,
      this as Record<string, unknown>,
    );

    this.options = options;
    if (this.options.keySeparator === undefined) {
      this.options.keySeparator = '.';
    }

    this.logger = baseLogger.create('translator');
  }

  /**
   * Change the current language
   */
  changeLanguage(lng: string): void {
    if (lng) this.language = lng;
  }

  /**
   * Check if a translation key exists
   */
  exists(key: string | null, options: TranslateOptions = { interpolation: {} }): boolean {
    const opt = { ...options };
    if (key == null) return false;
    const resolved = this.resolve(key, opt);
    return resolved?.res !== undefined;
  }

  /**
   * Extract key and namespaces from a translation key
   */
  extractFromKey(key: string, opt: TranslateOptions): { key: string; namespaces: string[] } {
    let nsSeparator = opt.nsSeparator !== undefined ? opt.nsSeparator : this.options.nsSeparator;
    if (nsSeparator === undefined) nsSeparator = ':';

    const keySeparator =
      opt.keySeparator !== undefined ? opt.keySeparator : this.options.keySeparator;

    let namespaces = opt.ns || this.options.defaultNS || [];
    const wouldCheckForNsInKey = nsSeparator && key.indexOf(nsSeparator) > -1;
    const seemsNaturalLanguage =
      !this.options.userDefinedKeySeparator &&
      !opt.keySeparator &&
      !this.options.userDefinedNsSeparator &&
      !opt.nsSeparator &&
      !looksLikeObjectPath(
        key,
        nsSeparator,
        typeof keySeparator === 'string' ? keySeparator : undefined,
      );

    if (wouldCheckForNsInKey && !seemsNaturalLanguage) {
      const m = this.interpolator?.nestingRegexp
        ? key.match(this.interpolator.nestingRegexp)
        : null;
      if (m && m.length > 0) {
        return {
          key,
          namespaces: isString(namespaces)
            ? [namespaces]
            : Array.isArray(namespaces)
              ? [...namespaces]
              : [],
        };
      }
      const parts = key.split(nsSeparator);
      if (
        nsSeparator !== keySeparator ||
        (nsSeparator === keySeparator &&
          Array.isArray(this.options.ns) &&
          this.options.ns.indexOf(parts[0] || '') > -1)
      ) {
        const firstPart = parts.shift();
        if (firstPart) namespaces = firstPart;
      }
      key = parts.join(keySeparator || '');
    }

    return {
      key,
      namespaces: isString(namespaces)
        ? [namespaces]
        : Array.isArray(namespaces)
          ? [...namespaces]
          : [],
    };
  }

  /**
   * Main translation function
   */
  translate(
    keys: string | readonly string[],
    options?: TranslateOptions,
    lastKey?: readonly string[],
  ): string | TranslationResult;
  translate(
    keys: string | readonly string[],
    options: TranslateOptions & {
      returnDetails: true;
    },
    lastKey?: readonly string[],
  ): TranslationResult;
  translate(
    keys: string | readonly string[],
    o?: TranslateOptions,
    lastKey?: readonly string[],
  ): string | TranslationResult {
    let opt = typeof o === 'object' ? { ...o } : o;
    if (typeof opt !== 'object' && this.options.overloadTranslationOptionHandler) {
      // eslint-disable-next-line prefer-rest-params
      opt = this.options.overloadTranslationOptionHandler(Array.from(arguments));
    }
    if (typeof opt === 'object') opt = { ...opt };
    if (!opt) opt = {};

    // non valid keys handling
    if (keys == null) return '';
    if (!Array.isArray(keys)) keys = [String(keys)];

    const returnDetails =
      opt.returnDetails !== undefined ? opt.returnDetails : this.options.returnDetails;

    // separators
    const keySeparator =
      opt.keySeparator !== undefined ? opt.keySeparator : this.options.keySeparator;

    // get namespace(s)
    const { key, namespaces } = this.extractFromKey(keys[keys.length - 1] || '', opt);
    const namespace = namespaces[namespaces.length - 1] || '';

    let nsSeparator = opt.nsSeparator !== undefined ? opt.nsSeparator : this.options.nsSeparator;
    if (nsSeparator === undefined) nsSeparator = ':';

    // return key on CIMode
    const lng = opt.lng || this.language;
    const appendNamespaceToCIMode =
      opt.appendNamespaceToCIMode || this.options.appendNamespaceToCIMode;
    if (lng?.toLowerCase() === 'cimode') {
      if (appendNamespaceToCIMode) {
        if (returnDetails) {
          return {
            res: `${namespace}${nsSeparator}${key}`,
            usedKey: key,
            exactUsedKey: key,
            usedLng: lng,
            usedNS: namespace,
            usedParams: this.getUsedParamsDetails(opt),
          };
        }
        return `${namespace}${nsSeparator}${key}`;
      }

      if (returnDetails) {
        return {
          res: key,
          usedKey: key,
          exactUsedKey: key,
          usedLng: lng,
          usedNS: namespace,
          usedParams: this.getUsedParamsDetails(opt),
        };
      }
      return key;
    }

    // resolve from store
    const resolved = this.resolve(keys, opt);
    let res = resolved?.res;
    const resUsedKey = resolved?.usedKey || key;
    const resExactUsedKey = resolved?.exactUsedKey || key;

    const noObject = ['[object Number]', '[object Function]', '[object RegExp]'];
    const joinArrays = opt.joinArrays !== undefined ? opt.joinArrays : this.options.joinArrays;

    // object
    const handleAsObjectInI18nFormat = !this.i18nFormat || this.i18nFormat.handleAsObject;
    const needsPluralHandling = opt.count !== undefined && !isString(opt.count);
    const hasDefaultValue = Translator.hasDefaultValue(opt);
    const defaultValueSuffix =
      needsPluralHandling && this.pluralResolver
        ? this.pluralResolver.getSuffix(lng || '', opt.count || 0, opt)
        : '';
    const defaultValueSuffixOrdinalFallback =
      opt.ordinal && needsPluralHandling && this.pluralResolver
        ? this.pluralResolver.getSuffix(lng || '', opt.count || 0, { ...opt, ordinal: false })
        : '';
    const needsZeroSuffixLookup = needsPluralHandling && !opt.ordinal && opt.count === 0;
    const pluralSeparator = this.options.pluralSeparator || '_';
    const defaultValue =
      (needsZeroSuffixLookup && opt[`defaultValue${pluralSeparator}zero`]) ||
      opt[`defaultValue${defaultValueSuffix}`] ||
      opt[`defaultValue${defaultValueSuffixOrdinalFallback}`] ||
      opt.defaultValue;

    let resForObjHndl = res;
    if (handleAsObjectInI18nFormat && !res && hasDefaultValue) {
      resForObjHndl = defaultValue as TranslationValue;
    }

    const handleAsObject = shouldHandleAsObject(resForObjHndl);
    const resType = Object.prototype.toString.apply(resForObjHndl);

    if (
      handleAsObjectInI18nFormat &&
      resForObjHndl &&
      handleAsObject &&
      noObject.indexOf(resType) < 0 &&
      !(isString(joinArrays) && Array.isArray(resForObjHndl))
    ) {
      if (!opt.returnObjects && !this.options.returnObjects) {
        if (!this.options.returnedObjectHandler) {
          this.logger.warn('accessing an object - but returnObjects options is not enabled!');
        }
        const r = this.options.returnedObjectHandler
          ? this.options.returnedObjectHandler(resUsedKey, resForObjHndl, {
              ...opt,
              ns: namespaces,
            })
          : `key '${key} (${this.language})' returned an object instead of string.`;
        if (returnDetails) {
          const result = resolved || {
            res: r,
            usedKey: key,
            exactUsedKey: key,
            usedLng: lng || '',
            usedNS: namespace,
          };
          result.res = r;
          result.usedParams = this.getUsedParamsDetails(opt);
          return result as TranslationResult;
        }
        return r;
      }

      // if we got a separator we loop over children - else we just return object as is
      // as having it set to false means no hierarchy so no lookup for nested values
      if (keySeparator) {
        const resTypeIsArray = Array.isArray(resForObjHndl);
        const copy: Record<string, unknown> | unknown[] = resTypeIsArray ? [] : {};

        const newKeyToUse = resTypeIsArray ? resExactUsedKey : resUsedKey;
        for (const m in resForObjHndl as Record<string, unknown>) {
          if (Object.prototype.hasOwnProperty.call(resForObjHndl, m)) {
            const deepKey = `${newKeyToUse}${keySeparator}${m}`;
            if (hasDefaultValue && !res) {
              (copy as Record<string, unknown>)[m] = this.translate(deepKey, {
                ...opt,
                defaultValue: shouldHandleAsObject(defaultValue)
                  ? String((defaultValue as Record<string, unknown>)[m] || '')
                  : undefined,
                joinArrays: false,
                ns: namespaces,
              });
            } else {
              (copy as Record<string, unknown>)[m] = this.translate(deepKey, {
                ...opt,
                joinArrays: false,
                ns: namespaces,
              });
            }
            if ((copy as Record<string, unknown>)[m] === deepKey) {
              (copy as Record<string, unknown>)[m] = (resForObjHndl as Record<string, unknown>)[m]; // if nothing found use original value as fallback
            }
          }
        }
        res = copy as TranslationValue;
      }
    } else if (handleAsObjectInI18nFormat && isString(joinArrays) && Array.isArray(res)) {
      // array special treatment
      res = res.join(joinArrays);
      if (res) res = this.extendTranslation(res, keys, opt, resolved, lastKey);
    } else {
      // string, empty or null
      let usedDefault = false;
      let usedKey = false;

      // fallback value
      if (!this.isValidLookup(res) && hasDefaultValue) {
        usedDefault = true;
        res = String(defaultValue || '');
      }
      if (!this.isValidLookup(res)) {
        usedKey = true;
        res = key;
      }

      const missingKeyNoValueFallbackToKey =
        opt.missingKeyNoValueFallbackToKey || this.options.missingKeyNoValueFallbackToKey;
      const resForMissing = missingKeyNoValueFallbackToKey && usedKey ? undefined : res;

      // save missing
      const updateMissing = hasDefaultValue && defaultValue !== res && this.options.updateMissing;
      if (usedKey || usedDefault || updateMissing) {
        this.logger.log(
          updateMissing ? 'updateKey' : 'missingKey',
          lng || '',
          namespace,
          key,
          updateMissing ? defaultValue : res,
        );
        if (keySeparator) {
          const fk = this.resolve(key, { ...opt, keySeparator: false });
          if (fk && fk.res)
            this.logger.warn(
              'Seems the loaded translations were in flat JSON format instead of nested. Either set keySeparator: false on init or make sure your translations are published in nested format.',
            );
        }

        let lngs: string[] = [];
        const fallbackLngs = this.languageUtils?.getFallbackCodes(
          this.options.fallbackLng,
          opt.lng || this.language || '',
        );
        if (this.options.saveMissingTo === 'fallback' && fallbackLngs && fallbackLngs[0]) {
          for (let i = 0; i < fallbackLngs.length; i++) {
            lngs.push(fallbackLngs[i] || '');
          }
        } else if (this.options.saveMissingTo === 'all') {
          const hierarchy = this.languageUtils?.toResolveHierarchy(opt.lng || this.language || '');
          lngs = hierarchy ? [...hierarchy] : [];
        } else {
          lngs.push(opt.lng || this.language || '');
        }

        const send = (l: string | string[], k: string, specificDefaultValue?: string): void => {
          const defaultForMissing =
            hasDefaultValue && specificDefaultValue !== res ? specificDefaultValue : resForMissing;
          if (this.options.missingKeyHandler) {
            this.options.missingKeyHandler(
              Array.isArray(l) ? l[0] || '' : l,
              namespace,
              k,
              defaultForMissing as string,
              updateMissing || false,
              opt,
            );
          } else if (this.backendConnector?.saveMissing) {
            this.backendConnector.saveMissing(
              Array.isArray(l) ? l[0] || '' : l,
              namespace,
              k,
              defaultForMissing as string,
              updateMissing || false,
              opt,
            );
          }
          this.emit('missingKey', Array.isArray(l) ? l[0] || '' : l, namespace, k, res);
        };

        if (this.options.saveMissing) {
          if (this.options.saveMissingPlurals && needsPluralHandling && this.pluralResolver) {
            lngs.forEach(language => {
              const suffixes = this.pluralResolver!.getSuffixes(language, opt);
              const suffixArray = [...suffixes];
              if (
                needsZeroSuffixLookup &&
                opt[`defaultValue${pluralSeparator}zero`] &&
                suffixArray.indexOf(`${pluralSeparator}zero`) < 0
              ) {
                suffixArray.push(`${pluralSeparator}zero`);
              }
              suffixArray.forEach(suffix => {
                send(
                  [language],
                  key + suffix,
                  String(opt[`defaultValue${suffix}`] || defaultValue || ''),
                );
              });
            });
          } else {
            send(lngs, key, String(defaultValue || ''));
          }
        }
      }

      // extend
      res = this.extendTranslation(res, keys, opt, resolved, lastKey);

      // append namespace if still key
      if (usedKey && res === key && this.options.appendNamespaceToMissingKey) {
        res = `${namespace}${nsSeparator}${key}`;
      }

      // parseMissingKeyHandler
      if ((usedKey || usedDefault) && this.options.parseMissingKeyHandler) {
        res = this.options.parseMissingKeyHandler(
          this.options.appendNamespaceToMissingKey ? `${namespace}${nsSeparator}${key}` : key,
          usedDefault ? res : undefined,
          opt,
        );
      }
    }

    // return
    if (returnDetails) {
      const result = resolved || {
        res: res as string,
        usedKey: key,
        exactUsedKey: key,
        usedLng: lng || '',
        usedNS: namespace,
      };
      result.res = res as string;
      result.usedParams = this.getUsedParamsDetails(opt);
      return result as TranslationResult;
    }
    return res as string;
  }

  /**
   * Extend translation with interpolation and post-processing
   */
  extendTranslation(
    res: unknown,
    key: string | readonly string[],
    opt: TranslateOptions,
    resolved?: ResolveResult,
    lastKey?: readonly string[],
  ): string {
    let result = String(res || '');

    if (this.i18nFormat?.parse) {
      result = this.i18nFormat.parse(
        result,
        { ...this.options.interpolation?.defaultVariables, ...opt },
        opt.lng || this.language || resolved?.usedLng || '',
        resolved?.usedNS || '',
        resolved?.usedKey || '',
        {
          resolved: resolved || {
            res: undefined,
            usedKey: '',
            exactUsedKey: '',
            usedLng: '',
            usedNS: '',
          },
        },
      );
    } else if (!opt.skipInterpolation && this.interpolator) {
      // i18next.parsing
      if (opt.interpolation) {
        this.interpolator.init({
          ...opt,
          interpolation: { ...this.options.interpolation, ...opt.interpolation },
        });
      }
      const skipOnVariables =
        isString(result) &&
        (opt?.interpolation?.skipOnVariables !== undefined
          ? opt.interpolation.skipOnVariables
          : this.options.interpolation?.skipOnVariables);
      let nestBef: number | undefined;
      if (skipOnVariables) {
        const nb = result.match(this.interpolator.nestingRegexp);
        // has nesting after interpolation
        nestBef = nb ? nb.length : undefined;
      }

      // interpolate
      let data = opt.replace && !isString(opt.replace) ? opt.replace : opt;
      if (this.options.interpolation?.defaultVariables) {
        data = { ...this.options.interpolation.defaultVariables, ...data };
      }
      result = this.interpolator.interpolate(
        result,
        data as Record<string, unknown>,
        opt.lng || this.language || resolved?.usedLng || '',
        opt,
      );

      // nesting
      if (skipOnVariables) {
        const na = result.match(this.interpolator.nestingRegexp);
        // has nesting after interpolation
        const nestAft = na && na.length;
        if (nestBef !== undefined && nestBef < (nestAft || 0)) opt.nest = false;
      }
      if (!opt.lng && resolved && resolved.res) opt.lng = this.language || resolved.usedLng;
      if (opt.nest !== false) {
        result = this.interpolator.nest(
          result,
          (...args: unknown[]) => {
            if (lastKey?.[0] === args[0] && !opt.context) {
              this.logger.warn(
                `It seems you are nesting recursively key: ${args[0]} in key: ${Array.isArray(key) ? key[0] : key}`,
              );
              return null;
            }
            const nestedKey = args[0] as string | readonly string[];
            const nestedOpt = args[1] as TranslateOptions | undefined;
            const result = this.translate(nestedKey, nestedOpt);
            return typeof result === 'string' ? result : String(result);
          },
          opt,
        );
      }

      if (opt.interpolation) this.interpolator.reset();
    }

    // post process
    const postProcess = opt.postProcess || this.options.postProcess;
    const postProcessorNames = isString(postProcess) ? [postProcess] : postProcess;

    if (result != null && postProcessorNames?.length && opt.applyPostProcessor !== false) {
      result = postProcessor.handle(
        postProcessorNames,
        result,
        key,
        this.options && this.options.postProcessPassResolved
          ? ({
              i18nResolved: { ...resolved, usedParams: this.getUsedParamsDetails(opt) },
              ...opt,
            } as any)
          : (opt as any),
        this,
      );
    }

    return result;
  }

  /**
   * Resolve translation keys to values
   */
  resolve(keys: string | readonly string[], opt: TranslateOptions = {}): ResolveResult | undefined {
    let found: TranslationValue | undefined;
    let usedKey: string = ''; // plain key
    let exactUsedKey: string = ''; // key with context / plural
    let usedLng: string = '';
    let usedNS: string = '';

    if (isString(keys)) keys = [keys];

    // forEach possible key
    keys.forEach(k => {
      if (this.isValidLookup(found)) return;
      const extracted = this.extractFromKey(k, opt);
      const key = extracted.key;
      usedKey = key;
      let namespaces = extracted.namespaces;
      if (this.options.fallbackNS) {
        namespaces = namespaces.concat(
          Array.isArray(this.options.fallbackNS)
            ? this.options.fallbackNS
            : [this.options.fallbackNS],
        );
      }

      const needsPluralHandling = opt.count !== undefined && !isString(opt.count);
      const needsZeroSuffixLookup = needsPluralHandling && !opt.ordinal && opt.count === 0;
      const needsContextHandling =
        opt.context !== undefined &&
        (isString(opt.context) || typeof opt.context === 'number') &&
        opt.context !== '';

      const codes = opt.lngs
        ? opt.lngs
        : this.languageUtils?.toResolveHierarchy(opt.lng || this.language || '', opt.fallbackLng) ||
          [];

      namespaces.forEach(ns => {
        if (this.isValidLookup(found)) return;
        usedNS = ns;

        if (
          !checkedLoadedFor[`${codes[0]}-${ns}`] &&
          this.utils?.hasLoadedNamespace &&
          !this.utils?.hasLoadedNamespace(usedNS)
        ) {
          checkedLoadedFor[`${codes[0]}-${ns}`] = true;
          this.logger.warn(
            `key "${usedKey}" for languages "${codes.join(
              ', ',
            )}" won't get resolved as namespace "${usedNS}" was not yet loaded`,
            'This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!',
          );
        }

        codes.forEach(code => {
          if (this.isValidLookup(found)) return;
          usedLng = code;

          const finalKeys = [key];

          if (this.i18nFormat?.addLookupKeys) {
            this.i18nFormat.addLookupKeys(finalKeys, key, code, ns, opt);
          } else {
            let pluralSuffix: string | undefined;
            if (needsPluralHandling && this.pluralResolver) {
              pluralSuffix = this.pluralResolver.getSuffix(code, opt.count || 0, opt);
            }
            const pluralSeparator = this.options.pluralSeparator || '_';
            const zeroSuffix = `${pluralSeparator}zero`;
            const ordinalPrefix = `${pluralSeparator}ordinal${pluralSeparator}`;
            // get key for plural if needed
            if (needsPluralHandling && pluralSuffix) {
              finalKeys.push(key + pluralSuffix);
              if (opt.ordinal && pluralSuffix.indexOf(ordinalPrefix) === 0) {
                finalKeys.push(key + pluralSuffix.replace(ordinalPrefix, pluralSeparator));
              }
              if (needsZeroSuffixLookup) {
                finalKeys.push(key + zeroSuffix);
              }
            }

            // get key for context if needed
            if (needsContextHandling) {
              const contextSeparator = this.options.contextSeparator || '_';
              const contextKey = `${key}${contextSeparator}${opt.context}`;
              finalKeys.push(contextKey);

              // get key for context + plural if needed
              if (needsPluralHandling && pluralSuffix) {
                finalKeys.push(contextKey + pluralSuffix);
                if (opt.ordinal && pluralSuffix.indexOf(ordinalPrefix) === 0) {
                  finalKeys.push(contextKey + pluralSuffix.replace(ordinalPrefix, pluralSeparator));
                }
                if (needsZeroSuffixLookup) {
                  finalKeys.push(contextKey + zeroSuffix);
                }
              }
            }
          }

          // iterate over finalKeys starting with most specific pluralkey (-> contextkey only) -> singularkey only
          let possibleKey: string | undefined;
          while ((possibleKey = finalKeys.pop())) {
            if (!this.isValidLookup(found)) {
              exactUsedKey = possibleKey;
              found = this.getResource(code, ns, possibleKey, opt);
            }
          }
        });
      });
    });

    return { res: found, usedKey, exactUsedKey, usedLng, usedNS };
  }

  /**
   * Check if a lookup result is valid
   */
  isValidLookup(res: unknown): boolean {
    return (
      res !== undefined &&
      !(!this.options.returnNull && res === null) &&
      !(!this.options.returnEmptyString && res === '')
    );
  }

  /**
   * Get resource from store
   */
  getResource(
    code: string,
    ns: string,
    key: string,
    options: TranslateOptions = {},
  ): TranslationValue | undefined {
    if (this.i18nFormat?.getResource) return this.i18nFormat.getResource(code, ns, key, options);
    return this.resourceStore?.getResource(code, ns, key, options);
  }

  /**
   * Get details about used parameters for debugging
   */
  getUsedParamsDetails(options: TranslateOptions = {}): Record<string, unknown> {
    // we need to remember to extend this array whenever new option properties are added
    const optionsKeys = [
      'defaultValue',
      'ordinal',
      'context',
      'replace',
      'lng',
      'lngs',
      'fallbackLng',
      'ns',
      'keySeparator',
      'nsSeparator',
      'returnObjects',
      'returnDetails',
      'joinArrays',
      'postProcess',
      'interpolation',
    ];

    const useOptionsReplaceForData = options.replace && !isString(options.replace);
    let data = useOptionsReplaceForData ? options.replace : options;
    if (useOptionsReplaceForData && typeof options.count !== 'undefined') {
      (data as Record<string, unknown>).count = options.count;
    }

    if (this.options.interpolation?.defaultVariables) {
      data = { ...this.options.interpolation.defaultVariables, ...data };
    }

    // avoid reporting options (except count) as usedParams
    if (!useOptionsReplaceForData) {
      data = { ...data };
      for (const key of optionsKeys) {
        delete (data as Record<string, unknown>)[key];
      }
    }

    return data as Record<string, unknown>;
  }

  /**
   * Check if options contain a default value
   */
  static hasDefaultValue(options: TranslateOptions): boolean {
    const prefix = 'defaultValue';

    for (const option in options) {
      if (
        Object.prototype.hasOwnProperty.call(options, option) &&
        prefix === option.substring(0, prefix.length) &&
        undefined !== options[option]
      ) {
        return true;
      }
    }

    return false;
  }
}

export default Translator;
