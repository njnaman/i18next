/**
 * Main entry point for i18next TypeScript migration
 */

import i18next from './i18next';

// Export additional components
export { default as LanguageUtils } from './LanguageUtils';
export { default as ResourceStore } from './ResourceStore';
export { default as Formatter } from './Formatter';
export { default as PluralResolver } from './PluralResolver';
export { default as Interpolator } from './Interpolator';
export { default as Translator } from './Translator';
export { default as EventEmitter } from './EventEmitter';
export { default as BackendConnector } from './BackendConnector';

export default i18next;

export const createInstance = i18next.createInstance;

export const dir = i18next.dir;
export const init = i18next.init;
export const loadResources = i18next.loadResources;
export const reloadResources = i18next.reloadResources;
export const use = i18next.use;
export const changeLanguage = i18next.changeLanguage;
export const getFixedT = i18next.getFixedT;
export const t = i18next.t;
export const exists = i18next.exists;
export const setDefaultNamespace = i18next.setDefaultNamespace;
export const hasLoadedNamespace = i18next.hasLoadedNamespace;
export const loadNamespaces = i18next.loadNamespaces;
export const loadLanguages = i18next.loadLanguages;

// Export types
export type * from '../types/index';
