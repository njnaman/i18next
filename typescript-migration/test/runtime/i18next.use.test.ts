import { describe, it, expect } from 'vitest';
import i18next from '../../src/i18next';
import type { BaseModule } from '../../types';

describe('i18next.use()', () => {
  describe('passing an undefined module', () => {
    it('it should throw accordingly', () => {
      const badFn = () => i18next.use(undefined as any);
      expect(badFn).to.throw(/undefined module/);
    });
  });

  describe('passing a module with wrong interface', () => {
    it('it should throw accordingly', () => {
      const badFn = () => i18next.use({} as BaseModule);
      expect(badFn).to.throw(/wrong module/);
    });
  });
});
