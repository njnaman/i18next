/**
 * Event system type definitions for i18next TypeScript migration
 */

import type { EventListener } from './core.js';

// Event map for tracking listeners
export interface EventObservers {
  [event: string]: Map<EventListener, number>;
}

// Event emitter interface
export interface EventEmitterInterface {
  observers: EventObservers;

  on(events: string, listener: EventListener): this;

  off(event: string, listener?: EventListener): void;

  emit(event: string, ...args: unknown[]): void;
}

// Specific event types for i18next
export interface I18nextEvents {
  initialized: (options: Record<string, unknown>) => void;
  loaded: (loaded: Record<string, Record<string, boolean>>) => void;
  failedLoading: (lng: string, ns: string, msg: string) => void;
  missingKey: (lngs: string[], namespace: string, key: string, res: string) => void;
  added: (lng: string, ns: string) => void;
  removed: (lng: string, ns: string) => void;
  languageChanged: (lng: string) => void;
  languageChanging: (lng: string) => void;
}

// Event emitter class interface
export interface EventEmitter extends EventEmitterInterface {
  new (): EventEmitter;
}

// Event handler types
export type EventHandler<T extends unknown[] = unknown[]> = (...args: T) => void;

export type EventHandlerMap = {
  [K in keyof I18nextEvents]: I18nextEvents[K];
} & {
  [event: string]: EventHandler;
};

// Event subscription interface
export interface EventSubscription {
  event: string;
  listener: EventListener;

  unsubscribe(): void;
}

// Event emitter factory
export type EventEmitterFactory = () => EventEmitter;

// Event context
export interface EventContext {
  target: EventEmitterInterface;
  event: string;
  args: unknown[];
  timestamp: number;
}

// Event middleware
export type EventMiddleware = (context: EventContext, next: () => void) => void;

// Enhanced event emitter with middleware support
export interface EnhancedEventEmitter extends EventEmitterInterface {
  use(middleware: EventMiddleware): this;

  removeMiddleware(middleware: EventMiddleware): this;
}
