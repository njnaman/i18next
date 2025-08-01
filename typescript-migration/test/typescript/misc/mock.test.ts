import { describe, it, expectTypeOf } from 'vitest';
import { TFunction, WithT } from '../../../types';

describe('WithT', () => {
  it('should infer correct type', () => {
    expectTypeOf<WithT>().toHaveProperty('t').toEqualTypeOf<TFunction>();
  });
});
