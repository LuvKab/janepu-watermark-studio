# 简普水印工作室

一个开源、跨平台、完全离线的批量图片水印工具。图片只在当前电脑中读取和导出，不使用 AI、不上传文件、不包含统计、广告或远程字体。

## 功能

- 拖入或选择多张 JPG、PNG、WebP，批量预览与导出。
- 可随时换成自己的 SVG、PNG、JPG 或 WebP Logo，保持原色或统一着色；内置简普 Logo 仅作为开箱示例。
- 内置四种纯水印模板：智能角标、居中品牌、斜向保护和平铺防裁。
- 使用传统图像统计分析画面亮度、边缘和局部复杂度，自动建议水印位置与深浅色。
- 轻柔、标准、强保护三档强度，避免逐项配置尺寸与透明度。
- 默认使用智能位置，也可通过图片候选缩略图快速切换；自由拖动和精确参数收在“高级调整”中。
- 斜向和平铺模板可调整旋转角度，平铺模板还可调整 Logo 间距。
- 默认保持每张原图尺寸；也可选择小红书、TikTok、Instagram、Facebook、YouTube、Pinterest、LinkedIn、X / Twitter 的 19 个常用发布尺寸，或自由输入 1–32767 px 的输出宽高。
- 导出文件使用 `_janepu` 后缀；遇到重名会自动添加 `-2`、`-3`，不会覆盖原图或已有导出。

## 本地开发

需要 Node.js 24 和 npm 11。

```bash
git clone https://github.com/LuvKab/janepu-watermark-studio.git
cd janepu-watermark-studio
npm install
npm run dev
```

如果从简普官网 monorepo 开发，则先进入 `tools/janepu-watermark-studio/`。

运行完整质量检查：

```bash
npm run check
npm run test:e2e
```

## 打包

```bash
npm run dist:linux
npm run dist:deb
npm run dist:win
npm run dist:win:zip
npm run dist:mac
```

安装包输出到 `tools/janepu-watermark-studio/release/`。

- Linux：`dist:linux` 生成 AppImage；`dist:deb` 生成 DEB（部分发行版需先安装 `libxcrypt-compat`）。
- Windows：`dist:win` 生成 NSIS 安装程序，在 Linux 上需要 Wine；`dist:win:zip` 可生成免安装 ZIP。
- macOS：DMG。正式发布需要在 macOS 主机配置 Apple Developer 签名和公证。

## 使用方法

1. 把图片拖入窗口，或点击“添加图片”。
2. 工具会在本地分析每张图片，并自动建议水印位置、深浅色和透明度。
3. 在“选择水印”中使用内置示例，或换成自己的 Logo；透明 PNG 的效果最佳。
4. 选择智能角标、居中品牌、斜向保护或平铺防裁，再选择轻柔、标准或强保护。
5. 单枚模板可保持“智能”，也可以从候选缩略图中为当前图片指定位置。
6. 需要精确调整时展开“高级调整”，拖动水印或调整尺寸、透明度、颜色、旋转及间距。
7. 点击“开始导出”。默认不改变图片尺寸；需要固定尺寸时，在折叠的“导出设置”中选择社媒预设或输入自定义宽高。非原图比例可选完整显示或填充裁切；未勾选任何图片时导出全部。

### 内置社媒尺寸

| 平台 | 内置场景 |
| --- | --- |
| 小红书 | 图文竖版 1242×1656、方图 1080×1080、横版 1656×1242 |
| TikTok | 视频 / 封面 1080×1920 |
| Instagram | 图文竖版 1080×1350、方图 1080×1080、Story / Reel 1080×1920 |
| Facebook | 信息流竖版 1080×1350、方图 1080×1080、横版 1200×630、Story / Reel 1080×1920 |
| YouTube | 视频缩略图 3840×2160、Shorts 缩略图 2160×3840 |
| Pinterest | 标准 Pin 1000×1500 |
| LinkedIn | 信息流横版 1200×628、方图 1200×1200、竖版 720×900 |
| X / Twitter | 信息流横版 1200×675、方图 1200×1200 |

这些尺寸是便于直接使用的发布预设，不代表平台拒绝其他尺寸。平台规则会调整，比例与尺寸依据各平台公开指南和当前常见创作规范整理；小红书采用严格 3:4 的 1242×1656，避免 1242×1660 的近似比例误差。

主要参考：[Meta Reels 9:16 指南](https://www.facebook.com/business/ads/facebook-instagram-reels-ads)、[TikTok 1080×1920 指南](https://ads.tiktok.com/business/en-AU/guides/video-advertising-guide)、[YouTube 缩略图指南](https://support.google.com/youtube/answer/72431)、[Pinterest 1000×1500 指南](https://business.pinterest.com/creative-best-practices/)、[LinkedIn 单图规格](https://www.linkedin.com/help/linkedin/answer/a427596/)。

“自动建议”只分析视觉复杂度，并不识别家具类别或分割主体。Canvas 只进行尺寸变换、原图绘制和水印叠加，不使用滤镜或生成式处理。

## 隐私与安全

- Electron 渲染进程不具备 Node.js 权限，启用上下文隔离和沙箱。
- 主进程只接受已登记图片和用户明确选择的输出目录。
- 自定义 SVG 会拒绝脚本、事件处理器、外部资源和 `foreignObject`，防止 Logo 文件越过渲染边界。
- 正式安装包会拦截 HTTP/HTTPS 请求，页面 CSP 禁止网络连接。
- Inter 与 Cormorant Garamond 通过 Fontsource 随包提供，采用 SIL Open Font License；许可证随安装资源分发。

## 开源与贡献

源码采用 [MIT License](LICENSE)。欢迎提交 issue 和 pull request，开发约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。软件许可证不授予对 JANEPU 名称与 Logo 的商标使用权，详见 [TRADEMARKS.md](TRADEMARKS.md)。

产品交互参考了开源水印工具常见的“水印文件 + 版式预设 + 强度 + 高级微调”模型；本项目代码为独立实现，没有复制第三方 GPL 源码。
