import { createInstance } from '../../../src/index';
import type { LanguageDetectorAsyncModule, LanguageDetectorModule } from '../../../types';

let i18n = createInstance();
i18n
  .use<LanguageDetectorModule>({
    type: 'languageDetector',
    detect: () => 'en',
  })
  .init();

i18n = createInstance();
i18n
  .use<LanguageDetectorAsyncModule>({
    type: 'languageDetector',
    async: true,
    detect: (clb) => clb('en'),
  })
  .init();

i18n = createInstance();
i18n
  .use<LanguageDetectorAsyncModule>({
    type: 'languageDetector',
    async: true,
    detect: async () => 'en',
  })
  .init();

i18n = createInstance();
i18n
  .use({
    type: 'languageDetector',
    async: true,
    detect: (clb: (lng: string) => void) => clb('en'),
  })
  .init();
