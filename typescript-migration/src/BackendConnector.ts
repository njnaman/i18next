/**
 * Backend connector implementation for i18next TypeScript migration
 */

import type {
  BackendModule,
  Services,
  InitOptions,
  Language,
  Namespace,
  ResourceLanguage,
  Logger,
  LanguageUtils,
} from '../types';
import { pushPath, isString, noop } from './utils';
import baseLogger from './logger';
import EventEmitter from './EventEmitter';
import { ResourceStore } from './index';

// Simplified: use simple types like original JavaScript
type QueueItem = {
  pending: Record<string, boolean>;
  pendingCount: number;
  loaded: Record<string, string[]>;
  errors: Error[];
  callback: (errors?: Error[]) => void;
  done?: boolean;
};

type LoadResult = {
  toLoad: string[];
  pending: string[];
  toLoadLanguages: string[];
  toLoadNamespaces: string[];
};

type WaitingRead = {
  lng: Language;
  ns: Namespace;
  fcName: string;
  tried: number;
  wait: number;
  callback: (err: Error | null, data?: ResourceLanguage | boolean) => void;
};

// Simplified: inline types for simple options
type SaveMissingOptions = {
  isUpdate?: boolean;
  [key: string]: unknown;
};

type BackendCallback = (err: Error | null, data?: ResourceLanguage | boolean) => void;

function removePending(q: QueueItem, name: string): void {
  if (q.pending[name] !== undefined) {
    delete q.pending[name];
    q.pendingCount--;
  }
}

class BackendConnector extends EventEmitter {
  public backend: BackendModule | null;
  public store: ResourceStore;
  public services: Services;
  public languageUtils: LanguageUtils;
  public options: InitOptions;
  public logger: Logger;
  public maxParallelReads: number;
  public maxRetries: number;
  public retryTimeout: number;

  public waitingReads: WaitingRead[];
  public readingCalls: number;
  public state: Record<string, number>;
  public queue: QueueItem[];

  constructor(
    backend: BackendModule | null,
    store: ResourceStore,
    services: Services,
    options: InitOptions = {},
  ) {
    super();

    this.backend = backend;
    this.store = store;
    this.services = services;
    this.languageUtils = services.languageUtils;
    this.options = options;
    this.logger = baseLogger.create('backendConnector');

    this.waitingReads = [];
    this.maxParallelReads = options.maxParallelReads || 10;
    this.readingCalls = 0;

    this.maxRetries =
      options.maxRetries !== undefined && options.maxRetries >= 0 ? options.maxRetries : 5;
    this.retryTimeout =
      options.retryTimeout !== undefined && options.retryTimeout >= 1 ? options.retryTimeout : 350;
    this.state = {};
    this.queue = [];

    this.backend?.init?.(services, options.backend || {}, options);
  }

  queueLoad(
    languages: Language[],
    namespaces: Namespace[],
    options: { reload?: boolean },
    callback: (errors?: Error[]) => void = noop,
  ): LoadResult {
    // find what needs to be loaded
    const toLoad: Record<string, boolean> = {};
    const pending: Record<string, boolean> = {};
    const toLoadLanguages: Record<string, boolean> = {};
    const toLoadNamespaces: Record<string, boolean> = {};

    languages.forEach(lng => {
      let hasAllNamespaces = true;

      namespaces.forEach(ns => {
        const name = `${lng}|${ns}`;

        if (!options.reload && this.store.hasResourceBundle(lng, ns)) {
          this.state[name] = 2; // loaded
        } else if ((this.state[name] ?? 0) < 0) {
          // nothing to do for err
        } else if (this.state[name] === 1) {
          if (pending[name] === undefined) pending[name] = true;
        } else {
          this.state[name] = 1; // pending

          hasAllNamespaces = false;

          if (pending[name] === undefined) pending[name] = true;
          if (toLoad[name] === undefined) toLoad[name] = true;
          if (toLoadNamespaces[ns] === undefined) toLoadNamespaces[ns] = true;
        }
      });

      if (!hasAllNamespaces) toLoadLanguages[lng] = true;
    });

    if (Object.keys(toLoad).length || Object.keys(pending).length) {
      this.queue.push({
        pending,
        pendingCount: Object.keys(pending).length,
        loaded: {},
        errors: [],
        callback: callback,
      });
    }

    return {
      toLoad: Object.keys(toLoad),
      pending: Object.keys(pending),
      toLoadLanguages: Object.keys(toLoadLanguages),
      toLoadNamespaces: Object.keys(toLoadNamespaces),
    };
  }

  loaded(name: string, err: Error | null, data?: ResourceLanguage): void {
    const s = name.split('|');
    const lng = s[0]!;
    const ns = s[1]!;

    if (err) this.emit('failedLoading', lng, ns, err);

    if (!err && data) {
      this.store.addResourceBundle(lng, ns, data, undefined, undefined, { skipCopy: true });
    }

    // set loaded
    this.state[name] = err ? -1 : 2;
    if (err && data) this.state[name] = 0;

    // consolidated loading done in this run - only emit once for a loaded namespace
    const loaded: Record<string, Record<string, boolean>> = {};

    // callback if ready
    this.queue.forEach(q => {
      pushPath(q.loaded, [lng], ns);
      removePending(q, name);

      if (err) q.errors.push(err);

      if (q.pendingCount === 0 && !q.done) {
        // only do once per loaded -> this.emit('loaded', q.loaded);
        Object.keys(q.loaded).forEach(l => {
          if (!loaded[l]) loaded[l] = {};
          const loadedKeys = q.loaded[l];
          if (loadedKeys && loadedKeys.length) {
            loadedKeys.forEach(n => {
              if (loaded[l]![n] === undefined) loaded[l]![n] = true;
            });
          }
        });

        /* eslint no-param-reassign: 0 */
        q.done = true;
        if (q.errors.length) {
          q.callback(q.errors);
        } else {
          q.callback();
        }
      }
    });

    // emit consolidated loaded event
    this.emit('loaded', loaded);

    // remove done load requests
    this.queue = this.queue.filter(q => !q.done);
  }

  read(
    lng: Language,
    ns: Namespace,
    fcName: string,
    tried = 0,
    wait = this.retryTimeout,
    callback: BackendCallback,
  ): void {
    if (!lng.length) {
      callback(null, {});
      return;
    }

    // Limit parallelism of calls to backend
    // This is needed to prevent trying to open thousands of
    // sockets or file descriptors, which can cause failures
    // and actually make the entire process take longer.
    if (this.readingCalls >= this.maxParallelReads) {
      this.waitingReads.push({ lng, ns, fcName, tried, wait, callback });
      return;
    }
    this.readingCalls++;

    const resolver = (err: Error | null, data?: ResourceLanguage | boolean): void => {
      this.readingCalls--;
      if (this.waitingReads.length > 0) {
        const next = this.waitingReads.shift()!;
        this.read(next.lng, next.ns, next.fcName, next.tried, next.wait, next.callback);
      }
      if (err && data /* = retryFlag */ && tried < this.maxRetries) {
        setTimeout(() => {
          this.read(lng, ns, fcName, tried + 1, wait * 2, callback);
        }, wait);
        return;
      }
      callback(err, data);
    };

    if (!this.backend) {
      resolver(new Error('No backend configured'));
      return;
    }

    const backendMethod = this.backend[fcName as keyof BackendModule];
    if (typeof backendMethod !== 'function') {
      resolver(new Error(`Backend method ${fcName} not found`));
      return;
    }

    const fc = backendMethod.bind(this.backend) as (...args: unknown[]) => unknown;

    if (fc.length === 2) {
      // no callback
      try {
        const r = fc(lng, ns) as ResourceLanguage | Promise<ResourceLanguage>;
        if (r && typeof (r as Promise<ResourceLanguage>).then === 'function') {
          // promise
          (r as Promise<ResourceLanguage>)
            .then(data => resolver(null, data))
            .catch((error: Error) => resolver(error));
        } else {
          // sync
          resolver(null, r as ResourceLanguage);
        }
      } catch (error) {
        resolver(error as Error);
      }
      return;
    }

    // normal with callback
    fc(lng, ns, resolver);
  }

  prepareLoading(
    languages: Language | Language[],
    namespaces: Namespace | Namespace[],
    options: { reload?: boolean } = {},
    callback?: (errors?: Error[]) => void,
  ): LoadResult | null {
    if (!this.backend) {
      this.logger.warn('No backend was added via i18next.use. Will not load resources.');
      if (callback) callback();
      return null;
    }

    const resolvedLanguages = isString(languages)
      ? this.languageUtils.toResolveHierarchy(languages)
      : languages;
    const resolvedNamespaces = isString(namespaces) ? [namespaces] : namespaces;

    const toLoad = this.queueLoad(resolvedLanguages, resolvedNamespaces, options, callback);
    if (!toLoad.toLoad.length) {
      if (!toLoad.pending.length && callback) callback(); // nothing to load and no pendings...callback now
      return null; // pendings will trigger callback
    }

    toLoad.toLoad.forEach(name => {
      this.loadOne(name);
    });

    return toLoad;
  }

  load(
    languages: Language | Language[],
    namespaces: Namespace | Namespace[],
    callback?: (errors?: Error[]) => void,
  ): void {
    this.prepareLoading(languages, namespaces, {}, callback);
  }

  reload(
    languages: Language | Language[],
    namespaces: Namespace | Namespace[],
    callback?: (errors?: Error[]) => void,
  ): void {
    this.prepareLoading(languages, namespaces, { reload: true }, callback);
  }

  loadOne(name: string, prefix = ''): void {
    const s = name.split('|');
    const lng = s[0]!;
    const ns = s[1]!;

    this.read(lng, ns, 'read', undefined, undefined, (err, data) => {
      if (err) {
        this.logger.warn(`${prefix}loading namespace ${ns} for language ${lng} failed`, err);
      }
      if (!err && data) {
        this.logger.log(`${prefix}loaded namespace ${ns} for language ${lng}`, data);
      }

      this.loaded(name, err, data as ResourceLanguage);
    });
  }

  saveMissing(
    languages: Language[],
    namespace: Namespace,
    key: string,
    fallbackValue: string,
    isUpdate: boolean,
    options: SaveMissingOptions = {},
    clb: (err: Error | null, data?: unknown) => void = noop,
  ): void {
    if (
      this.services?.utils?.hasLoadedNamespace &&
      !this.services.utils.hasLoadedNamespace(namespace)
    ) {
      this.logger.warn(
        `did not save key "${key}" as the namespace "${namespace}" was not yet loaded`,
        'This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!',
      );
      return;
    }

    // ignore non valid keys
    if (key === undefined || key === null || key === '') return;

    if (this.backend?.create) {
      const opts = {
        ...options,
        isUpdate,
      };
      const fc = this.backend.create.bind(this.backend);
      if (fc.length < 6) {
        // no callback
        try {
          let r: unknown;
          if (fc.length === 5) {
            // future callback-less api for i18next-locize-backend
            r = fc([...languages], namespace, key, fallbackValue, undefined, opts);
          } else {
            r = fc([...languages], namespace, key, fallbackValue);
          }
          if (r && typeof (r as Promise<unknown>).then === 'function') {
            // promise
            (r as Promise<unknown>)
              .then(data => clb(null, data))
              .catch((error: Error) => clb(error));
          } else {
            // sync
            clb(null, r);
          }
        } catch (error) {
          clb(error as Error);
        }
      } else {
        // normal with callback
        fc([...languages], namespace, key, fallbackValue, clb, opts);
      }
    }

    // write to store to avoid resending
    if (!languages || !languages[0]) return;
    this.store.addResource(languages[0], namespace, key, fallbackValue);
  }
}

export default BackendConnector;
