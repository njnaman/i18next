import { describe, it, expect } from 'vitest';
import i18next from '../../src/i18next';
import type { BaseModule, TFunction } from '../../types';

// Define the I18nFormat interface for testing
interface TestI18nFormat extends BaseModule {
  type: 'i18nFormat';

  parse(res: string, options: Record<string, unknown>): string;
}

const instance = i18next.createInstance();

describe('extendTranslation', () => {
  describe('parse function should access globals defaultVariables', () => {
    const tests = [
      {
        name: 'should have no impact when no options and no defaultVariables',
        options: {},
        defaultVariables: {},
        expected: {},
      },
      {
        name: 'should have no impact when no defaultVariables is given',
        options: { foo: 'bar' },
        defaultVariables: {},
        expected: { foo: 'bar' },
      },
      {
        name: 'should work when no options are provided',
        options: {},
        defaultVariables: { foo: 'baz' },
        expected: { foo: 'baz' },
      },
      {
        name: 'should be merged with provided options',
        options: { foo: 'bar' },
        defaultVariables: { foo2: 'baz' },
        expected: { foo: 'bar', foo2: 'baz' },
      },
      {
        name: 'should not override provided options',
        options: { foo: 'bar' },
        defaultVariables: { foo: 'baz' },
        expected: { foo: 'bar' },
      },
    ];

    tests.forEach(test => {
      it(`it ${test.name}`, () => {
        instance
          .use({
            type: 'i18nFormat',
            parse: (_res: string, options: Record<string, unknown>) => {
              expect(options).to.deep.equals(test.expected);
            },
          } as TestI18nFormat)
          .init(
            {
              lng: 'en',
              interpolation: {
                defaultVariables: test.defaultVariables,
              },
              resources: {
                en: {
                  translation: {
                    test1: '',
                  },
                },
              },
            },
            (err: Error | null, t: Function | undefined | void) => {
              t?.('translation:test1', test.options);
            },
          );
      });
    });
  });
});
