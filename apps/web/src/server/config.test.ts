import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig({})).toEqual({
      env: 'development',
      isDev: true,
      host: '127.0.0.1',
      port: 3000,
      logLevel: 'info',
      dataDir: resolve('data'),
      databasePath: resolve('data', 'triple-triad.db'),
    });
  });

  it('reads and converts values', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      DATA_DIR: '/srv/triple-triad',
    });

    expect(config).toMatchObject({
      env: 'production',
      isDev: false,
      host: '0.0.0.0',
      port: 8080,
      logLevel: 'warn',
      dataDir: resolve('/srv/triple-triad'),
      databasePath: resolve('/srv/triple-triad', 'triple-triad.db'),
    });
  });

  it('rejects invalid values with a readable message', () => {
    expect(() => loadConfig({ PORT: 'eighty', LOG_LEVEL: 'loud' })).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/);
  });
});
