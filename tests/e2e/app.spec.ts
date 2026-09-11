import { _electron as electron, expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const defaultReferenceDirectory = "/home/xyras/桌面/简普小红书_首篇发布包_2026-09-10/03_统一尺寸_1600x1200_直接上传";
const referenceDirectory = process.env.JANEPU_VISUAL_FIXTURES ?? defaultReferenceDirectory;
const referenceNames = ["01_客厅效果图.jpg", "02_沙发原型.jpg", "03_茶几原型.jpg", "04_单人椅原型.jpg"];
const fallbackJpeg = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUEBAQEAwUEBAQGBQUGCA0ICAcHCBALDAkNExAUExIQEhIUFx0ZFBYcFhISGiMaHB4fISEhFBkkJyQgJh0gISD/2wBDAQUGBggHCA8ICA8gFRIVICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICD/wAARCADwAUADASIAAhEBAxEB/8QAHAABAQADAQEBAQAAAAAAAAAAAAMEBQcGAQII/8QAPRABAQAAAwUFBAcHAgcAAAAAABIBAgQDBQYW0REVU1WRE5Oj0gc2UnSys8ExcnOBgoOxQXEUISIkUWHw/8QAGQEBAAMBAQAAAAAAAAAAAAAAAAIDBAEF/8QAIREBAAIBBQEBAQEBAAAAAAAAAAECUQMRExQyMQQSIXH/2gAMAwEAAhEDEQA/AP6GopGinkvSWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigWopGigQopCihxeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBeikKKBCikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBaikaKBCikKKdF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooF6KQooEKKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooFqKRooGPRSNFAtRSNFAtRSNFAtRSNFAtRSNMnYaLXarZ47TS6Lb7fJhjOObZ7PHNhhj/wCO3DAH4opkd0738r1nuM3Q7p3v5XrPcZujuxux6KZHdO9/K9Z7jN0O6d7+V6z3GbobG7Ho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";

function jpegDimensions(bytes: Buffer) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  throw new Error("JPEG dimensions not found");
}

test("imports images, swaps the logo, applies templates, and exports without overwriting", async () => {
  let generatedReferenceDirectory: string | null = null;
  let references = referenceNames.map((name) => join(referenceDirectory, name));
  if (!references.every(existsSync)) {
    generatedReferenceDirectory = await mkdtemp(join(tmpdir(), "janepu-fixtures-"));
    references = referenceNames.map((name) => join(generatedReferenceDirectory!, name));
    await Promise.all(references.map((path) => writeFile(path, Buffer.from(fallbackJpeg, "base64"))));
  }
  const outputDirectory = await mkdtemp(join(tmpdir(), "janepu-e2e-"));
  const watermarkPath = join(outputDirectory, "custom-logo.png");
  await writeFile(watermarkPath, Buffer.from("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", "base64"));
  const electronApp = await electron.launch({
    args: ["out/main/index.js", "--disable-gpu"],
    env: { ...process.env, NODE_ENV: "test" },
  });

  try {
    await electronApp.evaluate(({ dialog }, payload) => {
      dialog.showOpenDialog = async (_browserWindowOrOptions: unknown, possibleOptions?: unknown) => {
        const options = (possibleOptions ?? _browserWindowOrOptions) as { properties?: string[]; filters?: Array<{ name?: string }> };
        if (options.properties?.includes("openDirectory")) return { canceled: false, filePaths: [payload.outputDirectory] };
        if (options.filters?.some((filter) => filter.name === "Logo 图片")) return { canceled: false, filePaths: [payload.watermarkPath] };
        return { canceled: false, filePaths: payload.references };
      };
    }, { references, outputDirectory, watermarkPath });

    const window = await electronApp.firstWindow();
    window.on("console", (message) => process.stdout.write(`[renderer:${message.type()}] ${message.text()}\n`));
    window.on("pageerror", (error) => process.stdout.write(`[renderer:error] ${error.message}\n`));
    await expect(window.getByText("水印工作室")).toBeVisible();
    expect(await window.evaluate(() => Object.keys(window.janepu))).toContain("selectImages");
    await window.getByRole("button", { name: "添加图片" }).click({ force: true });
    await expect(window.getByText("01 · 01_客厅效果图.jpg")).toBeVisible({ timeout: 30_000 });
    await expect(window.getByText("04 · 04_单人椅原型.jpg")).toBeVisible();
    await expect(window.getByText("已自动建议位置").first()).toBeVisible();

    await window.getByRole("button", { name: /更换/ }).click();
    await expect(window.getByText("custom-logo.png", { exact: true })).toBeVisible();
    await expect(window.getByText("自定义 Logo · 原色显示")).toBeVisible();

    await window.getByRole("button", { name: /强保护/ }).click();
    await window.getByText("02 · 02_沙发原型.jpg").click();
    await expect(window.getByRole("button", { name: /强保护/ })).toHaveClass(/selected/);
    await window.getByRole("button", { name: /标准/ }).click();
    await window.getByText("01 · 01_客厅效果图.jpg").click();
    await window.getByRole("button", { name: /斜向保护/ }).click({ force: true });
    await expect(window.getByText("模板已应用到全部 4 张图片。")).toBeVisible({ timeout: 30_000 });
    await expect(window.getByRole("button", { name: /标准/ })).toHaveClass(/selected/);
    await expect(window.getByRole("button", { name: "智能", exact: true })).toBeVisible();
    await window.getByRole("button", { name: /平铺防裁/ }).click();
    await expect(window.getByText("整图自动平铺")).toBeVisible({ timeout: 30_000 });
    await window.getByRole("button", { name: /斜向保护/ }).click();
    await expect(window.getByText("模板已应用到全部 4 张图片。")).toBeVisible({ timeout: 30_000 });
    await expect(window.getByRole("button", { name: "智能", exact: true })).toBeVisible({ timeout: 30_000 });
    await window.locator(".settings-scroll").evaluate((element) => { element.scrollTop = 0; });
    await mkdir("test-results", { recursive: true });
    await window.screenshot({ path: "test-results/janepu-watermark-ui.png" });
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(960, 680));
    await expect(window.getByRole("button", { name: "收起图片列表" })).toBeVisible();
    expect(await window.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1366, 820));
    const previewCanvas = window.locator("canvas.preview-canvas");
    await expect(previewCanvas).toBeVisible();
    await window.getByText("高级调整", { exact: true }).click();
    await previewCanvas.focus();
    await previewCanvas.press("ArrowRight");
    await expect(window.getByText("手动", { exact: true }).first()).toBeVisible();
    const previewData = await previewCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL("image/png"));
    const screenshotBytes = Buffer.from(previewData.split(",")[1], "base64");
    await mkdir("test-results", { recursive: true });
    await writeFile("test-results/janepu-watermark-preview.png", screenshotBytes);

    await window.getByText("导出设置", { exact: true }).click();
    await window.getByRole("button", { name: "社媒预设", exact: true }).click();
    await window.getByLabel("社媒尺寸预设").selectOption("pinterest-pin");
    await expect(window.getByText("1000 × 1500 输出预览")).toBeVisible();
    await window.locator(".settings-scroll").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await window.screenshot({ path: "test-results/janepu-watermark-social-presets.png" });
    await window.getByRole("button", { name: "自定义", exact: true }).click();
    await window.getByLabel("自定义宽度").fill("1080");
    await window.getByLabel("自定义高度").fill("1350");
    await expect(window.getByText("1080 × 1350 输出预览")).toBeVisible();
    await window.getByRole("button", { name: "首次导出时选择目录" }).click({ force: true });
    const exportButton = window.getByRole("button", { name: "导出全部 4 张" });
    await exportButton.click({ force: true });
    await expect(exportButton).toBeDisabled();
    await expect(window.getByText("已导出 4 张图片，原图未修改。")).toBeVisible({ timeout: 40_000 });
    await expect(exportButton).toBeEnabled();
    const firstOutputs = (await readdir(outputDirectory)).filter((name) => name.endsWith(".jpg"));
    expect(firstOutputs).toHaveLength(4);
    expect(jpegDimensions(await readFile(join(outputDirectory, firstOutputs[0])))).toEqual({ width: 1080, height: 1350 });

    await exportButton.click({ force: true });
    await expect(exportButton).toBeDisabled();
    await expect(exportButton).toBeEnabled({ timeout: 40_000 });
    const outputs = (await readdir(outputDirectory)).filter((name) => name.endsWith(".jpg"));
    expect(outputs).toHaveLength(8);
    expect(outputs.some((name) => name.includes("_janepu-2.jpg"))).toBe(true);
  } finally {
    await electronApp.close();
    await rm(outputDirectory, { recursive: true, force: true });
    if (generatedReferenceDirectory) await rm(generatedReferenceDirectory, { recursive: true, force: true });
  }
});
