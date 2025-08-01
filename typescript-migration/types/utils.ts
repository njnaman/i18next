/**
 * Utility type definitions for i18next TypeScript migration
 */

import type { Deferred } from './core.js';

// Path manipulation types
export type PathSeparator = '.' | '/' | ':';

export interface PathOptions {
  separator?: PathSeparator;
  escape?: boolean;
}

// Object path utilities
export interface PathResult<T = unknown> {
  obj: Record<string, unknown>;
  k: string;
  value?: T;
}

// String utilities
export interface StringUtilities {
  isString(obj: unknown): obj is string;
  makeString(object: unknown): string;
  regexEscape(str: string): string;
  escape(data: unknown): unknown;
  getCleanedCode(code: string): string;
}

// Object utilities
export interface ObjectUtilities {
  copy<T extends Record<string, unknown>>(
    keys: string[],
    source: T,
    target: Record<string, unknown>,
  ): void;

  deepExtend<T extends Record<string, unknown>>(
    target: T,
    source: Record<string, unknown>,
    overwrite?: boolean,
  ): T;

  setPath(object: Record<string, unknown>, path: string | string[], newValue: unknown): void;

  pushPath(
    object: Record<string, unknown>,
    path: string | string[],
    newValue: unknown,
    concat?: boolean,
  ): void;

  getPath<T = unknown>(object: Record<string, unknown>, path: string | string[]): T | undefined;

  getPathWithDefaults<T = unknown>(
    data: Record<string, unknown>,
    defaultData: Record<string, unknown>,
    key: string | string[],
  ): T | undefined;

  deepFind<T = unknown>(
    obj: Record<string, unknown>,
    path: string,
    keySeparator?: string,
  ): T | undefined;
}

// Promise utilities
export interface PromiseUtilities {
  defer<T = void>(): Deferred<T>;
}

// RegExp cache for performance
export interface RegExpCache {
  capacity: number;
  regExpMap: Map<string, RegExp>;
  regExpQueue: string[];

  getRegExp(pattern: string): RegExp;
}

// Object path detection
export interface PathDetection {
  looksLikeObjectPath(key: string, nsSeparator?: string, keySeparator?: string): boolean;
}

// Entity map for HTML escaping
export interface EntityMap {
  [key: string]: string;
}

// Utility functions interface
export interface UtilityFunctions
  extends StringUtilities,
    ObjectUtilities,
    PromiseUtilities,
    PathDetection {
  // RegExp cache utilities
  createRegExpCache(capacity: number): RegExpCache;

  // Path utilities
  cleanKey(key: string): string;
  canNotTraverseDeeper(object: unknown): boolean;
  getLastOfPath(
    object: Record<string, unknown>,
    path: string | string[],
    Empty?: new () => Record<string, unknown>,
  ): PathResult;
}

// Utility constants
export interface UtilityConstants {
  ENTITY_MAP: EntityMap;
  PATH_SEPARATOR_REGEX: RegExp;
  DEFAULT_REGEX_CACHE_CAPACITY: number;
  SPECIAL_CHARS: string[];
}

// Combined utilities export
export interface Utils extends UtilityFunctions, UtilityConstants {}

// Factory for creating utilities
export type UtilsFactory = () => Utils;
