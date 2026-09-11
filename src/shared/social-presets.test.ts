import { describe, expect, it } from "vitest";
import { defaultSocialSizePresetId, getSocialSizePreset, socialPresetPlatforms, socialSizePresets } from "./social-presets";

describe("social size presets", () => {
  it("keeps every preset id unique and every dimension within the Canvas limit", () => {
    expect(new Set(socialSizePresets.map((preset) => preset.id)).size).toBe(socialSizePresets.length);
    for (const preset of socialSizePresets) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      expect(preset.width).toBeLessThanOrEqual(32767);
      expect(preset.height).toBeLessThanOrEqual(32767);
    }
  });

  it("includes the core vertical, square, and landscape publishing platforms", () => {
    expect(socialPresetPlatforms).toEqual(expect.arrayContaining(["小红书", "TikTok", "Instagram", "Facebook", "YouTube", "Pinterest", "LinkedIn", "X / Twitter"]));
    expect(getSocialSizePreset(defaultSocialSizePresetId)).toMatchObject({ width: 1242, height: 1656, ratio: "3:4" });
    expect(getSocialSizePreset("tiktok-vertical")).toMatchObject({ width: 1080, height: 1920, ratio: "9:16" });
  });
});
