import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default defineConfig([
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/esm/i18next.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      resolve({
        preferBuiltins: false,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist/esm',
        outDir: 'dist/esm',
      }),
    ],
    external: ['@babel/runtime'],
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/cjs/i18next.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
    },
    plugins: [
      resolve({
        preferBuiltins: false,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        outDir: 'dist/cjs',
      }),
    ],
    external: ['@babel/runtime'],
  },
  // UMD build (minified)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/umd/i18next.min.js',
      format: 'umd',
      name: 'i18next',
      sourcemap: true,
    },
    plugins: [
      resolve({
        preferBuiltins: false,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        outDir: 'dist/umd',
      }),
      terser(),
    ],
  },
]);
