import type {
  BackendModule,
  InitOptions,
  Language,
  Namespace,
  ReadCallback,
  Services,
} from '../../../types';

class BackendMockPromise implements BackendModule {
  public type = 'backend' as const;

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
    this.created = {};
  }

  // eslint-disable-next-line class-methods-use-this
  read(language: Language, namespace: Namespace) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ status: 'ok', language, namespace });
      }, 15);
    });
  }

  // async read(language, namespace) {
  //   const r = await new Promise((resolve) => {
  //     setTimeout(() => {
  //       resolve({ status: 'ok', language, namespace });
  //     }, 15);
  //   })
  //   return r
  // }

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
    return new Promise<void>(resolve => {
      setTimeout(() => resolve(), 15);
    });
  }
}

export default BackendMockPromise;
