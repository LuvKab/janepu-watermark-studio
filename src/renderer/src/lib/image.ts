import type { PlacementAnalysisResponse, PlacementSuggestion, TemplateKind } from "@shared/types";

export async function decodeImage(bytes: Uint8Array): Promise<ImageBitmap> {
  const copy = new Uint8Array(bytes);
  // Use the decoder default: Chromium 108 rejects the newer "from-image" enum.
  return createImageBitmap(new Blob([copy]));
}

export async function makeThumbnail(bitmap: ImageBitmap): Promise<string> {
  const scale = Math.min(1, 240 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("无法生成缩略图。"))), "image/jpeg", 0.78),
  );
  return URL.createObjectURL(blob);
}

export async function analyzeBitmap(bitmap: ImageBitmap, template: TemplateKind): Promise<PlacementSuggestion> {
  const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(3, Math.round(bitmap.width * scale));
  const height = Math.max(3, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const worker = new Worker(new URL("../workers/placement.worker.ts", import.meta.url), { type: "module" });
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("自动位置分析超时。"));
    }, 15_000);
    worker.onmessage = (event: MessageEvent<PlacementAnalysisResponse>) => {
      if (event.data.id !== id) return;
      window.clearTimeout(timeout);
      worker.terminate();
      if (event.data.suggestion) resolve(event.data.suggestion);
      else reject(new Error(event.data.error ?? "自动位置分析失败。"));
    };
    worker.onerror = () => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error("自动位置分析失败。"));
    };
    worker.postMessage({ id, width, height, pixels: imageData.data, template }, [imageData.data.buffer]);
  });
}
