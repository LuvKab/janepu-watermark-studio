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
- 默认输出 1600×1200，也可保持原尺寸；支持完整显示、填充裁切、JPG 质量和 PNG。
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
7. 点击“开始导出”。尺寸、格式和目录等低频选项位于折叠的“导出设置”中；未勾选任何图片时导出全部。

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
