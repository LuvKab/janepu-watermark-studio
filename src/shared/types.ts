export type TemplateKind = "corner" | "center" | "diagonal" | "tile";
export type OutputFormat = "jpeg" | "png";
export type ResizeMode = "fixed" | "original";
export type FitMode = "contain" | "cover";
export type WatermarkTone = "original" | "dark" | "light" | "custom";
export type PlacementMode = "auto" | "manual";
export type WatermarkStrength = "soft" | "standard" | "strong";

export interface Point {
  x: number;
  y: number;
}

export interface TemplateSettings {
  template: TemplateKind;
  position: Point;
  fontSize: number;
  opacity: number;
  tone: WatermarkTone;
  customColor: string;
  placementMode: PlacementMode;
  strength: WatermarkStrength | "custom";
  rotation: number;
  spacing: number;
}

export interface ExportSettings {
  resizeMode: ResizeMode;
  fitMode: FitMode;
  format: OutputFormat;
  jpegQuality: number;
}

export interface LocalImageRecord {
  id: string;
  name: string;
  sizeBytes: number;
}

export interface LocalWatermarkRecord extends LocalImageRecord {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml";
}

export interface SaveExportRequest {
  directory: string;
  sourceName: string;
  format: OutputFormat;
  bytes: Uint8Array;
}

export interface SaveExportResult {
  path: string;
  fileName: string;
}

export interface PlacementSuggestion {
  position: Point;
  tone: "dark" | "light";
  opacity: number;
  score: number;
}

export interface PlacementAnalysisRequest {
  id: string;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  template: TemplateKind;
}

export interface PlacementAnalysisResponse {
  id: string;
  suggestion?: PlacementSuggestion;
  error?: string;
}

export interface JanepuBridge {
  selectImages: () => Promise<LocalImageRecord[]>;
  registerDroppedFiles: (paths: string[]) => Promise<LocalImageRecord[]>;
  pathForFile: (file: File) => string;
  readImage: (id: string) => Promise<Uint8Array>;
  selectWatermark: () => Promise<LocalWatermarkRecord | null>;
  chooseOutputDirectory: () => Promise<string | null>;
  saveExport: (request: SaveExportRequest) => Promise<SaveExportResult>;
  showItemInFolder: (path: string) => Promise<void>;
}
