import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, parse, resolve, sep } from "node:path";
import type { LocalImageRecord, LocalWatermarkRecord, OutputFormat, SaveExportRequest, SaveExportResult } from "../shared/types";

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedWatermarkExtensions = new Set([...allowedExtensions, ".svg"]);
const maximumInputBytes = 250 * 1024 * 1024;
const maximumOutputBytes = 300 * 1024 * 1024;
const maximumWatermarkBytes = 20 * 1024 * 1024;
const registeredFiles = new Map<string, string>();
const registeredWatermarks = new Map<string, { path: string; mimeType: LocalWatermarkRecord["mimeType"] }>();
const approvedDirectories = new Set<string>();
const exportedFiles = new Set<string>();

async function readSignature(path: string): Promise<Uint8Array> {
  const handle = await open(path, "r");
  try {
    const bytes = new Uint8Array(12);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    return bytes.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function hasSupportedSignature(bytes: Uint8Array): boolean {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  return jpeg || png || webp;
}

function mimeTypeFor(bytes: Uint8Array): LocalWatermarkRecord["mimeType"] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

function isSafeSvg(bytes: Uint8Array): boolean {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!/<svg(?:\s|>)/i.test(source)) return false;
  return ![
    /<!doctype/i,
    /<script/i,
    /<foreignObject/i,
    /\son[a-z]+\s*=/i,
    /(?:href|src)\s*=\s*["']\s*(?!#|data:image\/(?:png|jpeg|webp);base64,)/i,
    /url\(\s*["']?\s*(?!#|data:image\/(?:png|jpeg|webp);base64,)/i,
  ].some((pattern) => pattern.test(source));
}

export async function registerImagePaths(paths: string[]): Promise<LocalImageRecord[]> {
  const records: LocalImageRecord[] = [];
  const uniquePaths = [...new Set(paths)];

  for (const candidate of uniquePaths) {
    const absolutePath = resolve(candidate);
    if (!allowedExtensions.has(extname(absolutePath).toLowerCase())) continue;

    try {
      const details = await stat(absolutePath);
      if (!details.isFile() || details.size === 0 || details.size > maximumInputBytes) continue;
      if (!hasSupportedSignature(await readSignature(absolutePath))) continue;
      const id = randomUUID();
      registeredFiles.set(id, absolutePath);
      records.push({ id, name: basename(absolutePath), sizeBytes: details.size });
    } catch {
      // An invalid item is skipped so the rest of a batch can still be used.
    }
  }

  return records;
}

export async function registerWatermarkPath(path: string): Promise<LocalWatermarkRecord | null> {
  const absolutePath = resolve(path);
  const extension = extname(absolutePath).toLowerCase();
  if (!allowedWatermarkExtensions.has(extension)) return null;
  try {
    const details = await stat(absolutePath);
    if (!details.isFile() || details.size === 0 || details.size > maximumWatermarkBytes) return null;
    const mimeType = extension === ".svg"
      ? (isSafeSvg(await readFile(absolutePath)) ? "image/svg+xml" as const : null)
      : mimeTypeFor(await readSignature(absolutePath));
    if (!mimeType) return null;
    const id = randomUUID();
    registeredWatermarks.set(id, { path: absolutePath, mimeType });
    return { id, name: basename(absolutePath), sizeBytes: details.size, mimeType };
  } catch {
    return null;
  }
}

export async function readRegisteredImage(id: string): Promise<Uint8Array> {
  const watermark = registeredWatermarks.get(id);
  const path = registeredFiles.get(id) ?? watermark?.path;
  if (!path) throw new Error("图片未登记或当前会话已失效。");
  const bytes = await readFile(path);
  if (watermark) {
    if (bytes.length > maximumWatermarkBytes) throw new Error("Logo 文件过大。");
    if (watermark.mimeType === "image/svg+xml" ? !isSafeSvg(bytes) : !hasSupportedSignature(bytes.subarray(0, 12))) {
      throw new Error("Logo 格式或内容不安全。");
    }
    return bytes;
  }
  if (bytes.length > maximumInputBytes || !hasSupportedSignature(bytes.subarray(0, 12))) {
    throw new Error("图片格式或大小不受支持。");
  }
  return bytes;
}

export function approveOutputDirectory(directory: string): string {
  const normalized = resolve(directory);
  approvedDirectories.add(normalized);
  return normalized;
}

function outputExtension(format: OutputFormat): string {
  return format === "png" ? ".png" : ".jpg";
}

function safeBaseName(sourceName: string): string {
  const parsed = parse(basename(sourceName));
  const cleaned = [...parsed.name]
    .map((character) => (character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character) ? "_" : character))
    .join("")
    .trim();
  return cleaned || "janepu-image";
}

function bytesMatchOutput(bytes: Uint8Array, format: OutputFormat): boolean {
  if (format === "png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function saveExportFile(request: SaveExportRequest): Promise<SaveExportResult> {
  const directory = resolve(request.directory);
  if (!approvedDirectories.has(directory)) throw new Error("请重新选择导出目录。");
  if (request.bytes.length === 0 || request.bytes.length > maximumOutputBytes) throw new Error("导出文件大小异常。");
  if (!bytesMatchOutput(request.bytes, request.format)) throw new Error("导出数据格式与扩展名不一致。");

  await access(directory, constants.W_OK);
  await mkdir(directory, { recursive: true });
  const base = `${safeBaseName(request.sourceName)}_janepu`;
  const extension = outputExtension(request.format);

  for (let index = 1; index <= 9999; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`;
    const fileName = `${base}${suffix}${extension}`;
    const path = join(directory, fileName);
    const normalizedPath = resolve(path);
    if (!normalizedPath.startsWith(`${directory}${sep}`)) throw new Error("导出路径无效。");
    try {
      await writeFile(normalizedPath, request.bytes, { flag: "wx" });
      exportedFiles.add(normalizedPath);
      return { path: normalizedPath, fileName };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }

  throw new Error("导出目录中存在过多同名文件。");
}

export function isKnownExport(path: string): boolean {
  return exportedFiles.has(resolve(path));
}
