import { describe, it, assertType } from 'vitest';
import { t } from '../../../src/index';
import type { ParseKeys } from '../../../types';

describe('ParseKeys', () => {
  it('`t` should accept result of a function returning a list of keys', () => {
    const getKey: () => ParseKeys<['generic']> = () => 'ahTLUS';
    const result = t(getKey());

    assertType<string>(result);
  });
});
