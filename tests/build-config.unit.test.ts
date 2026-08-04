import { describe, it, expect } from 'vitest';
import type { ConfigEnv, UserConfig, UserConfigFnObject } from 'vite';
import mainConfig from '../vite.config';
import contentConfig from '../vite.content.config';

/** Resolves a vite config the way `vite build --mode <mode>` would. */
function forMode(config: UserConfigFnObject, mode: string): UserConfig {
  const env: ConfigEnv = { command: 'build', mode, isSsrBuild: false, isPreview: false };
  return config(env);
}

const configs: Array<[string, UserConfigFnObject]> = [
  ['vite.config.ts', mainConfig],
  ['vite.content.config.ts', contentConfig],
];

describe.each(configs)('%s', (_name, config) => {
  it('ships no source map in release mode: that build is what gets published', () => {
    expect(forMode(config, 'release').build?.sourcemap).toBe(false);
  });

  it('keeps the source map in every other mode: that build is loaded unpacked', () => {
    expect(forMode(config, 'production').build?.sourcemap).toBe(true);
    expect(forMode(config, 'development').build?.sourcemap).toBe(true);
  });

  it('writes into dist/', () => {
    expect(forMode(config, 'release').build?.outDir).toBe('dist');
  });
});
