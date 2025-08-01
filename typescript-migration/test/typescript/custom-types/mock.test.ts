import { assertType, describe } from 'vitest';
import { TFunction, WithT, CustomTypeOptions } from '../../../types';

describe('WithT', () => {
  const resources = {} as CustomTypeOptions['resources'];

  assertType<WithT<'custom'>>({
    t: ((key) => {
      const keyValue = resources.custom.bar;
      return keyValue + key;
    }) as TFunction<'custom'>,
  });
});
