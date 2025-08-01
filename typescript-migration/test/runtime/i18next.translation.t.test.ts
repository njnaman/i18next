import { describe, it, expect, beforeAll } from 'vitest';
import i18next from '../../src/i18next';

describe('i18next t default returns', () => {
  /** @type {import('i18next').i18n} */
  let i18n;
  beforeAll(() => {
    i18n = i18next.createInstance();
    i18n.init({
      fallbackLng: 'en',
      resources: {
        en: {
          translation: {
            key: 'normal',
            keyNull: null,
            keyEmpty: '',
          },
        },
      },
    });
  });

  it('it should not return null values by default', () => {
    expect(i18n.t('key')).toBe('normal');
    expect(i18n.t('keyNull')).toBe('keyNull');
    expect(i18n.t('keyEmpty')).toBe('');
  });

  it('it should not return Object prototype stuff', () => {
    expect(i18n.t('constructor')).toBe('constructor');
    expect(i18n.t('constructor_test')).toBe('constructor_test');
    expect(i18n.t('hasOwnProperty')).toBe('hasOwnProperty');
    expect(i18n.t('__defineGetter__')).toBe('__defineGetter__');
    expect(i18n.t('__defineSetter__')).toBe('__defineSetter__');
    expect(i18n.t('__lookupGetter__')).toBe('__lookupGetter__');
    expect(i18n.t('__lookupSetter__')).toBe('__lookupSetter__');
    expect(i18n.t('__proto__')).toBe('__proto__');
  });

  it('it should not crash for undefined or null keys', () => {
    expect(i18n.t(null)).toBe('');
    expect(i18n.t(undefined)).toBe('');
    expect(i18n.t()).toBe('');
  });
});
