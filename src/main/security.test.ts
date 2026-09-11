import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Electron security boundary", () => {
  it("keeps the renderer sandboxed and blocks packaged network traffic", async () => {
    const source = await readFile(new URL("./index.ts", import.meta.url), "utf8");
    expect(source).toContain("contextIsolation: true");
    expect(source).toContain("nodeIntegration: false");
    expect(source).toContain("sandbox: true");
    expect(source).toContain("webSecurity: true");
    expect(source).toContain("if (app.isPackaged)");
    expect(source).toContain('urls: ["http://*/*", "https://*/*"]');
  });

  it("uses a production-safe content security policy", async () => {
    const html = await readFile(new URL("../renderer/index.html", import.meta.url), "utf8");
    expect(html).toContain("connect-src 'none'");
    expect(html).not.toContain("unsafe-eval");
  });
});
