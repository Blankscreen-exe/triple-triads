/**
 * MinIO (or any S3-compatible service) backend for FileStorage.
 */
import { Client, type BucketItem } from 'minio';
import { contentTypeFor, isValidStorageKey, type FileStorage } from './storage';

export interface MinioStorageOptions {
  readonly endPoint: string;
  readonly port: number;
  readonly useSSL: boolean;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly bucket: string;
}

export function createMinioStorage(options: MinioStorageOptions): FileStorage {
  const client = new Client({
    endPoint: options.endPoint,
    port: options.port,
    useSSL: options.useSSL,
    accessKey: options.accessKey,
    secretKey: options.secretKey,
  });
  const { bucket } = options;

  // Created on first use rather than at construction, so creating the storage never blocks or
  // throws; a connection problem surfaces on the first real operation.
  let ready: Promise<void> | undefined;
  const ensureBucket = () => {
    ready ??= client.bucketExists(bucket).then(async (exists) => {
      if (!exists) await client.makeBucket(bucket);
    });
    // Let a failed attempt be retried next time.
    ready.catch(() => {
      ready = undefined;
    });
    return ready;
  };

  const checkKey = (key: string) => {
    if (!isValidStorageKey(key)) throw new RangeError(`Invalid storage key: ${key}`);
  };

  return {
    async put(key, data) {
      checkKey(key);
      await ensureBucket();
      await client.putObject(bucket, key, data, data.byteLength, {
        'Content-Type': contentTypeFor(key),
      });
    },

    async get(key) {
      if (!isValidStorageKey(key)) return null;
      await ensureBucket();
      try {
        const stream = await client.getObject(bucket, key);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(chunk as Buffer);
        return { data: Buffer.concat(chunks), contentType: contentTypeFor(key) };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async delete(key) {
      checkKey(key);
      await ensureBucket();
      await client.removeObject(bucket, key);
    },

    async deleteFolder(folder) {
      checkKey(folder);
      await ensureBucket();
      const names: string[] = [];
      const listing: AsyncIterable<BucketItem> = client.listObjectsV2(bucket, `${folder}/`, true);
      for await (const item of listing) {
        if (item.name) names.push(item.name);
      }
      if (names.length > 0) await client.removeObjects(bucket, names);
    },
  };
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'NoSuchKey' || error.code === 'NotFound')
  );
}
