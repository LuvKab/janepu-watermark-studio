export const socialSizePresets = [
  { id: "xiaohongshu-portrait", platform: "小红书", label: "图文竖版", width: 1242, height: 1656, ratio: "3:4" },
  { id: "xiaohongshu-square", platform: "小红书", label: "方图", width: 1080, height: 1080, ratio: "1:1" },
  { id: "xiaohongshu-landscape", platform: "小红书", label: "横版", width: 1656, height: 1242, ratio: "4:3" },
  { id: "tiktok-vertical", platform: "TikTok", label: "视频 / 封面", width: 1080, height: 1920, ratio: "9:16" },
  { id: "instagram-portrait", platform: "Instagram", label: "图文竖版", width: 1080, height: 1350, ratio: "4:5" },
  { id: "instagram-square", platform: "Instagram", label: "方图", width: 1080, height: 1080, ratio: "1:1" },
  { id: "instagram-story", platform: "Instagram", label: "Story / Reel", width: 1080, height: 1920, ratio: "9:16" },
  { id: "facebook-portrait", platform: "Facebook", label: "信息流竖版", width: 1080, height: 1350, ratio: "4:5" },
  { id: "facebook-square", platform: "Facebook", label: "信息流方图", width: 1080, height: 1080, ratio: "1:1" },
  { id: "facebook-landscape", platform: "Facebook", label: "信息流横版", width: 1200, height: 630, ratio: "1.91:1" },
  { id: "facebook-story", platform: "Facebook", label: "Story / Reel", width: 1080, height: 1920, ratio: "9:16" },
  { id: "youtube-thumbnail", platform: "YouTube", label: "视频缩略图", width: 3840, height: 2160, ratio: "16:9" },
  { id: "youtube-shorts", platform: "YouTube", label: "Shorts 缩略图", width: 2160, height: 3840, ratio: "9:16" },
  { id: "pinterest-pin", platform: "Pinterest", label: "标准 Pin", width: 1000, height: 1500, ratio: "2:3" },
  { id: "linkedin-landscape", platform: "LinkedIn", label: "信息流横版", width: 1200, height: 628, ratio: "1.91:1" },
  { id: "linkedin-square", platform: "LinkedIn", label: "信息流方图", width: 1200, height: 1200, ratio: "1:1" },
  { id: "linkedin-portrait", platform: "LinkedIn", label: "信息流竖版", width: 720, height: 900, ratio: "4:5" },
  { id: "x-landscape", platform: "X / Twitter", label: "信息流横版", width: 1200, height: 675, ratio: "16:9" },
  { id: "x-square", platform: "X / Twitter", label: "信息流方图", width: 1200, height: 1200, ratio: "1:1" },
] as const;

export type SocialSizePreset = (typeof socialSizePresets)[number];
export type SocialSizePresetId = SocialSizePreset["id"];

export const defaultSocialSizePresetId: SocialSizePresetId = "xiaohongshu-portrait";

export const socialPresetPlatforms = [...new Set(socialSizePresets.map((preset) => preset.platform))];

export function getSocialSizePreset(id: SocialSizePresetId): SocialSizePreset {
  return socialSizePresets.find((preset) => preset.id === id)
    ?? socialSizePresets.find((preset) => preset.id === defaultSocialSizePresetId)!;
}
