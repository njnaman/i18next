/**
 * Interpolator implementation for i18next TypeScript migration
 */

import type { InitOptions, Language, FormatFunction, LoggerInterface } from '../types/index';
import {
  getPathWithDefaults,
  deepFind,
  escape as utilsEscape,
  regexEscape,
  makeString,
  isString,
} from './utils';
import baseLogger from './logger';

// Extended InterpolationOptions to match JavaScript version
interface ExtendedInterpolationOptions {
  escapeValue?: boolean;
  format?: FormatFunction;
  prefix?: string;
  suffix?: string;
  formatSeparator?: string;
  unescapePrefix?: string;
  unescapeSuffix?: string;
  nestingPrefix?: string;
  nestingSuffix?: string;
  nestingOptionsSeparator?: string;
  maxReplaces?: number;
  skipOnVariables?: boolean;
  defaultVariables?: Record<string, unknown>;
  // Additional properties from JavaScript version
  escape?: (value: unknown) => unknown;
  useRawValueToEscape?: boolean;
  prefixEscaped?: string;
  suffixEscaped?: string;
  nestingPrefixEscaped?: string;
  nestingSuffixEscaped?: string;
  alwaysFormat?: boolean;
}

// Extended InitOptions to include missing properties
interface ExtendedInitOptions extends Omit<InitOptions, 'missingInterpolationHandler'> {
  keySeparator?: string;
  ignoreJSONStructure?: boolean;
  interpolation?: ExtendedInterpolationOptions;
  missingInterpolationHandler?: (
    str: string,
    match: RegExpExecArray,
    options: InterpolateOptions,
  ) => string;
}

// Simplified: specific but minimal typing
type InterpolateOptions = {
  lng?: Language;
  keySeparator?: string | false;
  ignoreJSONStructure?: boolean;
  missingInterpolationHandler?: (
    str: string,
    match: RegExpExecArray,
    options: InterpolateOptions,
  ) => string;
  interpolation?: Record<string, unknown>;
  replace?: Record<string, unknown>;
  applyPostProcessor?: boolean;
  defaultValue?: string;
  interpolationkey?: string;
  [key: string]: unknown;
};

// Simplified: inline type for simple structure
type RegexTodo = {
  regex: RegExp;
  safeValue: (val: string) => string;
};

const deepFindWithDefaults = (
  data: Record<string, unknown>,
  defaultData: Record<string, unknown>,
  key: string,
  keySeparator = '.',
  ignoreJSONStructure = true,
): unknown => {
  let path = getPathWithDefaults(data, defaultData, key);
  if (!path && ignoreJSONStructure && isString(key)) {
    path = deepFind(data, key, keySeparator);
    if (path === undefined) path = deepFind(defaultData, key, keySeparator);
  }
  return path;
};

const regexSafe = (val: string): string => val.replace(/\$/g, '$$$$');

export default class Interpolator {
  public logger: LoggerInterface;
  public options: ExtendedInitOptions;
  public format: FormatFunction;
  public escape!: (data: unknown) => unknown;
  public escapeValue!: boolean;
  public useRawValueToEscape!: boolean;
  public prefix!: string;
  public suffix!: string;
  public formatSeparator!: string;
  public unescapePrefix!: string;
  public unescapeSuffix!: string;
  public nestingPrefix!: string;
  public nestingSuffix!: string;
  public nestingOptionsSeparator!: string;
  public maxReplaces!: number;
  public alwaysFormat!: boolean;
  public regexp?: RegExp;
  public regexpUnescape?: RegExp;
  public nestingRegexp?: RegExp;

  constructor(options: ExtendedInitOptions = {}) {
    this.logger = baseLogger.create('interpolator');

    this.options = options;
    this.format =
      (options?.interpolation?.format as FormatFunction) ||
      ((value: unknown): string => String(value));
    this.init(options);
  }

  init(options: ExtendedInitOptions = {}): void {
    if (!options.interpolation) options.interpolation = { escapeValue: true };

    const {
      escape,
      escapeValue,
      useRawValueToEscape,
      prefix,
      prefixEscaped,
      suffix,
      suffixEscaped,
      formatSeparator,
      unescapeSuffix,
      unescapePrefix,
      nestingPrefix,
      nestingPrefixEscaped,
      nestingSuffix,
      nestingSuffixEscaped,
      nestingOptionsSeparator,
      maxReplaces,
      alwaysFormat,
    } = options.interpolation;

    this.escape = escape !== undefined ? escape : utilsEscape;
    this.escapeValue = escapeValue !== undefined ? escapeValue : true;
    this.useRawValueToEscape = useRawValueToEscape !== undefined ? useRawValueToEscape : false;

    this.prefix = prefix ? regexEscape(prefix) : prefixEscaped || '{{';
    this.suffix = suffix ? regexEscape(suffix) : suffixEscaped || '}}';

    this.formatSeparator = formatSeparator || ',';

    this.unescapePrefix = unescapeSuffix ? '' : unescapePrefix || '-';
    this.unescapeSuffix = this.unescapePrefix ? '' : unescapeSuffix || '';

    this.nestingPrefix = nestingPrefix
      ? regexEscape(nestingPrefix)
      : nestingPrefixEscaped || regexEscape('$t(');
    this.nestingSuffix = nestingSuffix
      ? regexEscape(nestingSuffix)
      : nestingSuffixEscaped || regexEscape(')');

    this.nestingOptionsSeparator = nestingOptionsSeparator || ',';

    this.maxReplaces = maxReplaces || 1000;

    this.alwaysFormat = alwaysFormat !== undefined ? alwaysFormat : false;

    // the regexp
    this.resetRegExp();
  }

  reset(): void {
    if (this.options) this.init(this.options);
  }

  resetRegExp(): void {
    const getOrResetRegExp = (existingRegExp: RegExp | undefined, pattern: string): RegExp => {
      if (existingRegExp?.source === pattern) {
        existingRegExp.lastIndex = 0;
        return existingRegExp;
      }
      return new RegExp(pattern, 'g');
    };

    this.regexp = getOrResetRegExp(this.regexp, `${this.prefix}(.+?)${this.suffix}`);
    this.regexpUnescape = getOrResetRegExp(
      this.regexpUnescape,
      `${this.prefix}${this.unescapePrefix}(.+?)${this.unescapeSuffix}${this.suffix}`,
    );
    this.nestingRegexp = getOrResetRegExp(
      this.nestingRegexp,
      `${this.nestingPrefix}(.+?)${this.nestingSuffix}`,
    );
  }

  interpolate(
    str: string,
    data: Record<string, unknown>,
    lng: Language,
    options: InterpolateOptions,
  ): string {
    let match: RegExpExecArray | null;
    let value: unknown;
    let replaces: number;

    const defaultData =
      (this.options && this.options.interpolation && this.options.interpolation.defaultVariables) ||
      {};

    const handleFormat = (key: string): unknown => {
      if (key.indexOf(this.formatSeparator) < 0) {
        const path = deepFindWithDefaults(
          data,
          defaultData,
          key,
          this.options.keySeparator,
          this.options.ignoreJSONStructure,
        );
        return this.alwaysFormat
          ? this.format(path, undefined, lng, { ...options, ...data, interpolationkey: key })
          : path;
      }

      const p = key.split(this.formatSeparator);
      const k = p.shift()?.trim() || '';
      const f = p.join(this.formatSeparator).trim();

      return this.format(
        deepFindWithDefaults(
          data,
          defaultData,
          k,
          this.options.keySeparator,
          this.options.ignoreJSONStructure,
        ),
        f,
        lng,
        {
          ...options,
          ...data,
          interpolationkey: k,
        },
      );
    };

    this.resetRegExp();

    const missingInterpolationHandler =
      options?.missingInterpolationHandler || this.options.missingInterpolationHandler;

    const skipOnVariables =
      options?.interpolation?.skipOnVariables !== undefined
        ? options.interpolation.skipOnVariables
        : this.options.interpolation?.skipOnVariables;

    const todos: readonly RegexTodo[] = [
      {
        // unescape if has unescapePrefix/Suffix
        regex: this.regexpUnescape!,
        safeValue: (val: string): string => regexSafe(val),
      },
      {
        // regular escape on demand
        regex: this.regexp!,
        safeValue: (val: string): string =>
          this.escapeValue ? regexSafe(this.escape(val) as string) : regexSafe(val),
      },
    ];

    todos.forEach(todo => {
      replaces = 0;
      while ((match = todo.regex.exec(str))) {
        const matchedVar = match[1]!.trim();
        value = handleFormat(matchedVar);
        if (value === undefined) {
          if (typeof missingInterpolationHandler === 'function') {
            const temp = missingInterpolationHandler(str, match, options);
            value = isString(temp) ? temp : '';
          } else if (options && Object.prototype.hasOwnProperty.call(options, matchedVar)) {
            value = ''; // undefined becomes empty string
          } else if (skipOnVariables) {
            value = match[0];
            continue; // this makes sure it continues to detect others
          } else {
            this.logger.warn(`missed to pass in variable ${matchedVar} for interpolating ${str}`);
            value = '';
          }
        } else if (!isString(value) && !this.useRawValueToEscape) {
          value = makeString(value);
        }
        const safeValue = todo.safeValue(value as string);
        str = str.replace(match[0], safeValue);
        if (skipOnVariables) {
          todo.regex.lastIndex += (value as string).length;
          todo.regex.lastIndex -= match[0].length;
        } else {
          todo.regex.lastIndex = 0;
        }
        replaces++;
        if (replaces >= this.maxReplaces) {
          break;
        }
      }
    });
    return str;
  }

  nest(
    str: string,
    fc: (key: string, options: InterpolateOptions) => unknown,
    options: InterpolateOptions = {},
  ): string {
    let match: RegExpExecArray | null;
    let value: unknown;

    let clonedOptions: InterpolateOptions;

    // if value is something like "myKey": "lorem $(anotherKey, { "count": {{aValueInOptions}} })"
    const handleHasOptions = (key: string, inheritedOptions: InterpolateOptions): string => {
      const sep = this.nestingOptionsSeparator;
      if (key.indexOf(sep) < 0) return key;

      const c = key.split(new RegExp(`${sep}[ ]*{`));

      let optionsString = `{${c[1]}`;
      key = c[0]!;
      optionsString = this.interpolate(
        optionsString,
        clonedOptions,
        options.lng || 'en',
        clonedOptions,
      );
      const matchedSingleQuotes = optionsString.match(/'/g);
      const matchedDoubleQuotes = optionsString.match(/"/g);
      if (
        ((matchedSingleQuotes?.length ?? 0) % 2 === 0 && !matchedDoubleQuotes) ||
        (matchedDoubleQuotes && matchedDoubleQuotes.length % 2 !== 0)
      ) {
        optionsString = optionsString.replace(/'/g, '"');
      }

      try {
        clonedOptions = JSON.parse(optionsString) as InterpolateOptions;

        if (inheritedOptions) clonedOptions = { ...inheritedOptions, ...clonedOptions };
      } catch (e) {
        this.logger.warn(`failed parsing options string in nesting for key ${key}`, e);
        return `${key}${sep}${optionsString}`;
      }

      // assert we do not get a endless loop on interpolating defaultValue again and again
      if (clonedOptions.defaultValue && clonedOptions.defaultValue.indexOf(this.prefix) > -1)
        delete clonedOptions.defaultValue;
      return key;
    };

    // regular escape on demand
    while ((match = this.nestingRegexp!.exec(str))) {
      let formatters: string[] = [];

      clonedOptions = { ...options };
      clonedOptions =
        clonedOptions.replace && !isString(clonedOptions.replace)
          ? (clonedOptions.replace as InterpolateOptions)
          : clonedOptions;
      clonedOptions.applyPostProcessor = false; // avoid post processing on nested lookup
      delete clonedOptions.defaultValue; // assert we do not get a endless loop on interpolating defaultValue again and again

      /**
       * If there is more than one parameter (contains the format separator). E.g.:
       *   - t(a, b)
       *   - t(a, b, c)
       *
       * And those parameters are not dynamic values (parameters do not include curly braces). E.g.:
       *   - Not t(a, { "key": "{{variable}}" })
       *   - Not t(a, b, {"keyA": "valueA", "keyB": "valueB"})
       *
       * Since v25.3.0 also this is possible: https://github.com/i18next/i18next/pull/2325
       */
      const keyEndIndex = /{.*}/.test(match[1]!)
        ? match[1]!.lastIndexOf('}') + 1
        : match[1]!.indexOf(this.formatSeparator);
      if (keyEndIndex !== -1) {
        formatters = match[1]!
          .slice(keyEndIndex)
          .split(this.formatSeparator)
          .map(elem => elem.trim())
          .filter(Boolean);
        match[1] = match[1]!.slice(0, keyEndIndex);
      }

      value = fc(handleHasOptions.call(this, match[1]!.trim(), clonedOptions), clonedOptions);

      // is only the nesting key (key1 = '$(key2)') return the value without stringify
      if (value && match[0] === str && !isString(value)) return value as string;

      // no string to include or empty
      if (!isString(value)) value = makeString(value);
      if (!value) {
        this.logger.warn(`missed to resolve ${match[1]} for nesting ${str}`);
        value = '';
      }

      if (formatters.length) {
        value = formatters.reduce(
          // eslint-disable-next-line no-loop-func
          (v, f) =>
            this.format(v, f, options.lng, { ...options, interpolationkey: match![1]!.trim() }),
          (value as string).trim(),
        );
      }

      // Nested keys should not be escaped by default #854
      // value = this.escapeValue ? regexSafe(utils.escape(value)) : regexSafe(value);
      str = str.replace(match[0], value as string);
      this.regexp!.lastIndex = 0;
    }
    return str;
  }
}
