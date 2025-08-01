import { describe, it, beforeAll, vitest, expect } from 'vitest';
import i18next from '../../src/i18next';
import BackendMock from './backend/backendMock';

describe('i18next backend', () => {
  const i18n = i18next.createInstance();

  beforeAll(() => {
    i18n.use(new BackendMock()).init({
      fallbackLng: 'en',
      fallbackNS: 'concurrently',
      ns: [],
      defaultNS: '',
    });
  });

  describe('loadNamespaces concurrently', () => {
    it('should load data correctly', async () => {
      let finished = 0;
      const loadedClb = (index: number) => {
        const cb = () => {
          const handlingNS = index === 1 ? 'concurrentlyLonger' : 'concurrently';
          finished += index;
          if (i18n.t('status') !== 'ok')
            throw Error(`Expected "${i18n.t('status')}" to equal "ok"`);

          if (i18n.t('namespace', { ns: handlingNS }) !== handlingNS)
            throw Error(
              `Expected "${i18n.t('namespace', { ns: handlingNS })}" to equal "${handlingNS}"`,
            );
        };

        return cb;
      };

      setTimeout(() => {
        i18n.loadNamespaces(['concurrentlyLonger']).then(loadedClb(1));
        i18n.loadNamespaces(['concurrently']).then(loadedClb(2));
      }, 0);

      await vitest.waitFor(() => expect(finished).toBe(3));
    });
  });
});
