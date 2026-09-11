/// <reference types="vite/client" />

import type { JanepuBridge } from "@shared/types";

declare global {
  interface Window {
    janepu: JanepuBridge;
  }
}

export {};
