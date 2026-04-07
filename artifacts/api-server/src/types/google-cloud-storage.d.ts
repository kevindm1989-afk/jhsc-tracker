declare module "@google-cloud/storage" {
  export interface StorageOptions {
    credentials?: Record<string, unknown>;
    projectId?: string;
    [key: string]: unknown;
  }
  export class Storage {
    constructor(options?: StorageOptions);
    bucket(name: string): Bucket;
  }
  export class Bucket {
    file(name: string): File;
  }
  export class File {
    name: string;
    exists(): Promise<[boolean]>;
    setMetadata(metadata: Record<string, unknown>): Promise<void[]>;
    getMetadata(): Promise<[{ metadata?: Record<string, string>; [key: string]: unknown }]>;
    save(data: Buffer | string | NodeJS.ReadableStream, options?: Record<string, unknown>): Promise<void>;
    createReadStream(options?: Record<string, unknown>): NodeJS.ReadableStream;
    delete(options?: Record<string, unknown>): Promise<void[]>;
    getSignedUrl(options: Record<string, unknown>): Promise<[string]>;
    copy(dest: File | string): Promise<unknown>;
  }
}
