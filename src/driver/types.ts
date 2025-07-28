export interface ViewportOptions {
  width: number;
  height: number;
}

export interface ScreenshotOptions {
  path?: string;
  fullPage?: boolean;
}

export interface Driver {
  goto(url: string): Promise<void>;
  screenshot(options?: ScreenshotOptions): Promise<Buffer>;
  evaluate<T>(fn: () => T): Promise<T>;
  close(): Promise<void>;
  getViewport(): ViewportOptions;
}