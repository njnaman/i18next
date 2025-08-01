/* eslint no-param-reassign: 0 */
// import logger from '../logger';

import type {InitOptions, I18n, Callback, BaseModule} from "../../../types";

// Legacy v1 options interface for compatibility
interface LegacyOptions extends Record<string, unknown> {
    interpolationPrefix?: string;
    interpolationSuffix?: string;
    escapeInterpolation?: boolean;
    reusePrefix?: string;
    reuseSuffix?: string;
    resStore?: unknown;
    ns?: string | string[] | { defaultNs?: string; namespaces?: string[] };
    fallbackToDefaultNS?: boolean;
    sendMissing?: boolean;
    sendMissingTo?: string;
    fallbackOnNull?: boolean;
    fallbackOnEmpty?: boolean;
    returnObjectTrees?: boolean;
    objectTreeKeyHandler?: unknown;
    parseMissingKey?: unknown;
    nsseparator?: string;
    keyseparator?: string;
    shortcutFunction?: string;
    lngWhitelist?: string[];
    resGetPath?: string;
    resPostPath?: string;
    dynamicLoad?: boolean;
    useLocalStorage?: boolean;
    defaultVariables?: Record<string, unknown>;
}

function convertInterpolation(options: InitOptions & LegacyOptions): InitOptions & LegacyOptions {
    // Initialize interpolation object with legacy properties
    options.interpolation = {
        ...(options.interpolation || {}),
        // TypeScript doesn't recognize this legacy property, so we cast
        unescapeSuffix: 'HTML',
    } as InitOptions['interpolation'] & { unescapeSuffix: string };

    // Safely set interpolation properties
    if (options.interpolation) {
        options.interpolation.prefix = options.interpolationPrefix || '__';
        options.interpolation.suffix = options.interpolationSuffix || '__';
        options.interpolation.escapeValue = options.escapeInterpolation || false;

        options.interpolation.nestingPrefix = options.reusePrefix || '$t(';
        options.interpolation.nestingSuffix = options.reuseSuffix || ')';
    }

    return options;
}

export function convertAPIOptions(options: LegacyOptions): LegacyOptions {
    if (options.resStore) options.resources = options.resStore;

    if (options.ns && typeof options.ns === 'object' && 'defaultNs' in options.ns) {
        options.defaultNS = options.ns.defaultNs;
        options.ns = options.ns.namespaces;
    } else {
        options.defaultNS = options.ns || 'translation';
    }

    if (options.fallbackToDefaultNS && options.defaultNS) options.fallbackNS = options.defaultNS;

    options.saveMissing = options.sendMissing;
    options.saveMissingTo = options.sendMissingTo || 'current';
    options.returnNull = !options.fallbackOnNull;
    options.returnEmptyString = !options.fallbackOnEmpty;
    options.returnObjects = options.returnObjectTrees;
    options.joinArrays = '\n';

    options.returnedObjectHandler = options.objectTreeKeyHandler;
    options.parseMissingKeyHandler = options.parseMissingKey;
    options.appendNamespaceToMissingKey = true;

    options.nsSeparator = options.nsseparator || ':';
    options.keySeparator = options.keyseparator || '.';

    if (options.shortcutFunction === 'sprintf') {
        options.overloadTranslationOptionHandler = function handle(args: unknown[]): Record<string, unknown> {
            const values: unknown[] = [];

            for (let i = 1; i < args.length; i++) {
                values.push(args[i]);
            }

            return {
                postProcess: 'sprintf',
                sprintf: values,
            };
        };
    }

    if (options.shortcutFunction === 'defaultValue') {
        options.overloadTranslationOptionHandler = function handle(args: unknown[]): Record<string, unknown> {
            return {defaultValue: args[1]};
        };
    }

    options.supportedLngs = options.lngWhitelist;
    // options.preload = options.preload;
    if (options.load === 'current') options.load = 'currentOnly';
    if (options.load === 'unspecific') options.load = 'languageOnly';

    // backend
    options.backend = options.backend || {};
    (options.backend as Record<string, unknown>).loadPath = options.resGetPath || 'locales/__lng__/__ns__.json';
    (options.backend as Record<string, unknown>).addPath = options.resPostPath || 'locales/add/__lng__/__ns__';
    (options.backend as Record<string, unknown>).allowMultiLoading = options.dynamicLoad;

    // cache
    options.cache = options.cache || {};
    (options.cache as Record<string, unknown>).prefix = 'res_';
    (options.cache as Record<string, unknown>).expirationTime = 7 * 24 * 60 * 60 * 1000;
    (options.cache as Record<string, unknown>).enabled = options.useLocalStorage;

    options = convertInterpolation(options as InitOptions & LegacyOptions);
    if (options.defaultVariables && options.interpolation) {
        (options.interpolation as Record<string, unknown>).defaultVariables = options.defaultVariables;
    }

    // COMPATIBILITY: deprecation
    // if (options.getAsync === false) throw deprecation error

    return options;
}

export function convertJSONOptions(options: LegacyOptions): LegacyOptions {
    options = convertInterpolation(options as InitOptions & LegacyOptions);
    options.joinArrays = '\n';

    return options;
}

export function convertTOptions(options: LegacyOptions): LegacyOptions {
    if (
        options.interpolationPrefix ||
        options.interpolationSuffix ||
        options.escapeInterpolation !== undefined
    ) {
        options = convertInterpolation(options as InitOptions & LegacyOptions);
    }

    options.nsSeparator = options.nsseparator;
    options.keySeparator = options.keyseparator;

    options.returnObjects = options.returnObjectTrees;

    return options;
}

export function appendBackwardsAPI(i18n: I18n): void {
    (i18n as I18n & Record<string, unknown>).lng = (): string =>
        // logger.deprecate('i18next.lng() can be replaced by i18next.language for detected language or i18next.languages for languages ordered by translation lookup.');
        i18n.services.languageUtils.toResolveHierarchy(i18n.language)[0];

    (i18n as I18n & Record<string, unknown>).hasLoadedNamespace = (): boolean => true;

    (i18n as I18n & Record<string, unknown>).preload = (lngs: unknown, cb: unknown): void => {
        // logger.deprecate('i18next.preload() can be replaced with i18next.loadLanguages()');
        i18n.loadLanguages(lngs as string | string[], cb as Callback | undefined);
    };

    (i18n as I18n & Record<string, unknown>).setLng = (lng: unknown, options?: unknown, callback?: unknown): unknown => {
        // logger.deprecate('i18next.setLng() can be replaced with i18next.changeLanguage() or i18next.getFixedT() to get a translation function with fixed language or namespace.');
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        if (!options) options = {};

        if (options && typeof options === 'object' && 'fixLng' in options && (options as Record<string, unknown>).fixLng === true) {
            if (callback) {
                const fixedT = i18n.getFixedT(lng as string);
                return (callback as (error: Error | null, result: unknown) => void)(null, fixedT);
            }
        }

        return i18n.changeLanguage(lng as string, callback as Callback);
    };

    (i18n as I18n & Record<string, unknown>).addPostProcessor = (name: unknown, fc: unknown): void => {
        // logger.deprecate('i18next.addPostProcessor() can be replaced by i18next.use({ type: \'postProcessor\', name: \'name\', process: fc })');
        i18n.use({
            type: 'postProcessor',
            name,
            process: fc,
        } as BaseModule & { name: unknown; process: unknown });
    };
}
