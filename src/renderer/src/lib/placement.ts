import type { PlacementSuggestion, TemplateKind } from "@shared/types";

interface Metrics {
  mean: number;
  variance: number;
  edge: number;
}

interface Candidate {
  x: number;
  y: number;
  width: number;
  height: number;
  collisionPenalty?: number;
}

function makeIntegral(values: Float64Array, width: number, height: number): Float64Array {
  const stride = width + 1;
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= width; x += 1) {
      rowSum += values[(y - 1) * width + x - 1];
      integral[y * stride + x] = integral[(y - 1) * stride + x] + rowSum;
    }
  }
  return integral;
}

function sumRect(integral: Float64Array, width: number, x: number, y: number, w: number, h: number): number {
  const stride = width + 1;
  const x2 = x + w;
  const y2 = y + h;
  return integral[y2 * stride + x2] - integral[y * stride + x2] - integral[y2 * stride + x] + integral[y * stride + x];
}

function calculateFields(pixels: Uint8ClampedArray, width: number, height: number) {
  const luminance = new Float64Array(width * height);
  const luminanceSquared = new Float64Array(width * height);
  const edge = new Float64Array(width * height);

  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const value = (0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2]) / 255;
    luminance[i] = value;
    luminanceSquared[i] = value * value;
  }

  const at = (x: number, y: number) => luminance[y * width + x];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const gx =
        -at(x - 1, y - 1) + at(x + 1, y - 1) - 2 * at(x - 1, y) + 2 * at(x + 1, y) - at(x - 1, y + 1) + at(x + 1, y + 1);
      const gy =
        -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      edge[y * width + x] = Math.min(1, Math.hypot(gx, gy) / 4);
    }
  }

  return {
    luminance: makeIntegral(luminance, width, height),
    squared: makeIntegral(luminanceSquared, width, height),
    edge: makeIntegral(edge, width, height),
  };
}

function metricsFor(fields: ReturnType<typeof calculateFields>, imageWidth: number, imageHeight: number, candidate: Candidate): Metrics {
  const w = Math.max(2, Math.min(imageWidth, Math.round(candidate.width * imageWidth)));
  const h = Math.max(2, Math.min(imageHeight, Math.round(candidate.height * imageHeight)));
  const x = Math.max(0, Math.min(imageWidth - w, Math.round((candidate.x - candidate.width / 2) * imageWidth)));
  const y = Math.max(0, Math.min(imageHeight - h, Math.round((candidate.y - candidate.height / 2) * imageHeight)));
  const area = w * h;
  const mean = sumRect(fields.luminance, imageWidth, x, y, w, h) / area;
  const meanSquared = sumRect(fields.squared, imageWidth, x, y, w, h) / area;
  return {
    mean,
    variance: Math.max(0, meanSquared - mean * mean),
    edge: sumRect(fields.edge, imageWidth, x, y, w, h) / area,
  };
}

function cornerCandidates(): Candidate[] {
  return [
    { x: 0.18, y: 0.11, width: 0.27, height: 0.11 },
    { x: 0.18, y: 0.32, width: 0.27, height: 0.11 },
    { x: 0.82, y: 0.32, width: 0.27, height: 0.11 },
    { x: 0.18, y: 0.69, width: 0.27, height: 0.11 },
    { x: 0.82, y: 0.69, width: 0.27, height: 0.11 },
    { x: 0.82, y: 0.88, width: 0.27, height: 0.11, collisionPenalty: 0.18 },
  ];
}

function wideMarkCandidates(): Candidate[] {
  return [
    { x: 0.5, y: 0.36, width: 0.9, height: 0.2 },
    { x: 0.5, y: 0.5, width: 0.9, height: 0.2 },
    { x: 0.5, y: 0.64, width: 0.9, height: 0.2 },
    { x: 0.5, y: 0.75, width: 0.9, height: 0.2, collisionPenalty: 0.08 },
  ];
}

export function suggestPlacement(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  template: TemplateKind,
): PlacementSuggestion {
  if (width < 3 || height < 3 || pixels.length !== width * height * 4) {
    throw new Error("分析图像数据无效。");
  }

  const fields = calculateFields(pixels, width, height);
  const candidates = template === "corner" ? cornerCandidates() : wideMarkCandidates();
  let best: { candidate: Candidate; metrics: Metrics; score: number } | undefined;

  for (const candidate of candidates) {
    const metrics = metricsFor(fields, width, height, candidate);
    const contrast = Math.max(metrics.mean, 1 - metrics.mean);
    const score =
      template === "corner"
        ? contrast * 1.2 - metrics.edge * 3.1 - metrics.variance * 2.4 - (candidate.collisionPenalty ?? 0)
        : contrast * 0.45 + Math.min(metrics.edge, 0.16) * 2.2 - Math.abs(metrics.edge - 0.08) * 0.8 - metrics.variance * 0.35 - (candidate.collisionPenalty ?? 0);
    if (!best || score > best.score) best = { candidate, metrics, score };
  }

  const selected = best!;
  return {
    position: { x: selected.candidate.x, y: selected.candidate.y },
    tone: selected.metrics.mean >= 0.53 ? "dark" : "light",
    opacity: template === "corner" ? 0.8 : selected.metrics.variance > 0.07 ? 0.18 : 0.14,
    score: Number(selected.score.toFixed(6)),
  };
}

export function clampPoint(x: number, y: number) {
  return { x: Math.max(0.04, Math.min(0.96, x)), y: Math.max(0.04, Math.min(0.96, y)) };
}
