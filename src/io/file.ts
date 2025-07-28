import fs from 'fs/promises';
import path from 'path';

/**
 * ファイルを読み込む
 */
export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * ファイルを書き込む
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * バイナリファイルを書き込む
 */
export async function writeBinaryFile(filePath: string, data: Buffer): Promise<void> {
  await fs.writeFile(filePath, data);
}

/**
 * JSONファイルを読み込む
 */
export async function readJSON<T = any>(filePath: string): Promise<T> {
  const content = await readFile(filePath);
  return JSON.parse(content);
}

/**
 * JSONファイルを書き込む
 */
export async function writeJSON(filePath: string, data: any, pretty: boolean = true): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await writeFile(filePath, content);
}

/**
 * ディレクトリを作成（再帰的）
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * ファイルが存在するかチェック
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * ディレクトリが存在するかチェック
 */
export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * ファイルを削除
 */
export async function removeFile(filePath: string): Promise<void> {
  await fs.unlink(filePath);
}

/**
 * ディレクトリを削除（再帰的）
 */
export async function removeDir(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

/**
 * ファイルをコピー
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await fs.copyFile(src, dest);
}

/**
 * ディレクトリ内のファイル一覧を取得
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  return await fs.readdir(dirPath);
}

/**
 * ファイルの情報を取得
 */
export async function getFileInfo(filePath: string) {
  const stat = await fs.stat(filePath);
  return {
    size: stat.size,
    modified: stat.mtime,
    created: stat.birthtime,
    isFile: stat.isFile(),
    isDirectory: stat.isDirectory()
  };
}

// Image comparison functions from image.ts
export { compareImages } from './image.js';