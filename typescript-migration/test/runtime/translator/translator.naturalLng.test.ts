import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

describe('Translator', () => {
  describe('naturalLng', () => {
    let t: Translator;

    beforeAll(() => {
      await instance.init({
        lng: 'en',
        fallbackLng: 'en',
        resources: {
          en: {
            translation: {
              'test: with a sentence. or more text': 'test_en',
              errorCodes: {
                UNAUTHORIZED: 'Unauthorized',
                'BAD REQUEST': 'Bad request',
              },
              UNAUTHORIZED: 'Unauthorized 2',
              'BAD REQUEST': 'Bad request 2',
            },
            test: {
              anotherKey: 'from other ns',
              'key with space': 'key with space from other ns',
            },
          },
          de: {
            translation: {
              'test: with a sentence. or more text': 'test_de',
            },
          },
        },
      });
    });

    const tests = [
      { args: ['test: with a sentence. or more text'], expected: 'test_en' },
      {
        args: ['test: with a sentence. or more text', { lngs: ['en-US', 'en'] }],
        expected: 'test_en',
      },
      { args: ['test: with a sentence. or more text', { lngs: ['de'] }], expected: 'test_de' },
      { args: ['test: with a sentence. or more text', { lng: 'de' }], expected: 'test_de' },
      { args: ['test: with a sentence. or more text', { lng: 'fr' }], expected: 'test_en' },
      { args: ['test: with a sentence. or more text', { lng: 'en-US' }], expected: 'test_en' },
      { args: ['test:anotherKey', { lng: 'en' }], expected: 'from other ns' },
      { args: ['errorCodes.UNAUTHORIZED', { lng: 'en' }], expected: 'Unauthorized' },
      { args: ['errorCodes.BAD REQUEST', { lng: 'en' }], expected: 'Bad request' },
      { args: ['translation:errorCodes.UNAUTHORIZED', { lng: 'en' }], expected: 'Unauthorized' },
      { args: ['translation:errorCodes.BAD REQUEST', { lng: 'en' }], expected: 'Bad request' },
      { args: ['translation:UNAUTHORIZED', { lng: 'en' }], expected: 'Unauthorized 2' },
      {
        args: ['translation:BAD REQUEST', { lng: 'en', keySeparator: '.' }],
        expected: 'Bad request 2',
      },
      {
        args: ['test:key with space', { lng: 'en', nsSeparator: ':' }],
        expected: 'key with space from other ns',
      },
    ];

    tests.forEach((test) => {
      it(`correctly formats translations for ${JSON.stringify(test.args)}`, () => {
        expect(instance.t.apply(instance, test.args)).toEqual(test.expected);
      });
    });
  });
});
