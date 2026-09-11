/// <reference lib="webworker" />

import type { PlacementAnalysisRequest, PlacementAnalysisResponse } from "@shared/types";
import { suggestPlacement } from "../lib/placement";

self.onmessage = (event: MessageEvent<PlacementAnalysisRequest>) => {
  const request = event.data;
  let response: PlacementAnalysisResponse;
  try {
    response = {
      id: request.id,
      suggestion: suggestPlacement(request.pixels, request.width, request.height, request.template),
    };
  } catch (error) {
    response = { id: request.id, error: error instanceof Error ? error.message : "无法分析图片。" };
  }
  self.postMessage(response);
};
