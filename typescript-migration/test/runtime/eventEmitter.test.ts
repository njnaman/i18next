import { describe, it, expect, beforeEach, vitest } from 'vitest';
import EventEmitter from '../../src/EventEmitter';
import type { EventListener } from '../../types';

describe('i18next', () => {
  describe('published', () => {
    /** @type {EventEmitter}  */
    let emitter: EventEmitter;
    beforeEach(() => {
      emitter = new EventEmitter();
    });

    it('it should emit', () => {
      const activeHandler = vitest.fn();
      const disabledHandler = vitest.fn();

      expect(activeHandler).not.toHaveBeenCalled();
      expect(disabledHandler).not.toHaveBeenCalled();

      emitter.on('ok', activeHandler);
      emitter.off('nok', disabledHandler);

      emitter.emit('ok', 'data ok');
      emitter.emit('nok', 'there should be no listener');

      expect(activeHandler).toHaveBeenCalled();
      expect(activeHandler).toHaveBeenCalledWith('data ok');
      expect(disabledHandler).not.toHaveBeenCalled();
    });

    it('should emit twice if a handler was attached twice', () => {
      const calls: number[] = [];
      const listener: EventListener<[number]> = (payload: number) => {
        calls.push(payload);
      };

      emitter.on('events', listener);
      emitter.on('events', listener);
      emitter.emit('events', 1);

      expect(calls).toEqual([1, 1]);
    });

    it('it should emit wildcard', () => {
      expect.assertions(2);

      const wildcardListener: EventListener<[string, string]> = (name: string, payload: string) => {
        expect(name).toBe('ok');
        expect(payload).toBe('data ok');
      };

      emitter.on('*', wildcardListener);

      emitter.emit('ok', 'data ok');
    });

    it('it should emit with array params', () => {
      expect.assertions(2);

      const arrayListener: EventListener<[string[], string]> = (array: string[], data: string) => {
        expect(array).toEqual(['array ok 1', 'array ok 2']);
        expect(data).toBe('data ok');
      };

      emitter.on('array-event', arrayListener);

      emitter.emit('array-event', ['array ok 1', 'array ok 2'], 'data ok');
    });

    it('it should emit wildcard with array params', () => {
      expect.assertions(3);

      // test on
      const wildcardArrayListener: EventListener<[string, string[], string]> = (
        ev: string,
        array: string[],
        data: string,
      ) => {
        expect(ev).toBe('array-event');
        expect(array).toEqual(['array ok 1', 'array ok 2']);
        expect(data).toBe('data ok');
      };

      emitter.on('*', wildcardArrayListener);

      emitter.emit('array-event', ['array ok 1', 'array ok 2'], 'data ok');
    });

    it('it should return itself', () => {
      // test on
      const emptyListener: EventListener<[]> = () => {};
      const returned = emitter.on('*', emptyListener);

      expect(returned).toBe(emitter);
    });

    it('it should correctly unbind observers', () => {
      const calls1: number[] = [];
      const listener1: EventListener<[number]> = (payload: number) => {
        calls1.push(payload);
      };

      const calls2: number[] = [];
      const listener2: EventListener<[number]> = (payload: number) => {
        calls2.push(payload);
      };

      const calls3: number[] = [];
      const listener3: EventListener<[number]> = (payload: number) => {
        calls3.push(payload);
      };

      emitter.on('events', listener1);
      emitter.on('events', listener2);
      emitter.on('events', listener3);
      emitter.on('events', listener1);

      emitter.emit('events', 1);
      emitter.off('events', listener1);
      emitter.emit('events', 2);
      emitter.off('events', listener2);
      emitter.emit('events', 3);
      emitter.off('events', listener2);
      emitter.off('events');
      emitter.emit('events', 4);

      expect(calls1).toEqual([1, 1]);
      expect(calls2).toEqual([1, 2]);
      expect(calls3).toEqual([1, 2, 3]);
    });
  });
});
