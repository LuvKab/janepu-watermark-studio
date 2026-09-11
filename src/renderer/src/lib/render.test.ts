import { describe, expect, it } from "vitest";
import { imageDestination, outputDimensions, resolveWatermarkColor } from "./render";

describe("render geometry", () => {
  it("defaults to the 1600 by 1200 delivery canvas", () => {
    expect(outputDimensions(900, 1600, { resizeMode: "fixed", fitMode: "contain", format: "jpeg", jpegQuality: 92 })).toEqual({ width: 1600, height: 1200 });
  });

  it("can preserve source dimensions", () => {
    expect(outputDimensions(2048, 1365, { resizeMode: "original", fitMode: "contain", format: "png", jpegQuality: 92 })).toEqual({ width: 2048, height: 1365 });
  });

  it("contains without cropping and covers with centered cropping", () => {
    expect(imageDestination(1600, 900, 1600, 1200, "contain")).toEqual({ x: 0, y: 150, width: 1600, height: 900 });
    const cover = imageDestination(1600, 900, 1600, 1200, "cover");
    expect(cover.x).toBeCloseTo(-266.6667, 3);
    expect(cover.y).toBe(0);
    expect(cover.width).toBeCloseTo(2133.3333, 3);
    expect(cover.height).toBe(1200);
  });

  it("resolves dark, light, and custom watermark colors", () => {
    const base = { template: "corner" as const, position: { x: 0.1, y: 0.1 }, fontSize: 100, opacity: 1, customColor: "#81766a", placementMode: "manual" as const, strength: "custom" as const, rotation: 0, spacing: 80 };
    expect(resolveWatermarkColor({ ...base, tone: "original" })).toBe("transparent");
    expect(resolveWatermarkColor({ ...base, tone: "dark" })).toBe("#171512");
    expect(resolveWatermarkColor({ ...base, tone: "light" })).toBe("#f7f4ed");
    expect(resolveWatermarkColor({ ...base, tone: "custom" })).toBe("#81766a");
  });
});
