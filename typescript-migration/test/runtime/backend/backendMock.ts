import type {
  BackendModule,
  InitOptions,
  Language,
  MultiReadCallback,
  Namespace,
  ReadCallback,
  ResourceLanguage,
  Services,
} from '../../../types';

class BackendMock implements BackendModule {
  public type = 'backend' as const;
  public retries: Record<Language, number> = {};
  public created: Record<
    Language,
    Record<
      string,
      Record<
        string,
        {
          fallbackValue: string;
          options: Record<string, unknown>;
        }
      >
    >
  > = {};
  public services: Services | undefined; // definite assignment assertion - initialized in init
  public options: InitOptions | undefined; // definite assignment assertion - initialized in init

  constructor(services?: Services, options: InitOptions = {}) {
    this.init(services, options);
  }

  init(services?: Services, options?: InitOptions) {
    this.services = services;
    this.options = options;
    this.retries = {};
    this.created = {};
  }

  read(language: Language, namespace: Namespace, callback: ReadCallback) {
    if (!this.retries[language]) this.retries[language] = 0;

    if (namespace.indexOf('fail') === 0) {
      return callback('failed loading', true);
    }
    if (namespace === 'retry0') {
      this.retries[language]++;
      return callback('failed loading', true);
    }
    if (namespace === 'retry1' && this.retries[language] < 1) {
      this.retries[language]++;
      return callback('failed loading', true);
    }
    if (namespace === 'retry2' && this.retries[language] < 2) {
      this.retries[language]++;
      return callback('failed loading', true);
    }
    if (namespace === 'retry5' && this.retries[language] < 5) {
      this.retries[language]++;
      return callback('failed loading', true);
    }
    if (namespace === 'retry6' && this.retries[language] < 6) {
      this.retries[language]++;
      return callback('failed loading', true);
    }
    if (namespace === 'retry7' && this.retries[language] < 7) {
      this.retries[language]++;
      return callback('failed loading', true);

      // // Is a retry, but not set to fail after a specific
      // } else if (namespace.indexOf('retry') === 0) {

      // }
    }
    if (namespace.indexOf('concurrentlyLonger') === 0) {
      setTimeout(() => {
        callback(null, { status: 'ok', namespace });
      }, 400);
    } else if (namespace.indexOf('concurrently') === 0) {
      setTimeout(() => {
        callback(null, { status: 'ok', namespace });
      }, 200);
    } else if (namespace.indexOf('normal') === 0) {
      callback(null, { status: 'ok', namespace, language });
    } else {
      callback(null, { status: 'nok', retries: this.retries[language] });
      delete this.retries[language];
    }
  }

  readMulti(languages: Language[], namespaces: Namespace[], callback: ReadCallback) {
    const language = languages[0];
    const namespace = namespaces[0];

    if (!this.retries[language]) this.retries[language] = 0;

    if (namespace === 'retry2' && this.retries[language] < 2) {
      this.retries[language]++;
      return callback('failed loading', true);
    }
    callback(null, {
      [language]: { [namespace]: { status: 'nok', retries: this.retries[language] } },
    });
    delete this.retries[language];
  }

  create(
    languages: Language[],
    namespace: Namespace,
    key: string,
    fallbackValue: string,
    callback: (err: Error | null, data?: unknown) => void,
    options: Record<string, unknown>,
  ) {
    languages.forEach(l => {
      this.created[l] = this.created[l] || {};
      this.created[l][namespace] = this.created[l][namespace] || {};
      this.created[l][namespace][key] = {
        fallbackValue,
        options,
      };
    });
    callback(null);
  }

  save?(language: Language, namespace: Namespace, data: ResourceLanguage): void {
    throw new Error('Method not implemented.');
  }
}

export default BackendMock;
