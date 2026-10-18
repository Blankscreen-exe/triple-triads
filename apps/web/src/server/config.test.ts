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
      secureCookies: false,
      storage: { driver: 'local', dir: resolve('data', 'uploads') },
    });
  });

  it('makes cookies HTTPS-only in production unless told otherwise', () => {
    expect(loadConfig({ NODE_ENV: 'production' }).secureCookies).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production', SECURE_COOKIES: 'false' }).secureCookies).toBe(
      false,
    );
  });

  it('configures MinIO storage and requires its credentials', () => {
    expect(
      loadConfig({
        STORAGE_DRIVER: 'minio',
        MINIO_ENDPOINT: 'minio.internal',
        MINIO_ACCESS_KEY: 'key',
        MINIO_SECRET_KEY: 'secret',
        MINIO_USE_SSL: 'true',
      }).storage,
    ).toEqual({
      driver: 'minio',
      endPoint: 'minio.internal',
      port: 9000,
      useSSL: true,
      accessKey: 'key',
      secretKey: 'secret',
      bucket: 'triple-triad',
    });
    expect(() => loadConfig({ STORAGE_DRIVER: 'minio' })).toThrow(/MINIO_ENDPOINT/);
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
