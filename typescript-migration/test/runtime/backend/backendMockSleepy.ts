import type {
  BackendModule,
  InitOptions,
  Language,
  Namespace,
  ReadCallback,
  Services,
} from '../../../types';

class BackendMockSleepy implements BackendModule {
  public type = 'backend' as const;
  public retries: Record<Language, number> = {};
  public parallelCalls!: number;
  public parallelCallsHighWaterMark!: number;
  public services: Services | undefined; // definite assignment assertion - initialized in init
  public options: InitOptions | undefined; // definite assignment assertion - initialized in init

  constructor(services?: Services, options: InitOptions = {}) {
    this.init(services, options);
  }

  init(services?: Services, options?: InitOptions) {
    this.services = services;
    this.options = options;
    this.retries = {};
    this.parallelCalls = 0;
    this.parallelCallsHighWaterMark = 0;
  }

  read(language: Language, namespace: Namespace, callback: ReadCallback) {
    this.parallelCalls++;
    if (this.parallelCalls > this.parallelCallsHighWaterMark) {
      this.parallelCallsHighWaterMark = this.parallelCalls;
    }
    setTimeout(() => {
      this.parallelCalls--;
      return callback(null, { status: 'ok' });
    }, 15);
  }
}

export default BackendMockSleepy;
