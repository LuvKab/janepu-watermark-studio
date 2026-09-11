import { describe, expect, it } from "vitest";
import { clampPoint, suggestPlacement } from "./placement";

function solidPixels(width: number, height: number, value: number) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = value;
    pixels[index * 4 + 1] = value;
    pixels[index * 4 + 2] = value;
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

describe("content-aware placement", () => {
  it("selects a dark mark on a bright image", () => {
    const result = suggestPlacement(solidPixels(48, 36, 244), 48, 36, "corner");
    expect(result.tone).toBe("dark");
    expect(result.position.x).toBe(0.18);
    expect([0.11, 0.32, 0.69]).toContain(result.position.y);
    expect(result.opacity).toBe(0.8);
  });

  it("selects a light mark on a dark image", () => {
    const result = suggestPlacement(solidPixels(48, 36, 24), 48, 36, "center");
    expect(result.tone).toBe("light");
    expect(result.position).toEqual({ x: 0.5, y: 0.36 });
    expect(result.opacity).toBe(0.14);
  });

  it("is deterministic for identical image data", () => {
    const pixels = solidPixels(64, 48, 180);
    for (let y = 12; y < 36; y += 1) {
      for (let x = 18; x < 50; x += 1) pixels[(y * 64 + x) * 4] = (x + y) % 2 ? 20 : 245;
    }
    expect(suggestPlacement(pixels, 64, 48, "diagonal")).toEqual(suggestPlacement(pixels, 64, 48, "diagonal"));
  });

  it("keeps manual points inside the canvas safety margin", () => {
    expect(clampPoint(-1, 2)).toEqual({ x: 0.04, y: 0.96 });
  });

  it("rejects malformed image buffers", () => {
    expect(() => suggestPlacement(new Uint8ClampedArray(4), 10, 10, "corner")).toThrow("分析图像数据无效");
  });
});
