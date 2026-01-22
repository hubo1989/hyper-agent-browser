import { existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { Page } from "patchright";
import { parseSelector } from "../utils/selector";

// Global reference store for element mappings
let globalReferenceStore: any = null;

export function setReferenceStore(store: any) {
  globalReferenceStore = store;
}

async function getLocator(page: Page, selector: string) {
  const parsed = parseSelector(selector);

  switch (parsed.type) {
    case "ref": {
      if (!globalReferenceStore) {
        throw new Error(
          `Element reference @${parsed.value} requires a snapshot first. Run 'hab snapshot -i' to generate element references.`,
        );
      }

      const actualSelector = globalReferenceStore.get(parsed.value);
      if (!actualSelector) {
        throw new Error(
          `Element reference @${parsed.value} not found. Run 'hab snapshot -i' to update element references.`,
        );
      }

      return page.locator(actualSelector);
    }
    case "css":
      return page.locator(parsed.value);
    case "text":
      return page.getByText(parsed.value);
    case "xpath":
      return page.locator(`xpath=${parsed.value}`);
    default:
      throw new Error(`Unknown selector type: ${parsed.type}`);
  }
}

export interface DownloadOptions {
  output?: string;
  timeout?: number;
}

export interface DownloadResult {
  success: boolean;
  path: string;
  filename: string;
  size?: number;
}

/**
 * Download file by clicking an element (link/button)
 * Uses browser's native download capability to preserve cookies/auth
 */
export async function download(
  page: Page,
  selector: string,
  options: DownloadOptions = {},
): Promise<DownloadResult> {
  const timeout = options.timeout || 60000;

  // Determine output directory
  let outputDir: string;
  let specifiedFilename: string | undefined;

  if (options.output) {
    if (options.output.endsWith("/") || !options.output.includes(".")) {
      // It's a directory
      outputDir = options.output;
    } else {
      // It's a file path
      outputDir = join(options.output, "..");
      specifiedFilename = basename(options.output);
    }
  } else {
    // Default to current directory
    outputDir = process.cwd();
  }

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const locator = await getLocator(page, selector);

  // Wait for download event while clicking
  const downloadPromise = page.waitForEvent("download", { timeout });

  await locator.click();

  const download = await downloadPromise;

  // Get suggested filename or use specified one
  const filename = specifiedFilename || download.suggestedFilename();
  const outputPath = join(outputDir, filename);

  // Save the file
  await download.saveAs(outputPath);

  // Get file stats if possible
  let size: number | undefined;
  try {
    const stat = await Bun.file(outputPath).stat();
    size = stat?.size;
  } catch {
    // Ignore stat errors
  }

  return {
    success: true,
    path: outputPath,
    filename,
    size,
  };
}

/**
 * Download file directly from URL
 * Uses Playwright's request API to preserve cookies/auth (bypasses CORS)
 */
export async function downloadUrl(
  page: Page,
  url: string,
  options: DownloadOptions = {},
): Promise<DownloadResult> {
  // Determine output directory and filename
  let outputDir: string;
  let specifiedFilename: string | undefined;

  if (options.output) {
    if (options.output.endsWith("/") || !options.output.includes(".")) {
      outputDir = options.output;
    } else {
      outputDir = join(options.output, "..");
      specifiedFilename = basename(options.output);
    }
  } else {
    outputDir = process.cwd();
  }

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Use Playwright's request API (shares cookies with browser context, bypasses CORS)
  const context = page.context();
  const response = await context.request.get(url);

  if (!response.ok()) {
    throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
  }

  // Get filename from Content-Disposition header or URL
  let filename = "";
  const contentDisposition = response.headers()["content-disposition"];
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match) {
      filename = match[1].replace(/['"]/g, "");
    }
  }

  // Determine final filename
  filename = specifiedFilename || filename || basename(new URL(url).pathname) || "download";
  const outputPath = join(outputDir, filename);

  // Get body and write to file
  const body = await response.body();
  await Bun.write(outputPath, body);

  return {
    success: true,
    path: outputPath,
    filename,
    size: body.byteLength,
  };
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format download result for CLI output
 */
export function formatDownloadResult(result: DownloadResult): string {
  const sizeStr = result.size ? ` (${formatSize(result.size)})` : "";
  return `Downloaded: ${result.filename}${sizeStr}\nSaved to: ${result.path}`;
}
