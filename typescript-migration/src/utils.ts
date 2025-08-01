/**
 * Utility functions for i18next TypeScript migration
 */

import type { Deferred, RegExpCache, PathResult } from '../types';

export const isString = (obj: unknown) => typeof obj === 'string';

export const noop = (): void => {};

// http://lea.verou.me/2016/12/resolve-promises-externally-with-this-one-weird-trick/
export function defer<T = void>(): Deferred<T> {
  let res!: (value: T | PromiseLike<T>) => void;
  let rej!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolve, reject) => {
    res = resolve;
    rej = reject;
  }) as Deferred<T>;

  promise.resolve = res;
  promise.reject = rej;

  return promise;
}

export function makeString(object: unknown): string {
  if (object == null) return '';
  /* eslint prefer-template: 0 */
  return '' + object;
}

export function copy<T extends Record<string, unknown>>(
  a: string[],
  s: T,
  t: Record<string, unknown>,
): void {
  a.forEach(m => {
    if (s[m] !== undefined) t[m] = s[m];
  });
}

// We extract out the RegExp definition to improve performance with React Native Android, which has poor RegExp
// initialization performance
const lastOfPathSeparatorRegExp = /###/g;

function cleanKey(key: string): string {
  return key && key.indexOf('###') > -1 ? key.replace(lastOfPathSeparatorRegExp, '.') : key;
}

function canNotTraverseDeeper(object: unknown): boolean {
  return !object || isString(object);
}

// Factory function for creating empty objects
function createEmptyObject(): Record<string, unknown> {
  return {};
}

function getLastOfPath(
  object: Record<string, unknown>,
  path: string | string[],
  Empty?: () => Record<string, unknown>,
): { obj: Record<string, unknown>; k: string } {
  const stack = !isString(path) ? path : path.split('.');
  let stackIndex = 0;
  // iterate through the stack, but leave the last item
  while (stackIndex < stack.length - 1) {
    if (canNotTraverseDeeper(object)) return { obj: {}, k: '' };

    const key = cleanKey(stack[stackIndex]!);
    if (!object[key] && Empty) object[key] = Empty();
    // prevent prototype pollution
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      object = object[key] as Record<string, unknown>;
    } else {
      object = {};
    }
    ++stackIndex;
  }

  if (canNotTraverseDeeper(object)) return { obj: {}, k: '' };
  return {
    obj: object,
    k: cleanKey(stack[stackIndex]!),
  };
}

export function setPath(
  object: Record<string, unknown>,
  path: string | string[],
  newValue: unknown,
): void {
  const { obj, k } = getLastOfPath(object, path, createEmptyObject);
  if (
    obj !== undefined ||
    (Array.isArray(path) ? path.length === 1 : (path as string).split('.').length === 1)
  ) {
    obj[k] = newValue;
    return;
  }

  const pathArray = Array.isArray(path) ? path : (path as string).split('.');
  let e = pathArray[pathArray.length - 1]!;
  let p = pathArray.slice(0, pathArray.length - 1);
  let last = getLastOfPath(object, p, createEmptyObject);
  while (Object.keys(last.obj).length === 0 && p.length) {
    e = `${p[p.length - 1]!}.${e}`;
    p = p.slice(0, p.length - 1);
    last = getLastOfPath(object, p, createEmptyObject);
    if (last?.obj && typeof last.obj[`${last.k}.${e}`] !== 'undefined') {
      // Create new object instead of modifying readonly property
      // todo check naman.jain
      last = { obj: {}, k: last.k };
    }
  }
  last.obj[`${last.k}.${e}`] = newValue;
}

export function pushPath(
  object: Record<string, unknown>,
  path: string | string[],
  newValue: unknown,
  concat?: boolean,
): void {
  const { obj, k } = getLastOfPath(object, path, createEmptyObject);

  obj[k] = obj[k] || [];
  if (concat) obj[k] = (obj[k] as unknown[]).concat(newValue);
  if (!concat) (obj[k] as unknown[]).push(newValue);
}

export function getPath<T = unknown>(
  object: Record<string, unknown>,
  path: string | string[],
): T | undefined {
  const { obj, k } = getLastOfPath(object, path);

  if (!obj) return undefined;
  if (!Object.prototype.hasOwnProperty.call(obj, k)) return undefined;
  return obj[k] as T;
}

export function getPathWithDefaults<T = unknown>(
  data: Record<string, unknown>,
  defaultData: Record<string, unknown>,
  key: string | string[],
): T | undefined {
  const value = getPath<T>(data, key);
  if (value !== undefined) {
    return value;
  }
  // Fallback to default values
  return getPath<T>(defaultData, key);
}

export function deepExtend<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
  overwrite?: boolean,
): T {
  /* eslint no-restricted-syntax: 0 */
  for (const prop in source) {
    if (prop !== '__proto__' && prop !== 'constructor') {
      if (prop in target) {
        // If we reached a leaf string in target or source then replace with source or skip depending on the 'overwrite' switch
        if (
          isString(target[prop]) ||
          target[prop] instanceof String ||
          isString(source[prop]) ||
          source[prop] instanceof String
        ) {
          if (overwrite) (target as Record<string, unknown>)[prop] = source[prop];
        } else {
          deepExtend(
            target[prop] as Record<string, unknown>,
            source[prop] as Record<string, unknown>,
            overwrite,
          );
        }
      } else {
        (target as Record<string, unknown>)[prop] = source[prop];
      }
    }
  }
  return target;
}

export function regexEscape(str: string): string {
  /* eslint no-useless-escape: 0 */
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

/* eslint-disable */
const _entityMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
};

/* eslint-enable */

export function escape(data: unknown): unknown {
  if (isString(data)) {
    return data.replace(/[&<>"'\/]/g, s => _entityMap[s]!);
  }

  return data;
}

/**
 * This is a reusable regular expression cache class. Given a certain maximum number of regular expressions we're
 * allowed to store in the cache, it provides a way to avoid recreating regular expression objects over and over.
 * When it needs to evict something, it evicts the oldest one.
 */
class RegExpCacheImpl implements RegExpCache {
  public readonly capacity: number;
  public readonly regExpMap: Map<string, RegExp>;
  public readonly regExpQueue: string[];

  constructor(capacity: number) {
    this.capacity = capacity;
    this.regExpMap = new Map();
    // Since our capacity tends to be fairly small, `.shift()` will be fairly quick despite being O(n). We just use a
    // normal array to keep it simple.
    this.regExpQueue = [];
  }

  getRegExp(pattern: string): RegExp {
    const regExpFromCache = this.regExpMap.get(pattern);
    if (regExpFromCache !== undefined) {
      return regExpFromCache;
    }
    const regExpNew = new RegExp(pattern);
    if (this.regExpQueue.length === this.capacity) {
      const oldestPattern = this.regExpQueue.shift();
      if (oldestPattern) {
        this.regExpMap.delete(oldestPattern);
      }
    }
    this.regExpMap.set(pattern, regExpNew);
    this.regExpQueue.push(pattern);
    return regExpNew;
  }
}

const chars = [' ', ',', '?', '!', ';'];
// We cache RegExps to improve performance with React Native Android, which has poor RegExp initialization performance.
// Capacity of 20 should be plenty, as nsSeparator/keySeparator don't tend to vary much across calls.
const looksLikeObjectPathRegExpCache = new RegExpCacheImpl(20);

export function looksLikeObjectPath(
  key: string,
  nsSeparator?: string,
  keySeparator?: string,
): boolean {
  const nsSepr = nsSeparator || '';
  const keySepr = keySeparator || '';
  const possibleChars = chars.filter(c => nsSepr.indexOf(c) < 0 && keySepr.indexOf(c) < 0);
  if (possibleChars.length === 0) return true;
  const r = looksLikeObjectPathRegExpCache.getRegExp(
    `(${possibleChars.map(c => (c === '?' ? '\\?' : c)).join('|')})`,
  );
  let matched = !r.test(key);
  if (!matched) {
    const ki = key.indexOf(keySepr);
    if (ki > 0 && !r.test(key.substring(0, ki))) {
      matched = true;
    }
  }
  return matched;
}

/**
 * Given
 *
 * 1. a top level object obj, and
 * 2. a path to a deeply nested string or object within it
 *
 * Find and return that deeply nested string or object. The caveat is that the keys of objects within the nesting chain
 * may contain period characters. Therefore, we need to DFS and explore all possible keys at each step until we find the
 * deeply nested string or object.
 */
export function deepFind<T = unknown>(
  obj: Record<string, unknown>,
  path: string,
  keySeparator = '.',
): T | undefined {
  if (!obj) return undefined;

  // First check if the exact path exists as a key
  if (Object.prototype.hasOwnProperty.call(obj, path)) {
    return obj[path] as T;
  }

  const tokens = path.split(keySeparator);
  let current: unknown = obj;

  for (let i = 0; i < tokens.length; ) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    let next: unknown;
    let nextPath = '';

    // Try to find the longest possible key match at this level
    for (let j = tokens.length - 1; j >= i; j--) {
      nextPath = tokens.slice(i, j + 1).join(keySeparator);
      const currentObj = current as Record<string, unknown>;

      if (Object.prototype.hasOwnProperty.call(currentObj, nextPath)) {
        next = currentObj[nextPath];
        if (j === tokens.length - 1) {
          // We've matched the entire remaining path
          return next as T;
        }
        // Move to the next part of the path
        i = j + 1;
        break;
      }
    }

    if (next === undefined) {
      return undefined;
    }

    current = next;
  }

  return current as T;
}

export function getCleanedCode(code: string): string {
  return code?.replace('_', '-');
}
