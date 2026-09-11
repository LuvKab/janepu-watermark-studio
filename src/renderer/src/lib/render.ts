import type { ExportSettings, TemplateSettings } from "@shared/types";

export interface Dimensions {
  width: number;
  height: number;
}

export function outputDimensions(sourceWidth: number, sourceHeight: number, settings: ExportSettings): Dimensions {
  return settings.resizeMode === "original" ? { width: sourceWidth, height: sourceHeight } : { width: 1600, height: 1200 };
}

export function imageDestination(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, fit: ExportSettings["fitMode"]) {
  const scale = fit === "cover" ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight) : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

export function resolveWatermarkColor(settings: TemplateSettings): string {
  if (settings.tone === "original") return "transparent";
  if (settings.tone === "custom") return settings.customColor;
  return settings.tone === "light" ? "#f7f4ed" : "#171512";
}

interface LogoDraw {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

function logoDimensions(logo: CanvasImageSource, targetWidth: number) {
  const source = logo as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  const width = source.naturalWidth ?? source.width ?? 1;
  const height = source.naturalHeight ?? source.height ?? 1;
  return { width: targetWidth, height: targetWidth * Math.max(0.05, Math.min(5, height / Math.max(1, width))) };
}

function drawLogo(context: CanvasRenderingContext2D, logo: CanvasImageSource, settings: TemplateSettings, draw: LogoDraw) {
  context.save();
  context.translate(draw.x, draw.y);
  context.rotate((draw.rotation * Math.PI) / 180);
  context.globalAlpha = settings.opacity;

  if (settings.tone === "original") {
    context.drawImage(logo, -draw.width / 2, -draw.height / 2, draw.width, draw.height);
  } else {
    const buffer = document.createElement("canvas");
    buffer.width = Math.max(1, Math.ceil(draw.width));
    buffer.height = Math.max(1, Math.ceil(draw.height));
    const bufferContext = buffer.getContext("2d")!;
    bufferContext.drawImage(logo, 0, 0, buffer.width, buffer.height);
    bufferContext.globalCompositeOperation = "source-in";
    bufferContext.fillStyle = resolveWatermarkColor(settings);
    bufferContext.fillRect(0, 0, buffer.width, buffer.height);
    context.drawImage(buffer, -draw.width / 2, -draw.height / 2, draw.width, draw.height);
  }
  context.restore();
}

export function drawWatermark(
  context: CanvasRenderingContext2D,
  dimensions: Dimensions,
  settings: TemplateSettings,
  logo: CanvasImageSource,
) {
  const { width, height } = dimensions;
  const unit = width / 1600;
  const maximumWidth = settings.template === "corner" ? width * 0.32 : width * 0.78;
  const size = logoDimensions(logo, Math.min(maximumWidth, settings.fontSize * 2.15 * unit));

  if (settings.template === "tile") {
    const stepX = size.width + settings.spacing * unit;
    const stepY = size.height + settings.spacing * 0.72 * unit;
    const diagonal = Math.hypot(width, height);
    for (let y = -diagonal; y <= diagonal * 1.5; y += stepY) {
      for (let x = -diagonal; x <= diagonal * 1.5; x += stepX) {
        const row = Math.round(y / stepY);
        drawLogo(context, logo, settings, {
          x: x + (row % 2 ? stepX / 2 : 0),
          y,
          width: size.width,
          height: size.height,
          rotation: settings.rotation,
        });
      }
    }
  } else {
    drawLogo(context, logo, settings, {
      x: settings.position.x * width,
      y: settings.position.y * height,
      width: size.width,
      height: size.height,
      rotation: settings.rotation,
    });
  }
}

export function renderWatermarked(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource & { width: number; height: number },
  template: TemplateSettings,
  exportSettings: ExportSettings,
  logo: CanvasImageSource,
  previewMax?: Dimensions,
): Dimensions {
  const target = outputDimensions(source.width, source.height, exportSettings);
  const previewScale = previewMax ? Math.min(1, previewMax.width / target.width, previewMax.height / target.height) : 1;
  const dimensions = { width: Math.max(1, Math.round(target.width * previewScale)), height: Math.max(1, Math.round(target.height * previewScale)) };
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: false })!;
  context.fillStyle = "#f4f1eb";
  context.fillRect(0, 0, dimensions.width, dimensions.height);
  const destination = imageDestination(source.width, source.height, dimensions.width, dimensions.height, exportSettings.fitMode);
  context.drawImage(source, destination.x, destination.y, destination.width, destination.height);

  drawWatermark(context, dimensions, template, logo);
  return dimensions;
}

export function canvasToBytes(canvas: HTMLCanvasElement, format: ExportSettings["format"], jpegQuality: number): Promise<Uint8Array> {
  const mime = format === "png" ? "image/png" : "image/jpeg";
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return reject(new Error("无法编码导出图片。"));
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      mime,
      format === "jpeg" ? jpegQuality / 100 : undefined,
    );
  });
}
