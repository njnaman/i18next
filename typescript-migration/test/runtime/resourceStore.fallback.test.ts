import { describe, it, expect } from 'vitest';
import ResourceStore from '../../src/ResourceStore';

describe('ResourceStore', () => {
  describe('nestedFlatFallback', () => {
    it('it should find the resource in various flat/nested combinations', () => {
      const data = {
        en: {
          translation: {
            a: {
              nested: 'a nested value',
              'more.of': {
                nested: {
                  here: {
                    wow: 'cool',
                  },
                  'and.even.more': {
                    gaga: 'strange',
                  },
                },
              },
            },
            'a.flat': 'a flat value',
            'b.flat': {
              nested: 'mix value',
              more: {
                nesting: 'deep',
                'flat.again': 'deep flat',
              },
              more2: {
                'flat.again': 'deep flat',
                deeper: {
                  key: 'very deep',
                },
              },
            },
            str: 'whatever',
            'x.y': 'please no',
          },
        },
      };
      const rs = new ResourceStore(data);
      expect(rs.toJSON()).toBe(data);

      let ret = rs.getResource('en', 'translation', 'a.nested');
      expect(ret).toBe('a nested value');

      ret = rs.getResource('en', 'translation', 'a.flat');
      expect(ret).toBe('a flat value');

      ret = rs.getResource('en', 'translation', 'b.flat.nested');
      expect(ret).toBe('mix value');

      ret = rs.getResource('en', 'translation', 'b.flat.more.nesting');
      expect(ret).toBe('deep');

      ret = rs.getResource('en', 'translation', 'b.flat.more.flat.again');
      expect(ret).toBe('deep flat');

      ret = rs.getResource('en', 'translation', 'b.flat.more2.flat.again');
      expect(ret).toBe('deep flat');

      ret = rs.getResource('en', 'translation', 'b.flat.more2.deeper.key');
      expect(ret).toBe('very deep');

      ret = rs.getResource('en', 'translation', 'a.more.of.nested.here.wow');
      expect(ret).toBe('cool');

      ret = rs.getResource('en', 'translation', 'a.more.of.nested.and.even.more.gaga');
      expect(ret).toBe('strange');

      ret = rs.getResource('en', 'translation', 'a.wrong');
      expect(ret).toBe(undefined);

      ret = rs.getResource('en', 'translation', 'str.wrong');
      expect(ret).toBe(undefined);

      ret = rs.getResource('en', 'translation', 'x.y.z');
      expect(ret).toBe(undefined);
    });
  });
});
