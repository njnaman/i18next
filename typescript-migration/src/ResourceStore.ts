import EventEmitter from './EventEmitter';
import { getPath, deepFind, setPath, deepExtend, isString } from './utils';
import type {
  ResourceStoreOptions,
  ResourceStoreData,
  AddResourceOptions,
  AddResourceBundleOptions,
  GetResourceOptions,
  TranslationValue,
} from '../types/core';

/**
 * Resource store for managing translation resources with namespace support
 */
class ResourceStore extends EventEmitter {
  public data: ResourceStoreData;
  public options: ResourceStoreOptions;

  constructor(
    data?: ResourceStoreData,
    options: ResourceStoreOptions = { ns: ['translation'], defaultNS: 'translation' },
  ) {
    super();

    this.data = data || {};
    this.options = { ...options };

    if (this.options.keySeparator === undefined) {
      this.options.keySeparator = '.';
    }

    if (this.options.ignoreJSONStructure === undefined) {
      this.options.ignoreJSONStructure = true;
    }
  }

  /**
   * Add a namespace to the list of available namespaces
   */
  addNamespaces(ns: string): void {
    if (!this.options.ns) {
      this.options.ns = [];
    }

    const namespaces = Array.isArray(this.options.ns) ? [...this.options.ns] : [];
    if (namespaces.indexOf(ns) < 0) {
      namespaces.push(ns);
      this.options.ns = namespaces;
    }
  }

  /**
   * Remove a namespace from the list of available namespaces
   */
  removeNamespaces(ns: string): void {
    if (!this.options.ns || !Array.isArray(this.options.ns)) return;

    const namespaces = [...this.options.ns];
    const index = namespaces.indexOf(ns);
    if (index > -1) {
      namespaces.splice(index, 1);
      this.options.ns = namespaces;
    }
  }

  /**
   * Get a resource value by language, namespace, and key
   */
  getResource(
    lng: string,
    ns: string,
    key?: string | readonly string[],
    options: GetResourceOptions = {},
  ): TranslationValue | undefined {
    const keySeparator =
      options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;

    const ignoreJSONStructure =
      options.ignoreJSONStructure !== undefined
        ? options.ignoreJSONStructure
        : this.options.ignoreJSONStructure;

    let path: string[];

    if (lng.indexOf('.') > -1) {
      path = lng.split('.');
    } else {
      path = [lng, ns];
      if (key) {
        if (Array.isArray(key)) {
          path.push(...key);
        } else if (isString(key) && keySeparator) {
          path.push(...key.split(keySeparator));
        } else if (isString(key)) {
          path.push(key);
        }
      }
    }

    const result = getPath(this.data, path);

    if (!result && !ns && !key && lng.indexOf('.') > -1) {
      const pathParts = lng.split('.');
      const newLng = pathParts[0];
      const newNs = pathParts[1];
      const newKey = pathParts.slice(2).join('.');

      if (newLng && newNs) {
        return this.getResource(newLng, newNs, newKey, options);
      }
    }

    if (result || !ignoreJSONStructure || !isString(key)) {
      return result as TranslationValue | undefined;
    }

    const targetData = this.data?.[lng]?.[ns];
    if (!targetData) return undefined;

    return deepFind(targetData, key, keySeparator || '.');
  }

  /**
   * Add a single resource
   */
  addResource(
    lng: string,
    ns: string,
    key: string,
    value: TranslationValue,
    options: AddResourceOptions = { silent: false },
  ): void {
    const keySeparator =
      options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;

    let path = [lng, ns];

    if (key) {
      path = path.concat(keySeparator ? key.split(keySeparator) : [key]);
    }

    if (lng.indexOf('.') > -1) {
      path = lng.split('.');
      // Reassign parameters when lng contains dots
      const actualValue = ns as TranslationValue;
      const actualNs = path[1];

      if (actualNs) {
        this.addNamespaces(actualNs);
        setPath(this.data, path, actualValue);

        if (!options.silent) {
          this.emit('added', lng, actualNs, key, actualValue);
        }
      }
      return;
    }

    this.addNamespaces(ns);
    setPath(this.data, path, value);

    if (!options.silent) {
      this.emit('added', lng, ns, key, value);
    }
  }

  /**
   * Add multiple resources at once
   */
  addResources(
    lng: string,
    ns: string,
    resources: Record<string, TranslationValue>,
    options: AddResourceOptions = { silent: false },
  ): void {
    for (const key in resources) {
      if (Object.prototype.hasOwnProperty.call(resources, key)) {
        const value = resources[key];
        if (isString(value) || Array.isArray(value)) {
          this.addResource(lng, ns, key, value, { silent: true });
        }
      }
    }

    if (!options.silent) {
      this.emit('added', lng, ns, resources);
    }
  }

  /**
   * Add a resource bundle (entire namespace)
   */
  addResourceBundle(
    lng: string,
    ns: string,
    resources: Record<string, TranslationValue>,
    deep?: boolean,
    overwrite?: boolean,
    options: AddResourceBundleOptions = { silent: false, skipCopy: false },
  ): void {
    let path = [lng, ns];
    let actualResources = resources;
    let actualDeep = deep;

    if (lng.indexOf('.') > -1) {
      path = lng.split('.');
      actualDeep = resources as unknown as boolean;
      actualResources = ns as unknown as Record<string, TranslationValue>;
      const actualNs = path[1];

      if (actualNs) {
        this.addNamespaces(actualNs);
      }
    } else {
      this.addNamespaces(ns);
    }

    let pack = (getPath(this.data, path) as Record<string, unknown>) || {};

    if (!options.skipCopy) {
      actualResources = JSON.parse(JSON.stringify(actualResources)); // make a copy to fix #2081
    }

    if (actualDeep) {
      deepExtend(pack, actualResources as Record<string, unknown>, overwrite);
    } else {
      pack = { ...pack, ...actualResources };
    }

    setPath(this.data, path, pack);

    if (!options.silent) {
      const actualNs = lng.indexOf('.') > -1 ? path[1] : ns;
      this.emit('added', lng, actualNs, actualResources);
    }
  }

  /**
   * Remove a resource bundle
   */
  removeResourceBundle(lng: string, ns: string): void {
    if (this.hasResourceBundle(lng, ns)) {
      delete this.data[lng]?.[ns];
    }

    this.removeNamespaces(ns);
    this.emit('removed', lng, ns);
  }

  /**
   * Check if a resource bundle exists
   */
  hasResourceBundle(lng: string, ns: string): boolean {
    return this.getResource(lng, ns) !== undefined;
  }

  /**
   * Get an entire resource bundle
   */
  getResourceBundle(lng: string, ns?: string): TranslationValue | undefined {
    const namespace = ns || this.options.defaultNS;
    if (!namespace) return undefined;

    return this.getResource(lng, namespace);
  }

  /**
   * Get all data for a specific language
   */
  getDataByLanguage(lng: string): Record<string, Record<string, TranslationValue>> | undefined {
    return this.data[lng];
  }

  /**
   * Check if a language has any translations
   */
  hasLanguageSomeTranslations(lng: string): boolean {
    const data = this.getDataByLanguage(lng);
    const namespaces = (data && Object.keys(data)) || [];

    return !!namespaces.find(namespace => {
      const nsData = data?.[namespace];
      return nsData && Object.keys(nsData).length > 0;
    });
  }

  /**
   * Convert the entire store to JSON
   */
  toJSON(): ResourceStoreData {
    return this.data;
  }
}

export default ResourceStore;
