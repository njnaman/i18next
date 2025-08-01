/**
 * Post processor implementation for i18next TypeScript migration
 */

import type { BaseModule, TOptions } from '../types/index';

export interface PostProcessorModule extends BaseModule {
  readonly type: 'postProcessor';
  readonly name: string;
  process(
    value: string,
    key: string | readonly string[],
    options: TOptions,
    translator: unknown,
  ): string;
}

class PostProcessor {
  private readonly processors: Map<string, PostProcessorModule>;

  constructor() {
    this.processors = new Map();
  }

  addPostProcessor(module: PostProcessorModule): void {
    this.processors.set(module.name, module);
  }

  handle(
    processors: string | readonly string[],
    value: string,
    key: string | readonly string[],
    options: TOptions,
    translator: unknown,
  ): string {
    const processorNames = Array.isArray(processors) ? processors : [processors];

    return processorNames.reduce((currentValue, processorName) => {
      const processor = this.processors.get(processorName);
      if (processor) {
        return processor.process(currentValue, key, options, translator);
      }
      return currentValue;
    }, value);
  }

  getPostProcessor(name: string): PostProcessorModule | undefined {
    return this.processors.get(name);
  }

  hasPostProcessor(name: string): boolean {
    return this.processors.has(name);
  }

  getPostProcessorNames(): readonly string[] {
    return Array.from(this.processors.keys());
  }
}

const postProcessor = new PostProcessor();

export default postProcessor;
