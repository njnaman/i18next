import { describe, it, expect, beforeAll } from 'vitest';
import BackendConnector from '../../../src/BackendConnector';
import Interpolator from '../../../src/Interpolator';
import ResourceStore from '../../../src/ResourceStore';
import BackendMock from './backendMock';
import type { Services } from '../../../types';

describe('BackendConnector performance test', () => {
  /** @type {BackendConnector} */
  let connector: BackendConnector;

  beforeAll(() => {
    connector = new BackendConnector(
      new BackendMock(),
      new ResourceStore(),
      {
        interpolator: new Interpolator(),
      } as Services,
      {
        backend: { loadPath: 'http://localhost:9876/locales/{{lng}}/{{ns}}.json' },
      },
    );
  });

  describe('#load', () => {
    it('should load 10,000 items in under the 2 second timeout', () => {
      expect.assertions(2);

      const namespaces = [];
      for (let i = 0; i < 10000; i++) {
        namespaces.push(`namespace${i}`);
      }
      connector.load(['en'], namespaces, err => {
        expect(err).toBeFalsy();
        expect(connector.store.getResourceBundle('en', 'namespace1')).toEqual({
          status: 'nok',
          retries: 0,
        });
      });
    });
  });
});
