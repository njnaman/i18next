/**
 * PluralResolver implementation for i18next TypeScript migration
 */

import type { Language, LoggerInterface } from '../types';
import baseLogger from './logger';
import { getCleanedCode } from './utils';
import Logger from './logger';
import LanguageUtils from './LanguageUtils';

// Simplified: use const object instead of interface for simple mapping
const suffixesOrder = {
  zero: 0,
  one: 1,
  two: 2,
  few: 3,
  many: 4,
  other: 5,
} as const;

// Simplified: use simple type like original JavaScript
type PluralRule = {
  select: (count: number) => string;
  resolvedOptions: () => {
    pluralCategories: string[];
  };
};

const dummyRule: PluralRule = {
  select: (count: number): string => (count === 1 ? 'one' : 'other'),
  resolvedOptions: (): { pluralCategories: string[] } => ({
    pluralCategories: ['one', 'other'],
  }),
};

export default class PluralResolver {
  public readonly languageUtils: LanguageUtils;
  public readonly options: { prepend?: string };
  public readonly logger: LoggerInterface;
  public pluralRulesCache: Record<string, PluralRule>;
  public rules: Record<string, PluralRule>;

  constructor(languageUtils: LanguageUtils, options: { prepend?: string } = {}) {
    this.languageUtils = languageUtils;
    this.options = { prepend: '_', ...options };

    this.logger = baseLogger.create('pluralResolver');

    // Cache calls to Intl.PluralRules, since repeated calls can be slow in runtimes like React Native
    // and the memory usage difference is negligible
    this.pluralRulesCache = {};
    this.rules = {};
  }

  addRule(lng: Language, obj: PluralRule): void {
    this.rules[lng] = obj;
  }

  clearCache(): void {
    this.pluralRulesCache = {};
  }

  getRule(code: Language, options: { ordinal?: boolean } = {}): PluralRule {
    const cleanedCode = getCleanedCode(code === 'dev' ? 'en' : code);
    const type = options.ordinal ? 'ordinal' : 'cardinal';
    const cacheKey = JSON.stringify({ cleanedCode, type });

    if (cacheKey in this.pluralRulesCache) {
      return this.pluralRulesCache[cacheKey]!;
    }

    let rule: PluralRule;

    try {
      const intlRule = new Intl.PluralRules(cleanedCode, { type });
      rule = {
        select: (count: number): string => intlRule.select(count),
        resolvedOptions: (): { pluralCategories: string[] } => {
          const resolved = intlRule.resolvedOptions();
          return {
            pluralCategories: [...(resolved.pluralCategories || ['other'])],
          };
        },
      };
    } catch (err) {
      if (!Intl) {
        this.logger.error('No Intl support, please use an Intl polyfill!');
        return dummyRule;
      }
      if (!code.match(/-|_/)) return dummyRule;
      const lngPart = this.languageUtils.getLanguagePartFromCode(code);
      rule = this.getRule(lngPart, options);
    }

    this.pluralRulesCache[cacheKey] = rule;
    return rule;
  }

  needsPlural(code: Language, options: { ordinal?: boolean } = {}): boolean {
    let rule = this.getRule(code, options);
    if (!rule) rule = this.getRule('dev', options);
    return rule?.resolvedOptions().pluralCategories.length > 1;
  }

  getPluralFormsOfKey(code: Language, key: string, options: { ordinal?: boolean } = {}): string[] {
    return this.getSuffixes(code, options).map(suffix => `${key}${suffix}`);
  }

  getSuffixes(code: Language, options: { ordinal?: boolean } = {}): string[] {
    let rule = this.getRule(code, options);
    if (!rule) rule = this.getRule('dev', options);
    if (!rule) return [];

    const prepend = this.options.prepend || '_';

    //todo to be checked naman.jain
    return rule
      .resolvedOptions()
      .pluralCategories.sort(
        (pluralCategory1: string, pluralCategory2: string) =>
          (suffixesOrder[pluralCategory1 as keyof typeof suffixesOrder] || 999) -
          (suffixesOrder[pluralCategory2 as keyof typeof suffixesOrder] || 999),
      )
      .map(
        (pluralCategory: string) =>
          `${prepend}${options.ordinal ? `ordinal${prepend}` : ''}${pluralCategory}`,
      );
  }

  getSuffix(code: Language, count: number, options: { ordinal?: boolean } = {}): string {
    const rule = this.getRule(code, options);

    if (rule) {
      const prepend = this.options.prepend || '_';
      return `${prepend}${options.ordinal ? `ordinal${prepend}` : ''}${rule.select(count)}`;
    }

    this.logger.warn(`no plural rule found for: ${code}`);
    return this.getSuffix('dev', count, options);
  }
}
