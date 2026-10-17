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
    });
  });

  it('reads and converts values', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: '8080',
      LOG_LEVEL: 'warn',
    });

    expect(config).toEqual({
      env: 'production',
      isDev: false,
      host: '0.0.0.0',
      port: 8080,
      logLevel: 'warn',
    });
  });

  it('rejects invalid values with a readable message', () => {
    expect(() => loadConfig({ PORT: 'eighty', LOG_LEVEL: 'loud' })).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/);
  });
});
