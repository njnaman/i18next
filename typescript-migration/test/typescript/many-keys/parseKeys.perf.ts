import { t, ParseKeys } from '../../../types';

const getKey: () => ParseKeys<['generic']> = () => 'ahTLUS';
const result = t(getKey());

// eslint-disable-next-line no-console
console.info(result);
