/**
 * Formatter implementation for i18next TypeScript migration
 */

import type { Services, InitOptions, Language, Logger } from '../types';
import baseLogger from './logger';
import { getCleanedCode } from './utils';

// Simplified: specific but minimal typing
type FormatOptions = {
  [key: string]: unknown;
  currency?: string;
  range?: string;
  locale?: string;
  lng?: string;
  interpolationkey?: string;
  formatParams?: Record<string, Record<string, unknown>>;
};

type FormatterFunction = (value: unknown, lng: Language, options: FormatOptions) => unknown;
type CachedFormatterFunction = (
  lng: Language,
  options: FormatOptions,
) => (value: unknown) => unknown;

const parseFormatStr = (formatStr: string) => {
  let formatName = formatStr.toLowerCase().trim();
  const formatOptions: Record<string, unknown> = {};

  if (formatStr.indexOf('(') > -1) {
    const p = formatStr.split('(');
    formatName = p[0]!.toLowerCase().trim();

    const optStr = p[1]!.substring(0, p[1]!.length - 1);

    // extra for currency
    if (formatName === 'currency' && optStr.indexOf(':') < 0) {
      if (!formatOptions.currency) formatOptions.currency = optStr.trim();
    } else if (formatName === 'relativetime' && optStr.indexOf(':') < 0) {
      if (!formatOptions.range) formatOptions.range = optStr.trim();
    } else {
      const opts = optStr.split(';');

      opts.forEach(opt => {
        if (opt) {
          const [key, ...rest] = opt.split(':');
          const val = rest
            .join(':')
            .trim()
            .replace(/^'+|'+$/g, ''); // trim and replace ''

          const trimmedKey = key!.trim();

          if (!formatOptions[trimmedKey]) formatOptions[trimmedKey] = val;
          if (val === 'false') formatOptions[trimmedKey] = false;
          if (val === 'true') formatOptions[trimmedKey] = true;
          if (!Number.isNaN(Number(val))) formatOptions[trimmedKey] = parseInt(val, 10);
        }
      });
    }
  }

  return {
    formatName,
    formatOptions,
  };
};

const createCachedFormatter = (fn: CachedFormatterFunction): FormatterFunction => {
  const cache: Record<string, (value: unknown) => unknown> = {};
  return (v: unknown, l: Language, o: FormatOptions): unknown => {
    let optForCache = o;
    // this cache optimization will only work for keys having 1 interpolated value
    if (
      o &&
      o.interpolationkey &&
      o.formatParams &&
      o.formatParams[o.interpolationkey] &&
      o[o.interpolationkey]
    ) {
      optForCache = {
        ...optForCache,
        [o.interpolationkey]: undefined,
      };
    }
    const key = l + JSON.stringify(optForCache);
    let frm = cache[key];
    if (!frm) {
      frm = fn(getCleanedCode(l), o);
      cache[key] = frm;
    }
    return frm(v);
  };
};

const createNonCachedFormatter =
  (fn: CachedFormatterFunction): FormatterFunction =>
  (v: unknown, l: Language, o: FormatOptions): unknown =>
    fn(getCleanedCode(l), o)(v);

export default class Formatter {
  public readonly logger: Logger;
  public options: InitOptions;
  public formatSeparator: string;
  public formats: Record<string, FormatterFunction>;

  constructor(options: InitOptions = {}) {
    this.logger = baseLogger.create('formatter');
    this.options = options;
    this.formatSeparator = ',';
    this.formats = {};
    this.init(undefined, options);
  }

  init(services?: Services, options: InitOptions = { interpolation: {} }): void {
    this.formatSeparator = options.interpolation?.formatSeparator || ',';
    const cf = options.cacheInBuiltFormats ? createCachedFormatter : createNonCachedFormatter;

    this.formats = {
      number: cf((lng: Language, opt: FormatOptions) => {
        const formatter = new Intl.NumberFormat(lng, opt as Intl.NumberFormatOptions);
        return (val: unknown): string => formatter.format(val as number);
      }),
      currency: cf((lng: Language, opt: FormatOptions) => {
        const formatter = new Intl.NumberFormat(lng, {
          ...(opt as Intl.NumberFormatOptions),
          style: 'currency',
        });
        return (val: unknown): string => formatter.format(val as number);
      }),
      datetime: cf((lng: Language, opt: FormatOptions) => {
        const formatter = new Intl.DateTimeFormat(lng, opt as Intl.DateTimeFormatOptions);
        return (val: unknown): string => formatter.format(val as Date);
      }),
      relativetime: cf((lng: Language, opt: FormatOptions) => {
        const formatter = new Intl.RelativeTimeFormat(lng, opt as Intl.RelativeTimeFormatOptions);
        return (val: unknown): string =>
          formatter.format(val as number, (opt.range as Intl.RelativeTimeFormatUnit) || 'day');
      }),
      list: cf((lng: Language, opt: FormatOptions) => {
        const formatter = (Intl as any).ListFormat ? new (Intl as any).ListFormat(lng, opt) : null;
        return (val: unknown): string =>
          formatter ? formatter.format(val as string[]) : String(val);
      }),
    };
  }

  add(name: string, fc: FormatterFunction): void {
    this.formats[name.toLowerCase().trim()] = fc;
  }

  addCached(name: string, fc: CachedFormatterFunction): void {
    this.formats[name.toLowerCase().trim()] = createCachedFormatter(fc);
  }

  format(value: unknown, format: string, lng: Language, options: FormatOptions = {}): unknown {
    const formats = format.split(this.formatSeparator);

    if (
      formats.length > 1 &&
      formats[0]!.indexOf('(') > 1 &&
      formats[0]!.indexOf(')') < 0 &&
      formats.find(f => f.indexOf(')') > -1)
    ) {
      const lastIndex = formats.findIndex(f => f.indexOf(')') > -1);
      formats[0] = [formats[0], ...formats.splice(1, lastIndex)].join(this.formatSeparator);
    }

    const result = formats.reduce((mem: unknown, f: string) => {
      const { formatName, formatOptions } = parseFormatStr(f);

      if (this.formats[formatName]) {
        let formatted = mem;
        try {
          // options passed explicit for that formatted value
          const valOptions = options?.formatParams?.[options.interpolationkey || ''] || {};

          // language
          const l = valOptions.locale || valOptions.lng || options.locale || options.lng || lng;

          formatted = this.formats[formatName]!(mem, l as Language, {
            ...formatOptions,
            ...options,
            ...valOptions,
          });
        } catch (error) {
          this.logger.warn(error);
        }
        return formatted;
      } else {
        this.logger.warn(`there was no format function for ${formatName}`);
      }
      return mem;
    }, value);

    return result;
  }
}
