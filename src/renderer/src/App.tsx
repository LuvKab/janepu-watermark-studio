import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  LocateFixed,
  Grid3X3,
  Image as ImageIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  ShieldCheck,
  Stamp,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ExportSettings,
  LocalImageRecord,
  LocalWatermarkRecord,
  PlacementSuggestion,
  TemplateKind,
  TemplateSettings,
  WatermarkStrength,
} from "@shared/types";
import { analyzeBitmap, decodeImage, makeThumbnail } from "./lib/image";
import { clampPoint } from "./lib/placement";
import { canvasToBytes, outputDimensions, renderWatermarked } from "./lib/render";
import logoDarkUrl from "./assets/janepu-logo-wordmark.svg?url";

interface WorkspaceImage extends LocalImageRecord {
  width: number;
  height: number;
  thumbnailUrl: string;
  selected: boolean;
  settings: TemplateSettings;
  warning?: string;
}

interface ExportProgress {
  current: number;
  total: number;
  failed: number;
}

interface WatermarkAsset {
  record: LocalWatermarkRecord;
  image: HTMLImageElement;
  url: string;
}

const defaultExport: ExportSettings = {
  resizeMode: "original",
  customWidth: 1600,
  customHeight: 1200,
  fitMode: "contain",
  format: "jpeg",
  jpegQuality: 92,
};

const strengthRecipes: Record<TemplateKind, Record<WatermarkStrength, Pick<TemplateSettings, "fontSize" | "opacity">>> = {
  corner: {
    soft: { fontSize: 110, opacity: 0.55 },
    standard: { fontSize: 145, opacity: 0.8 },
    strong: { fontSize: 182, opacity: 1 },
  },
  center: {
    soft: { fontSize: 270, opacity: 0.08 },
    standard: { fontSize: 360, opacity: 0.14 },
    strong: { fontSize: 450, opacity: 0.22 },
  },
  diagonal: {
    soft: { fontSize: 320, opacity: 0.08 },
    standard: { fontSize: 430, opacity: 0.14 },
    strong: { fontSize: 540, opacity: 0.22 },
  },
  tile: {
    soft: { fontSize: 90, opacity: 0.07 },
    standard: { fontSize: 120, opacity: 0.12 },
    strong: { fontSize: 150, opacity: 0.2 },
  },
};

const templateOptions: Array<{ id: TemplateKind; title: string; description: string }> = [
  { id: "corner", title: "智能角标", description: "自动寻找干净留白" },
  { id: "center", title: "居中品牌", description: "低调覆盖主体区域" },
  { id: "diagonal", title: "斜向保护", description: "单枚放大，更难裁切" },
  { id: "tile", title: "平铺防裁", description: "重复覆盖整张图片" },
];

const strengthLabels: Array<{ id: WatermarkStrength; title: string; description: string }> = [
  { id: "soft", title: "轻柔", description: "保留画面感" },
  { id: "standard", title: "标准", description: "推荐" },
  { id: "strong", title: "强保护", description: "更难裁切" },
];

interface PositionChoice {
  id: string;
  label: string;
  position?: { x: number; y: number };
}

function positionChoices(template: TemplateKind): PositionChoice[] {
  return template === "corner"
    ? [
        { id: "auto", label: "智能" },
        { id: "top-left", label: "左上", position: { x: 0.18, y: 0.12 } },
        { id: "top-right", label: "右上", position: { x: 0.82, y: 0.12 } },
        { id: "bottom-left", label: "左下", position: { x: 0.18, y: 0.84 } },
        { id: "bottom-right", label: "右下", position: { x: 0.82, y: 0.84 } },
      ]
    : [
        { id: "auto", label: "智能" },
        { id: "top", label: "上方", position: { x: 0.5, y: 0.36 } },
        { id: "center", label: "居中", position: { x: 0.5, y: 0.5 } },
        { id: "bottom", label: "下方", position: { x: 0.5, y: 0.64 } },
      ];
}

function withStrength(settings: TemplateSettings, strength: WatermarkStrength): TemplateSettings {
  return { ...settings, ...strengthRecipes[settings.template][strength], strength };
}

function defaultsFor(template: TemplateKind): TemplateSettings {
  return withStrength({
    template,
    position: template === "corner" ? { x: 0.18, y: 0.11 } : { x: 0.5, y: 0.5 },
    fontSize: 0,
    opacity: 0,
    tone: "dark",
    customColor: "#7a7065",
    placementMode: "auto",
    strength: "standard",
    rotation: template === "diagonal" || template === "tile" ? -22 : 0,
    spacing: template === "tile" ? 115 : 80,
  }, "standard");
}

function applySuggestion(settings: TemplateSettings, suggestion: PlacementSuggestion): TemplateSettings {
  const placed = {
    ...settings,
    position: suggestion.position,
    tone: settings.tone === "original" ? "original" : suggestion.tone,
    placementMode: "auto",
  } satisfies TemplateSettings;
  return settings.strength === "custom" ? placed : withStrength(placed, settings.strength);
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function loadLogo(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("品牌 Logo 加载失败。"));
    image.src = url;
  });
}

export function App() {
  const [images, setImages] = useState<WorkspaceImage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadedBitmap, setLoadedBitmap] = useState<{ id: string; bitmap: ImageBitmap } | null>(null);
  const [builtInLogo, setBuiltInLogo] = useState<HTMLImageElement | null>(null);
  const [customWatermark, setCustomWatermark] = useState<WatermarkAsset | null>(null);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(defaultExport);
  const [outputDirectory, setOutputDirectory] = useState<string | null>(null);
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [status, setStatus] = useState("所有处理均在本机完成，不上传图片。");
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const draggingWatermark = useRef(false);
  const thumbnailUrls = useRef<string[]>([]);

  const activeIndex = images.findIndex((item) => item.id === activeId);
  const activeImage = activeIndex >= 0 ? images[activeIndex] : undefined;
  const activeBitmap = loadedBitmap?.id === activeId ? loadedBitmap.bitmap : null;
  const selectedCount = images.filter((item) => item.selected).length;
  const watermarkLogo = customWatermark?.image ?? builtInLogo;
  const watermarkPreviewUrl = customWatermark?.url ?? logoDarkUrl;

  useEffect(() => {
    loadLogo(logoDarkUrl)
      .then(setBuiltInLogo)
      .catch((error) => setStatus(error instanceof Error ? error.message : "品牌资源加载失败。"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let bitmap: ImageBitmap | null = null;
    if (!activeId) return;
    window.janepu
      .readImage(activeId)
      .then(decodeImage)
      .then((value) => {
        bitmap = value;
        if (!cancelled) setLoadedBitmap({ id: activeId, bitmap: value });
      })
      .catch((error) => !cancelled && setStatus(error instanceof Error ? error.message : "图片读取失败。"));
    return () => {
      cancelled = true;
      bitmap?.close();
    };
  }, [activeId]);

  const drawPreview = useCallback(() => {
    if (!canvasRef.current || !activeBitmap || !activeImage || !watermarkLogo) return;
    renderWatermarked(
      canvasRef.current,
      activeBitmap,
      activeImage.settings,
      exportSettings,
      watermarkLogo,
      { width: 1100, height: 760 },
    );
  }, [activeBitmap, activeImage, exportSettings, watermarkLogo]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  useEffect(() => {
    const onResize = () => requestAnimationFrame(drawPreview);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawPreview]);

  useEffect(() => {
    thumbnailUrls.current = images.map((item) => item.thumbnailUrl);
  }, [images]);

  useEffect(() => () => thumbnailUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  useEffect(() => () => {
    if (customWatermark) URL.revokeObjectURL(customWatermark.url);
  }, [customWatermark]);

  const patchImage = useCallback((id: string, patch: Partial<WorkspaceImage>) => {
    setImages((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const patchActiveSettings = useCallback(
    (patch: Partial<TemplateSettings>, manual = true) => {
      if (!activeId) return;
      setImages((current) =>
        current.map((item) =>
          item.id === activeId
            ? { ...item, settings: { ...item.settings, ...patch, placementMode: manual ? "manual" : item.settings.placementMode } }
            : item,
        ),
      );
    },
    [activeId],
  );

  const analyzeRecord = useCallback(async (record: LocalImageRecord, template: TemplateKind, existing?: WorkspaceImage) => {
    const bytes = await window.janepu.readImage(record.id);
    const bitmap = await decodeImage(bytes);
    try {
      const suggestion = await analyzeBitmap(bitmap, template);
      const thumbnailUrl = existing?.thumbnailUrl ?? (await makeThumbnail(bitmap));
      return {
        ...record,
        width: bitmap.width,
        height: bitmap.height,
        thumbnailUrl,
        selected: existing?.selected ?? false,
        settings: applySuggestion({ ...defaultsFor(template), tone: customWatermark ? "original" : "dark" }, suggestion),
      } satisfies WorkspaceImage;
    } finally {
      bitmap.close();
    }
  }, [customWatermark]);

  const importRecords = useCallback(
    async (records: LocalImageRecord[]) => {
      if (!records.length) {
        setStatus("没有找到可用的 JPG、PNG 或 WebP 图片。");
        return;
      }
      setBusy(true);
      let added = 0;
      let failed = 0;
      for (const record of records) {
        try {
          const item = await analyzeRecord(record, "corner");
          setImages((current) => [...current, item]);
          setActiveId((current) => current ?? item.id);
          added += 1;
          setStatus(`正在本地分析图片位置… ${added + failed}/${records.length}`);
        } catch {
          failed += 1;
        }
      }
      setBusy(false);
      setStatus(failed ? `已导入 ${added} 张，${failed} 张无法读取。` : `已导入 ${added} 张，并完成水印位置建议。`);
    },
    [analyzeRecord],
  );

  const chooseImages = useCallback(async () => {
    if (busy) return;
    await importRecords(await window.janepu.selectImages());
  }, [busy, importRecords]);

  const chooseWatermark = useCallback(async () => {
    if (busy) return;
    const record = await window.janepu.selectWatermark();
    if (!record) return;
    setBusy(true);
    try {
      const bytes = await window.janepu.readImage(record.id);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: record.mimeType }));
      const image = await loadLogo(url);
      setCustomWatermark({ record, image, url });
      setImages((current) => current.map((item) => ({ ...item, settings: { ...item.settings, tone: "original" } })));
      setStatus(`已换成“${record.name}”，并应用到全部图片。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Logo 无法读取。");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const restoreBuiltInWatermark = useCallback(() => {
    setCustomWatermark(null);
    setImages((current) => current.map((item) => ({ ...item, settings: { ...item.settings, tone: item.settings.tone === "original" ? "dark" : item.settings.tone } })));
    setStatus("已恢复内置简普 Logo。");
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setDraggingFiles(false);
      const paths = [...event.dataTransfer.files].map((file) => window.janepu.pathForFile(file)).filter(Boolean);
      await importRecords(await window.janepu.registerDroppedFiles(paths));
    },
    [importRecords],
  );

  const reanalyzeItem = useCallback(
    async (item: WorkspaceImage, template = item.settings.template, styleSource?: TemplateSettings) => {
      const bytes = await window.janepu.readImage(item.id);
      const bitmap = await decodeImage(bytes);
      try {
        const suggestion = await analyzeBitmap(bitmap, template);
        const base = styleSource
          ? { ...styleSource, template, position: defaultsFor(template).position, placementMode: "auto" as const }
          : { ...item.settings, template, placementMode: "auto" as const };
        return { ...item, settings: applySuggestion(base, suggestion), warning: undefined };
      } finally {
        bitmap.close();
      }
    },
    [],
  );

  const changeTemplate = useCallback(
    async (template: TemplateKind) => {
      if (!images.length || images.every((item) => item.settings.template === template) || busy) return;
      setBusy(true);
      let failed = 0;
      const currentStrength = activeImage?.settings.strength;
      const batchStrength = currentStrength && currentStrength !== "custom" ? currentStrength : "standard";
      const templateDefaults = {
        ...withStrength(defaultsFor(template), batchStrength),
        tone: customWatermark ? "original" as const : (activeImage?.settings.tone === "original" ? "dark" as const : activeImage?.settings.tone ?? "dark" as const),
      };
      for (let index = 0; index < images.length; index += 1) {
        const item = images[index];
        setStatus(`正在为全部图片应用用途… ${index + 1}/${images.length}`);
        try {
          patchImage(item.id, await reanalyzeItem(item, template, templateDefaults));
        } catch {
          failed += 1;
          patchImage(item.id, { settings: templateDefaults, warning: "自动位置分析失败" });
        }
      }
      setBusy(false);
      setStatus(failed ? `模板已应用，${failed} 张使用默认位置。` : `模板已应用到全部 ${images.length} 张图片。`);
    },
    [activeImage, busy, customWatermark, images, patchImage, reanalyzeItem],
  );

  const changeStrength = useCallback((strength: WatermarkStrength) => {
    setImages((current) => current.map((item) => ({ ...item, settings: withStrength(item.settings, strength) })));
    setStatus(`“${strengthLabels.find((item) => item.id === strength)?.title}”强度已应用到全部图片。`);
  }, []);

  const reanalyzeCurrent = useCallback(async () => {
    if (!activeImage || busy) return;
    setBusy(true);
    setStatus("正在分析画面留白与对比度…");
    try {
      patchImage(activeImage.id, await reanalyzeItem(activeImage));
      setStatus("已根据画面内容建议位置、颜色和透明度。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "自动位置分析失败。");
    } finally {
      setBusy(false);
    }
  }, [activeImage, busy, patchImage, reanalyzeItem]);

  const choosePosition = useCallback(
    async (choice: PositionChoice) => {
      if (!activeImage || busy) return;
      if (!choice.position) {
        await reanalyzeCurrent();
        return;
      }
      patchActiveSettings({ position: choice.position });
      setStatus(`${activeImage.name} 已改为${choice.label}位置，仅调整此图。`);
    },
    [activeImage, busy, patchActiveSettings, reanalyzeCurrent],
  );

  const applyToBatch = useCallback(
    async (scope: "selected" | "all") => {
      if (!activeImage || busy) return;
      const targets = images.filter((item) => scope === "all" || item.selected);
      if (!targets.length) {
        setStatus("请先勾选需要应用模板的图片。");
        return;
      }
      setBusy(true);
      let completed = 0;
      let failed = 0;
      for (const target of targets) {
        try {
          const updated = await reanalyzeItem(target, activeImage.settings.template, activeImage.settings);
          patchImage(target.id, updated);
          completed += 1;
        } catch {
          failed += 1;
          patchImage(target.id, { warning: "自动位置分析失败" });
        }
        setStatus(`正在批量应用并分析… ${completed + failed}/${targets.length}`);
      }
      setBusy(false);
      setStatus(failed ? `已应用 ${completed} 张，${failed} 张需要手动调整。` : `模板已应用到 ${completed} 张图片。`);
    },
    [activeImage, busy, images, patchImage, reanalyzeItem],
  );

  const removeImage = useCallback(
    (id: string) => {
      const index = images.findIndex((item) => item.id === id);
      const removed = images[index];
      if (removed) URL.revokeObjectURL(removed.thumbnailUrl);
      const remaining = images.filter((item) => item.id !== id);
      setImages(remaining);
      if (activeId === id) setActiveId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
      setStatus(remaining.length ? `已从工作区移除 ${removed?.name ?? "图片"}，原文件未修改。` : "所有图片已移出工作区，原文件均未修改。");
    },
    [activeId, images],
  );

  const updatePositionFromPointer = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !activeImage) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const point = clampPoint((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
      patchActiveSettings({ position: point });
    },
    [activeImage, patchActiveSettings],
  );

  const onCanvasKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (!activeImage || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? 0.02 : 0.005;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      patchActiveSettings({ position: clampPoint(activeImage.settings.position.x + dx, activeImage.settings.position.y + dy) });
    },
    [activeImage, patchActiveSettings],
  );

  const chooseDirectory = useCallback(async () => {
    const directory = await window.janepu.chooseOutputDirectory();
    if (directory) {
      setOutputDirectory(directory);
      setStatus("已选择导出目录。");
    }
    return directory;
  }, []);

  const exportImages = useCallback(async () => {
    if (!images.length || busy || !watermarkLogo) return;
    const targets = selectedCount ? images.filter((item) => item.selected) : images;
    const directory = outputDirectory ?? (await chooseDirectory());
    if (!directory) return;

    setBusy(true);
    setExportProgress({ current: 0, total: targets.length, failed: 0 });
    let failed = 0;
    let latestPath: string | null = null;
    const canvas = document.createElement("canvas");

    for (let index = 0; index < targets.length; index += 1) {
      const item = targets[index];
      try {
        const bitmap = await decodeImage(await window.janepu.readImage(item.id));
        try {
          renderWatermarked(canvas, bitmap, item.settings, exportSettings, watermarkLogo);
          const bytes = await canvasToBytes(canvas, exportSettings.format, exportSettings.jpegQuality);
          latestPath = (await window.janepu.saveExport({ directory, sourceName: item.name, format: exportSettings.format, bytes })).path;
        } finally {
          bitmap.close();
        }
      } catch {
        failed += 1;
      }
      setExportProgress({ current: index + 1, total: targets.length, failed });
      setStatus(`正在导出… ${index + 1}/${targets.length}`);
    }

    setBusy(false);
    setLastExportPath(latestPath);
    setStatus(failed ? `导出完成：成功 ${targets.length - failed} 张，失败 ${failed} 张。` : `已导出 ${targets.length} 张图片，原图未修改。`);
  }, [busy, chooseDirectory, exportSettings, images, outputDirectory, selectedCount, watermarkLogo]);

  const dimensions = useMemo(
    () => (activeImage ? outputDimensions(activeImage.width, activeImage.height, exportSettings) : null),
    [activeImage, exportSettings],
  );

  return (
    <main
      className={`app-shell ${leftOpen ? "has-left" : ""} ${rightOpen ? "has-right" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDraggingFiles(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDraggingFiles(false);
      }}
      onDrop={onDrop}
    >
      <header className="topbar">
        <div className="brand-lockup">
          <img src={logoDarkUrl} alt="简普 JANEPU" />
          <span>水印工作室</span>
        </div>
        <div className="topbar-meta">
          <span className="privacy-dot" aria-hidden="true" />
          完全本地 · 不上传图片
        </div>
        <div className="topbar-actions">
          <button className="icon-button compact-only" aria-label={leftOpen ? "收起图片列表" : "展开图片列表"} onClick={() => setLeftOpen((value) => !value)}>
            {leftOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </button>
          <button className="secondary-button" onClick={chooseImages} disabled={busy}>
            <ImagePlus /> 添加图片
          </button>
          <button className="primary-button" onClick={exportImages} disabled={!images.length || busy || !watermarkLogo}>
            {exportProgress && busy ? <LoaderCircle className="spin" /> : <Download />}
            {selectedCount ? `导出已选 ${selectedCount} 张` : `导出全部${images.length ? ` ${images.length} 张` : ""}`}
          </button>
          <button className="icon-button compact-only" aria-label={rightOpen ? "收起设置面板" : "展开设置面板"} onClick={() => setRightOpen((value) => !value)}>
            {rightOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </button>
        </div>
      </header>

      <aside className="asset-panel" aria-label="图片列表">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">BATCH</span>
            <h2>图片列表</h2>
          </div>
          <span className="count-badge">{images.length}</span>
        </div>
        {images.length ? (
          <div className="asset-list">
            {images.map((item, index) => (
              <article key={item.id} className={`asset-card ${item.id === activeId ? "active" : ""}`} onClick={() => setActiveId(item.id)}>
                <label className="asset-check" onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" checked={item.selected} onChange={(event) => patchImage(item.id, { selected: event.target.checked })} />
                  <span aria-hidden="true"><Check /></span>
                  <span className="sr-only">选择 {item.name}</span>
                </label>
                <img src={item.thumbnailUrl} alt="" />
                <div className="asset-copy">
                  <strong>{String(index + 1).padStart(2, "0")} · {item.name}</strong>
                  <span>{item.width} × {item.height} · {formatBytes(item.sizeBytes)}</span>
                  <span className={item.warning ? "warning" : "auto-label"}>{item.warning ?? (item.settings.placementMode === "auto" ? "已自动建议位置" : "手动位置")}</span>
                </div>
                <button className="remove-button" aria-label={`移除 ${item.name}`} onClick={(event) => { event.stopPropagation(); removeImage(item.id); }}>
                  <X />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <button className="asset-empty" onClick={chooseImages}>
            <Upload />
            <strong>拖入家具图片</strong>
            <span>JPG · PNG · WebP</span>
          </button>
        )}
      </aside>

      <section className="stage" aria-label="水印预览">
        <div className="stage-toolbar">
          <div>
            <span>{activeImage ? activeImage.name : "尚未选择图片"}</span>
            {dimensions && <small>{dimensions.width} × {dimensions.height} 输出预览</small>}
          </div>
          {activeImage && (
            <div className="pager">
              <button aria-label="上一张" disabled={activeIndex <= 0} onClick={() => setActiveId(images[activeIndex - 1]?.id ?? activeId)}><ChevronLeft /></button>
              <span>{activeIndex + 1} / {images.length}</span>
              <button aria-label="下一张" disabled={activeIndex >= images.length - 1} onClick={() => setActiveId(images[activeIndex + 1]?.id ?? activeId)}><ChevronRight /></button>
            </div>
          )}
        </div>
        <div className="canvas-wrap" ref={canvasWrapRef}>
          {activeImage && activeBitmap && watermarkLogo ? (
            <canvas
              ref={canvasRef}
              className={`preview-canvas ${advancedOpen && activeImage.settings.template !== "tile" ? "editable" : ""}`}
              tabIndex={advancedOpen && activeImage.settings.template !== "tile" ? 0 : -1}
              aria-label={advancedOpen && activeImage.settings.template !== "tile" ? "水印预览画布。可拖动水印，或使用方向键微调位置。" : "水印预览画布。"}
              onKeyDown={(event) => advancedOpen && activeImage.settings.template !== "tile" && onCanvasKeyDown(event)}
              onPointerDown={(event) => {
                if (!advancedOpen || activeImage.settings.template === "tile") return;
                draggingWatermark.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                updatePositionFromPointer(event);
              }}
              onPointerMove={(event) => advancedOpen && activeImage.settings.template !== "tile" && draggingWatermark.current && updatePositionFromPointer(event)}
              onPointerUp={(event) => {
                draggingWatermark.current = false;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => { draggingWatermark.current = false; }}
            />
          ) : (
            <div className="stage-empty">
              <div className="empty-mark">J</div>
              <p>把图片放进来，水印会自动找到合适的位置。</p>
              <button className="secondary-button" onClick={chooseImages} disabled={busy}><FolderOpen /> 选择图片</button>
            </div>
          )}
          {draggingFiles && (
            <div className="drop-overlay">
              <Upload />
              <strong>松开即可导入</strong>
              <span>图片只会在本机读取</span>
            </div>
          )}
        </div>
        <footer className="statusbar">
          <span className={busy ? "working-dot" : "ready-dot"} aria-hidden="true" />
          <span role="status" aria-live="polite">{status}</span>
          {lastExportPath && (
            <button onClick={() => window.janepu.showItemInFolder(lastExportPath!)}><ExternalLink /> 显示导出文件</button>
          )}
        </footer>
      </section>

      <aside className="settings-panel" aria-label="水印设置">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">EDITOR</span>
            <h2>水印设置</h2>
          </div>
          {activeImage && <span className={`mode-badge ${activeImage.settings.placementMode}`}>{activeImage.settings.placementMode === "auto" ? "自动" : "手动"}</span>}
        </div>
        {activeImage ? (
          <div className="settings-scroll">
            <fieldset className="workflow-step">
              <legend><span>01</span> 选择水印</legend>
              <div className="watermark-picker">
                <span className="watermark-swatch"><img src={watermarkPreviewUrl} alt="当前水印" /></span>
                <div>
                  <strong>{customWatermark?.record.name ?? "简普 JANEPU"}</strong>
                  <small>{customWatermark ? "自定义 Logo · 原色显示" : "内置示例 Logo"}</small>
                </div>
                <button className="secondary-button" onClick={chooseWatermark} disabled={busy}><ImageIcon /> 更换</button>
              </div>
              <div className="watermark-actions">
                <span>SVG、PNG、JPG、WebP · 最大 20 MB</span>
                {customWatermark && <button onClick={restoreBuiltInWatermark}>恢复内置</button>}
              </div>
            </fieldset>

            <fieldset className="workflow-step">
              <legend><span>02</span> 选择模板</legend>
              <div className="template-grid">
                {templateOptions.map((template) => (
                  <button key={template.id} className={activeImage.settings.template === template.id ? "selected" : ""} onClick={() => changeTemplate(template.id)} disabled={busy}>
                    <span className={`template-preview ${template.id}-preview`}>
                      <img src={watermarkPreviewUrl} alt="" />
                      {template.id === "corner" && <Sparkles aria-hidden="true" />}
                      {template.id === "center" && <Stamp aria-hidden="true" />}
                      {template.id === "diagonal" && <ShieldCheck aria-hidden="true" />}
                      {template.id === "tile" && <Grid3X3 aria-hidden="true" />}
                    </span>
                    <strong>{template.title}</strong><small>{template.description}</small>
                  </button>
                ))}
              </div>
              <p className="helper">模板会应用到全部图片；角标和单枚模板仍会逐张判断明暗与位置。</p>
            </fieldset>

            <fieldset className="workflow-step">
              <legend><span>03</span> 选择强度</legend>
              <div className="strength-grid" role="group" aria-label="水印强度">
                {strengthLabels.map((strength) => (
                  <button
                    key={strength.id}
                    className={activeImage.settings.strength === strength.id ? "selected" : ""}
                    onClick={() => changeStrength(strength.id)}
                    disabled={busy}
                  >
                    <strong>{strength.title}</strong>
                    <small>{strength.description}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="workflow-step">
              <legend><span>04</span> 确认位置</legend>
              {activeImage.settings.template === "tile" ? (
                <div className="tile-note"><Grid3X3 /><span><strong>整图自动平铺</strong><small>无需逐张选位，可在高级调整中改变旋转和间距。</small></span></div>
              ) : (
                <>
                  <div className="placement-grid" role="group" aria-label="当前图片水印位置">
                    {positionChoices(activeImage.settings.template).map((choice) => {
                      const point = choice.position ?? activeImage.settings.position;
                      const selected = choice.id === "auto"
                        ? activeImage.settings.placementMode === "auto"
                        : activeImage.settings.placementMode === "manual"
                          && Math.abs(activeImage.settings.position.x - point.x) < 0.01
                          && Math.abs(activeImage.settings.position.y - point.y) < 0.01;
                      return (
                        <button key={choice.id} className={selected ? "selected" : ""} onClick={() => choosePosition(choice)} disabled={busy} aria-pressed={selected}>
                          <span className="placement-preview" style={{ backgroundImage: `url(${activeImage.thumbnailUrl})` }}>
                            <i className={`${activeImage.settings.template} ${activeImage.settings.tone}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />
                            {choice.id === "auto" && <LocateFixed aria-hidden="true" />}
                          </span>
                          <strong>{choice.label}</strong>
                        </button>
                      );
                    })}
                  </div>
                  <div className="recommendation-line">
                    <span className={activeImage.settings.placementMode === "auto" ? "ready-dot" : "manual-dot"} aria-hidden="true" />
                    <span>{activeImage.settings.placementMode === "auto" ? "已分析留白、边缘与明暗" : "此图使用单独位置"}</span>
                    <button onClick={reanalyzeCurrent} disabled={busy}><RotateCcw /> 恢复智能</button>
                  </div>
                </>
              )}
            </fieldset>

            <details className="advanced-panel" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
              <summary><span><SlidersHorizontal /> 高级调整</span><small>仅影响当前图片</small><ChevronDown className="details-chevron" /></summary>
              <div className="advanced-content">
                <p className="advanced-hint">{activeImage.settings.template === "tile" ? "平铺模板可调整尺寸、旋转和间距。" : "可以在画布上拖动水印，方向键用于微调。"}</p>
                <label className="control-row">
                  <span>尺寸 <output>{activeImage.settings.fontSize}</output></span>
                  <input type="range" min="60" max="600" value={activeImage.settings.fontSize} onChange={(event) => patchActiveSettings({ fontSize: Number(event.target.value), strength: "custom" })} />
                </label>
                <label className="control-row">
                  <span>透明度 <output>{Math.round(activeImage.settings.opacity * 100)}%</output></span>
                  <input type="range" min="5" max="100" value={Math.round(activeImage.settings.opacity * 100)} onChange={(event) => patchActiveSettings({ opacity: Number(event.target.value) / 100, strength: "custom" })} />
                </label>
                <div className="tone-control" role="group" aria-label="水印颜色">
                  <button className={activeImage.settings.tone === "original" ? "selected" : ""} onClick={() => patchActiveSettings({ tone: "original" })}><span className="tone-dot original" />原色</button>
                  <button className={activeImage.settings.tone === "dark" ? "selected" : ""} onClick={() => patchActiveSettings({ tone: "dark" })}><span className="tone-dot dark" />深色</button>
                  <button className={activeImage.settings.tone === "light" ? "selected" : ""} onClick={() => patchActiveSettings({ tone: "light" })}><span className="tone-dot light" />浅色</button>
                  <label className={activeImage.settings.tone === "custom" ? "selected" : ""}>
                    <input type="color" value={activeImage.settings.customColor} onChange={(event) => patchActiveSettings({ tone: "custom", customColor: event.target.value })} />
                    自定义
                  </label>
                </div>
                {(activeImage.settings.template === "diagonal" || activeImage.settings.template === "tile") && (
                  <label className="control-row">
                    <span>旋转 <output>{activeImage.settings.rotation}°</output></span>
                    <input type="range" min="-45" max="45" value={activeImage.settings.rotation} onChange={(event) => patchActiveSettings({ rotation: Number(event.target.value), strength: "custom" })} />
                  </label>
                )}
                {activeImage.settings.template === "tile" && (
                  <label className="control-row">
                    <span>间距 <output>{activeImage.settings.spacing}</output></span>
                    <input type="range" min="30" max="260" value={activeImage.settings.spacing} onChange={(event) => patchActiveSettings({ spacing: Number(event.target.value), strength: "custom" })} />
                  </label>
                )}
                {activeImage.settings.template !== "tile" && (
                  <div className="coordinate-grid">
                    <label>X <input type="number" min="4" max="96" value={Math.round(activeImage.settings.position.x * 100)} onChange={(event) => patchActiveSettings({ position: clampPoint(Number(event.target.value) / 100, activeImage.settings.position.y) })} /></label>
                    <label>Y <input type="number" min="4" max="96" value={Math.round(activeImage.settings.position.y * 100)} onChange={(event) => patchActiveSettings({ position: clampPoint(activeImage.settings.position.x, Number(event.target.value) / 100) })} /></label>
                  </div>
                )}
                <button className="apply-all-button" onClick={() => applyToBatch("all")} disabled={busy}>将当前样式应用到全部图片</button>
              </div>
            </details>

            <div className="export-card">
              <div>
                <span className="eyebrow">READY TO EXPORT</span>
                <strong>{selectedCount ? `${selectedCount} 张已选图片` : `全部 ${images.length} 张图片`}</strong>
                <small>{exportSettings.format === "jpeg" ? "JPG" : "PNG"} · {dimensions ? `${dimensions.width} × ${dimensions.height}` : "保持原尺寸"}</small>
              </div>
              <button className="primary-button export-main" onClick={exportImages} disabled={busy || !watermarkLogo}>
                {exportProgress && busy ? <LoaderCircle className="spin" /> : <Download />}
                开始导出
              </button>
            </div>

            <details className="export-options">
              <summary><span>导出设置</span><small>格式、尺寸与目录</small><ChevronDown className="details-chevron" /></summary>
              <div className="export-options-content">
                <div className="segmented size-presets">
                  <button className={exportSettings.resizeMode === "original" ? "selected" : ""} onClick={() => setExportSettings((value) => ({ ...value, resizeMode: "original" }))}>原图尺寸</button>
                  <button className={exportSettings.resizeMode === "fixed" ? "selected" : ""} onClick={() => setExportSettings((value) => ({ ...value, resizeMode: "fixed" }))}>1600 × 1200</button>
                  <button className={exportSettings.resizeMode === "custom" ? "selected" : ""} onClick={() => setExportSettings((value) => ({ ...value, resizeMode: "custom" }))}>自定义</button>
                </div>
                {exportSettings.resizeMode === "custom" && (
                  <div className="custom-size-grid">
                    <label>宽度 <input aria-label="自定义宽度" type="number" min="1" max="32767" value={exportSettings.customWidth} onChange={(event) => setExportSettings((value) => ({ ...value, customWidth: Number(event.target.value) }))} /></label>
                    <span aria-hidden="true">×</span>
                    <label>高度 <input aria-label="自定义高度" type="number" min="1" max="32767" value={exportSettings.customHeight} onChange={(event) => setExportSettings((value) => ({ ...value, customHeight: Number(event.target.value) }))} /></label>
                    <small>支持 1–32767 px，导出时自动取整。</small>
                  </div>
                )}
                {exportSettings.resizeMode !== "original" && (
                  <div className="segmented subdued">
                    <button className={exportSettings.fitMode === "contain" ? "selected" : ""} onClick={() => setExportSettings((value) => ({ ...value, fitMode: "contain" }))}>完整显示</button>
                    <button className={exportSettings.fitMode === "cover" ? "selected" : ""} onClick={() => setExportSettings((value) => ({ ...value, fitMode: "cover" }))}>填充裁切</button>
                  </div>
                )}
                <div className="format-row">
                  <label><input type="radio" name="format" checked={exportSettings.format === "jpeg"} onChange={() => setExportSettings((value) => ({ ...value, format: "jpeg" }))} /> JPG</label>
                  <label><input type="radio" name="format" checked={exportSettings.format === "png"} onChange={() => setExportSettings((value) => ({ ...value, format: "png" }))} /> PNG</label>
                </div>
                {exportSettings.format === "jpeg" && (
                  <label className="control-row compact">
                    <span>JPG 质量 <output>{exportSettings.jpegQuality}</output></span>
                    <input type="range" min="60" max="100" value={exportSettings.jpegQuality} onChange={(event) => setExportSettings((value) => ({ ...value, jpegQuality: Number(event.target.value) }))} />
                  </label>
                )}
                <button className="directory-button" onClick={chooseDirectory}><FolderOpen /><span>{outputDirectory ?? "首次导出时选择目录"}</span></button>
              </div>
            </details>

            <button className="danger-link" onClick={() => removeImage(activeImage.id)}><Trash2 /> 从工作区移除当前图片</button>
          </div>
        ) : (
          <div className="settings-empty">选择图片后即可调整模板。</div>
        )}
      </aside>
    </main>
  );
}
