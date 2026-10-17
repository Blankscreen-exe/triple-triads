/**
 * The storage used by Next.js server code (server actions and the /media route).
 */
import { join } from 'node:path';
import { loadConfig } from '../config';
import { createLocalStorage, type FileStorage } from './storage';

const globalForStorage = globalThis as typeof globalThis & { __tripleTriadStorage?: FileStorage };

export function getStorage(): FileStorage {
  globalForStorage.__tripleTriadStorage ??= createLocalStorage(
    join(loadConfig(process.env).dataDir, 'uploads'),
  );
  return globalForStorage.__tripleTriadStorage;
}
