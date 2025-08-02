import { describe, it, expect, beforeEach } from 'vitest';
import i18next from '../../src/i18next';
import {
  type BackendModule,
  type InitOptions,
  type Language,
  type LogArgs,
  LoggerModule,
  type Namespace,
  type ReadCallback,
  type Services,
} from '../../types';

const Logger: LoggerModule = {
  type: 'logger',

  entries: {
    log: [],
    warn: [],
    error: [],
  },

  log(...args: LogArgs) {
    this.entries.log.push(args[0]);
  },
  warn(...args: LogArgs) {
    this.entries.warn.push(args[0]);
  },
  error(...args: LogArgs) {
    this.entries.error.push(args[0]);
  },

  reset() {
    this.entries = {
      log: [],
      warn: [],
      error: [],
    };
  },
};

class Backend implements BackendModule {
  public type = 'backend' as const;
  public services: Services | undefined; // definite assignment assertion - initialized in init
  public options: InitOptions | undefined; // definite assignment assertion - initialized in init
  public created: string[] = [];

  init(services: Services, options: InitOptions) {
    this.services = services;
    this.options = options;
  }

  read(language: Language, namespace: Namespace, callback: ReadCallback) {
    if (namespace.indexOf('fail') === 0) return callback('failed', false);
    callback(null, { status: 'ok', key: `${language}-${namespace}` });
  }

  create(languages: Language[], namespace: Namespace, key: string) {
    this.created.push(`${languages.join('-')}-${namespace}-${key}`);
  }

  reset() {
    this.created = [];
  }
}

/** @type {import('i18next').i18n} */
let i18n = i18next.createInstance();
const backendInstance = new Backend();
i18n.use(backendInstance);
i18n.use(Logger);

describe('i18next', () => {
  describe('hasLoadedNamespace', () => {
    describe('not called init()', () => {
      it('it should nok', () => {
        expect(i18n.isInitialized).toBeFalsy();
        expect(i18n.hasLoadedNamespace('ns1')).toBeFalsy();
      });
    });

    describe('called init() not detecting lng', () => {
      it('it should ok - but warn about issue', async () => {
        expect(i18n.isInitialized).toBeFalsy();
        expect(i18n.isInitializing).toBeFalsy();
        const prom = i18n.init({ debug: true, saveMissing: true });
        expect(i18n.isInitializing).toBeTruthy();
        expect(i18n.isInitialized).toBeFalsy();
        await prom;
        expect(i18n.isInitializing).toBeFalsy();
        expect(i18n.isInitialized).toBeTruthy();

        expect(i18n.hasLoadedNamespace('translation')).toBe(false);

        expect(Logger.entries.warn[0]).toBe(
          'i18next: init: no languageDetector is used and no lng is defined',
        );
        expect(Logger.entries.warn[1]).toBe(
          'i18next: hasLoadedNamespace: i18n.languages were undefined or empty',
        );
        Logger.reset();
      });
    });

    describe('called init() properly', () => {
      beforeEach(
        () =>
          new Promise<void>(resolve => {
            debugger;
            i18n = i18n.cloneInstance({ debug: true, saveMissing: true, lng: 'en-US' }, () => {
              resolve();
            });
          }),
      );

      it('it should ok for loaded ns', () => {
        debugger;
        expect(i18n.hasLoadedNamespace('translation')).toBeTruthy();
      });

      it('it should nok for not loaded ns', () => {
        expect(i18n.hasLoadedNamespace('ns1')).toBeFalsy();
      });

      describe('translator - calling t', () => {
        it('it should not log anything if loaded ns', () => {
          i18n.t('keyNotFound');
          expect(Logger.entries.warn.length).toBe(0);
          Logger.reset();
        });

        it('it should not call saveMissing create on backend if not loaded ns', () => {
          i18n.t('ns1:keyNotFound');

          expect(Logger.entries.warn.length).toBe(3);
          expect(Logger.entries.warn[0]).toBe(
            'i18next::translator: key "keyNotFound" for languages "en-US, en, dev" won\'t get resolved as namespace "ns1" was not yet loaded',
          );
          Logger.reset();
        });
      });

      describe('backendConnector - saveMissing', () => {
        it('it should call saveMissing create on backend if loaded ns', () => {
          i18n.t('keyNotFound');
          expect(backendInstance.created.length).toBe(1);
          expect(backendInstance.created[0]).toBe('dev-translation-keyNotFound');
          backendInstance.reset();
        });

        it('it should not call saveMissing create on backend if not loaded ns', () => {
          i18n.t('ns1:keyNotFound');

          expect(backendInstance.created.length).toBe(0);
          backendInstance.reset();

          expect(Logger.entries.warn.length).toBe(2);
          expect(Logger.entries.warn[1]).toBe(
            'i18next::backendConnector: did not save key "keyNotFound" as the namespace "ns1" was not yet loaded',
          );
          Logger.reset();
        });
      });
    });

    describe('for a namespace failed loading', () => {
      beforeEach(async () => {
        await i18n.loadNamespaces('fail-ns');
      });

      it('it should ok for loaded ns', () => {
        expect(i18n.hasLoadedNamespace('fail-ns')).toBe(true);
      });
    });
  });
});
