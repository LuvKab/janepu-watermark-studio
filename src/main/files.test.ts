import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { approveOutputDirectory, registerWatermarkPath, saveExportFile } from "./files";

const created: string[] = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("safe exports", () => {
  it("registers a validated raster watermark", async () => {
    const directory = await mkdtemp(join(tmpdir(), "janepu-watermark-test-"));
    created.push(directory);
    const path = join(directory, "logo.png");
    await writeFile(path, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
    const record = await registerWatermarkPath(path);
    expect(record).toMatchObject({ name: "logo.png", mimeType: "image/png" });
  });

  it("rejects a watermark whose content does not match an image signature", async () => {
    const directory = await mkdtemp(join(tmpdir(), "janepu-watermark-test-"));
    created.push(directory);
    const path = join(directory, "fake.png");
    await writeFile(path, "not an image");
    expect(await registerWatermarkPath(path)).toBeNull();
  });

  it("accepts local-only SVG logos and rejects executable SVG content", async () => {
    const directory = await mkdtemp(join(tmpdir(), "janepu-watermark-test-"));
    created.push(directory);
    const safePath = join(directory, "safe.svg");
    const unsafePath = join(directory, "unsafe.svg");
    await writeFile(safePath, '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#111" d="M0 0h10v10z"/></svg>');
    await writeFile(unsafePath, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(await registerWatermarkPath(safePath)).toMatchObject({ mimeType: "image/svg+xml" });
    expect(await registerWatermarkPath(unsafePath)).toBeNull();
  });

  it("uses a suffix and never overwrites an existing export", async () => {
    const directory = await mkdtemp(join(tmpdir(), "janepu-export-test-"));
    created.push(directory);
    approveOutputDirectory(directory);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const first = await saveExportFile({ directory, sourceName: "沙发.jpg", format: "jpeg", bytes });
    const second = await saveExportFile({ directory, sourceName: "沙发.jpg", format: "jpeg", bytes });
    expect(first.fileName).toBe("沙发_janepu.jpg");
    expect(second.fileName).toBe("沙发_janepu-2.jpg");
    expect(new Uint8Array(await readFile(first.path))).toEqual(bytes);
  });

  it("rejects bytes that do not match the selected format", async () => {
    const directory = await mkdtemp(join(tmpdir(), "janepu-export-test-"));
    created.push(directory);
    approveOutputDirectory(directory);
    await expect(saveExportFile({ directory, sourceName: "x.jpg", format: "png", bytes: new Uint8Array([0xff, 0xd8, 0xff]) })).rejects.toThrow("格式与扩展名不一致");
  });
});
