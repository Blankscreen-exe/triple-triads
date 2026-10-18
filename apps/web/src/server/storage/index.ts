/**
 * The storage used by Next.js server code (server actions and the /media route), chosen by the
 * STORAGE_DRIVER setting.
 */
import { loadConfig, type StorageConfig } from '../config';
import { createMinioStorage } from './minio-storage';
import { createLocalStorage, type FileStorage } from './storage';

const globalForStorage = globalThis as typeof globalThis & { __tripleTriadStorage?: FileStorage };

export function createStorage(config: StorageConfig): FileStorage {
  return config.driver === 'minio' ? createMinioStorage(config) : createLocalStorage(config.dir);
}

export function getStorage(): FileStorage {
  globalForStorage.__tripleTriadStorage ??= createStorage(loadConfig(process.env).storage);
  return globalForStorage.__tripleTriadStorage;
}
