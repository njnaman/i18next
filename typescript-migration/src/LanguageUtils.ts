import baseLogger from './logger';
import { getCleanedCode, isString } from './utils';
import type { LanguageUtilsOptions, FallbackLng, FallbackLngObject } from '../types/core';
import type { LoggerInterface } from '../types';

/**
 * Language utility class for handling language codes, fallbacks, and resolution
 */
class LanguageUtils {
  private options: LanguageUtilsOptions;
  private supportedLngs: string[] | false;
  private logger: LoggerInterface;

  constructor(options: LanguageUtilsOptions) {
    this.options = options;
    this.supportedLngs = this.options.supportedLngs || false;
    this.logger = baseLogger.create('languageUtils');
  }

  /**
   * Extract script part from language code (e.g., 'zh-Hans-CN' -> 'zh-Hans')
   */
  getScriptPartFromCode(code: string): string | null {
    const cleanedCode = getCleanedCode(code);
    if (!cleanedCode || cleanedCode.indexOf('-') < 0) return null;

    const parts = cleanedCode.split('-');
    if (parts.length === 2) return null;

    parts.pop();
    if (parts[parts.length - 1]?.toLowerCase() === 'x') return null;

    return this.formatLanguageCode(parts.join('-'));
  }

  /**
   * Extract language part from language code (e.g., 'en-US' -> 'en')
   */
  getLanguagePartFromCode(code: string): string {
    const cleanedCode = getCleanedCode(code);
    if (!cleanedCode || cleanedCode.indexOf('-') < 0) return cleanedCode;

    const parts = cleanedCode.split('-');
    return this.formatLanguageCode(parts[0] || '');
  }

  /**
   * Format language code according to IANA standards and options
   */
  formatLanguageCode(code: string): string {
    // http://www.iana.org/assignments/language-tags/language-tags.xhtml
    if (isString(code) && code.indexOf('-') > -1) {
      let formattedCode: string | undefined;

      try {
        formattedCode = Intl.getCanonicalLocales(code)[0];
      } catch (e) {
        // Fall through
      }

      if (formattedCode && this.options.lowerCaseLng) {
        formattedCode = formattedCode.toLowerCase();
      }

      if (formattedCode) return formattedCode;

      if (this.options.lowerCaseLng) {
        return code.toLowerCase();
      }

      return code;
    }

    return this.options.cleanCode || this.options.lowerCaseLng ? code.toLowerCase() : code;
  }

  /**
   * Check if language code is supported
   */
  isSupportedCode(code: string): boolean {
    let checkCode = code;

    if (this.options.load === 'languageOnly' || this.options.nonExplicitSupportedLngs) {
      checkCode = this.getLanguagePartFromCode(code);
    }

    return (
      !this.supportedLngs ||
      !this.supportedLngs.length ||
      this.supportedLngs.indexOf(checkCode) > -1
    );
  }

  /**
   * Get best matching language code from array of codes
   */
  getBestMatchFromCodes(codes: readonly string[]): string | null {
    if (!codes) return null;

    let found: string | undefined;

    // Pick first supported code or if no restriction pick the first one (highest prio)
    codes.forEach(code => {
      if (found) return;
      const cleanedLng = this.formatLanguageCode(code);
      if (!this.options.supportedLngs || this.isSupportedCode(cleanedLng)) {
        found = cleanedLng;
      }
    });

    // If we got no match in supportedLngs yet - check for similar locales
    // First: de-CH --> de
    // Second: de-CH --> de-DE
    if (!found && this.options.supportedLngs) {
      codes.forEach(code => {
        if (found) return;

        const lngScOnly = this.getScriptPartFromCode(code);
        if (lngScOnly && this.isSupportedCode(lngScOnly)) {
          found = lngScOnly;
          return;
        }

        const lngOnly = this.getLanguagePartFromCode(code);
        if (this.isSupportedCode(lngOnly)) {
          found = lngOnly;
          return;
        }

        // Find matching supported language with more specific locale
        if (Array.isArray(this.supportedLngs)) {
          found = this.supportedLngs.find((supportedLng: string) => {
            if (supportedLng === lngOnly) return supportedLng;
            if (supportedLng.indexOf('-') < 0 && lngOnly.indexOf('-') < 0) return undefined;

            if (
              supportedLng.indexOf('-') > 0 &&
              lngOnly.indexOf('-') < 0 &&
              supportedLng.substring(0, supportedLng.indexOf('-')) === lngOnly
            ) {
              return supportedLng;
            }

            if (supportedLng.indexOf(lngOnly) === 0 && lngOnly.length > 1) {
              return supportedLng;
            }

            return undefined;
          });
        }
      });
    }

    // If nothing found, use fallbackLng
    if (!found) {
      const fallbackCodes = this.getFallbackCodes(this.options.fallbackLng);
      found = fallbackCodes[0];
    }

    return found || null;
  }

  /**
   * Get fallback language codes
   */
  // todo to be checked naman.jain

  getFallbackCodes(fallbacks?: FallbackLng, code?: string): string[] {
    if (!fallbacks) return [];

    let processedFallbacks: string | string[] | FallbackLngObject | false;

    if (typeof fallbacks === 'function') {
      processedFallbacks = fallbacks(code);
    } else {
      processedFallbacks = fallbacks;
    }

    if (processedFallbacks === false) {
      return [];
    }

    if (isString(processedFallbacks)) {
      processedFallbacks = [processedFallbacks];
    }

    if (Array.isArray(processedFallbacks)) {
      return processedFallbacks;
    }

    if (!code) {
      if (
        typeof processedFallbacks === 'object' &&
        !Array.isArray(processedFallbacks) &&
        processedFallbacks !== null
      ) {
        const fallbackObj = processedFallbacks as unknown as FallbackLngObject;
        const defaultFallback = fallbackObj.default;
        if (Array.isArray(defaultFallback)) {
          return defaultFallback;
        } else if (typeof defaultFallback === 'string') {
          return [defaultFallback];
        }
        return [];
      }
      return [];
    }

    // Handle object-based fallbacks
    if (
      typeof processedFallbacks === 'object' &&
      !Array.isArray(processedFallbacks) &&
      processedFallbacks !== null
    ) {
      const fallbackObj = processedFallbacks as unknown as FallbackLngObject;
      let found = fallbackObj[code];

      if (!found) found = fallbackObj[this.getScriptPartFromCode(code) || ''];
      if (!found) found = fallbackObj[this.formatLanguageCode(code)];
      if (!found) found = fallbackObj[this.getLanguagePartFromCode(code)];
      if (!found) found = fallbackObj.default;

      if (Array.isArray(found)) {
        return found;
      } else if (typeof found === 'string') {
        return [found];
      }
      return [];
    }

    // Should not reach here, but return empty array as fallback
    return [];
  }

  /**
   * Create language resolution hierarchy
   */
  toResolveHierarchy(code: string, fallbackCode?: FallbackLng | false): string[] {
    const fallbackCodes = this.getFallbackCodes(
      (fallbackCode === false ? [] : fallbackCode) || this.options.fallbackLng || [],
      code,
    );

    const codes: string[] = [];

    const addCode = (c: string): void => {
      if (!c) return;
      if (this.isSupportedCode(c)) {
        codes.push(c);
      } else {
        this.logger.warn(`rejecting language code not found in supportedLngs: ${c}`);
      }
    };

    if (isString(code) && (code.indexOf('-') > -1 || code.indexOf('_') > -1)) {
      if (this.options.load !== 'languageOnly') {
        addCode(this.formatLanguageCode(code));
      }

      if (this.options.load !== 'languageOnly' && this.options.load !== 'currentOnly') {
        const scriptPart = this.getScriptPartFromCode(code);
        if (scriptPart) addCode(scriptPart);
      }

      if (this.options.load !== 'currentOnly') {
        addCode(this.getLanguagePartFromCode(code));
      }
    } else if (isString(code)) {
      addCode(this.formatLanguageCode(code));
    }

    fallbackCodes.forEach(fc => {
      if (codes.indexOf(fc) < 0) {
        addCode(this.formatLanguageCode(fc));
      }
    });

    return codes;
  }
}

export default LanguageUtils;
