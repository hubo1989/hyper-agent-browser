import type { Page } from "patchright";
import { AccessibilityExtractor } from "../snapshot/accessibility";
import { DomSnapshotExtractor } from "../snapshot/dom-extractor";
import { SnapshotFormatter } from "../snapshot/formatter";

export interface SnapshotOptions {
  interactive?: boolean;
  full?: boolean;
  raw?: boolean;
  maxElements?: number;
  referenceStore?: any; // Will be ReferenceStore instance
}

export async function snapshot(page: Page, options: SnapshotOptions = {}): Promise<string> {
  const interactiveOnly = options.interactive ?? true;

  // Try accessibility API first, fallback to DOM extraction
  let snapshot;
  let domExtractor: DomSnapshotExtractor | null = null;

  try {
    const accessibilityExtractor = new AccessibilityExtractor();
    snapshot = await accessibilityExtractor.extract(page, interactiveOnly);

    // If snapshot is empty, try DOM extraction
    if (snapshot.elements.length === 0) {
      throw new Error("Accessibility API returned no elements");
    }
  } catch (error) {
    // Fallback to DOM extraction
    domExtractor = new DomSnapshotExtractor();
    const elements = await domExtractor.extract(page, interactiveOnly);

    snapshot = {
      url: await page.url(),
      title: await page.title(),
      timestamp: Date.now(),
      elements,
    };

    // Store element-to-selector mappings if referenceStore is provided
    if (options.referenceStore && domExtractor) {
      const mappings = domExtractor.getAllMappings();
      options.referenceStore.setAll(mappings);
      await options.referenceStore.save();
    }
  }

  if (options.raw) {
    const formatter = new SnapshotFormatter();
    return formatter.formatJson(snapshot, true);
  }

  const formatter = new SnapshotFormatter();
  return formatter.format(snapshot, {
    maxElements: options.maxElements,
    includeDisabled: options.full,
  });
}

export interface ScreenshotOptions {
  output?: string;
  fullPage?: boolean;
  selector?: string;
  quality?: number;
}

export async function screenshot(page: Page, options: ScreenshotOptions = {}): Promise<string> {
  const output = options.output || "screenshot.png";

  if (options.selector) {
    const { parseSelector } = await import("../utils/selector");
    const parsed = parseSelector(options.selector);

    let locator;
    if (parsed.type === "css") {
      locator = page.locator(parsed.value);
    } else if (parsed.type === "text") {
      locator = page.getByText(parsed.value);
    } else if (parsed.type === "xpath") {
      locator = page.locator(`xpath=${parsed.value}`);
    } else {
      throw new Error(`Unsupported selector type for screenshot: ${parsed.type}`);
    }

    await locator.screenshot({ path: output });
  } else {
    await page.screenshot({
      path: output,
      fullPage: options.fullPage,
    });
  }

  return output;
}

const FORBIDDEN_PATTERNS = [
  /require\s*\(/,
  /import\s*\(/,
  /process\./,
  /child_process/,
  /fs\./,
  /__dirname/,
  /__filename/,
];

export async function evaluate(page: Page, script: string): Promise<any> {
  // Security check
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(script)) {
      throw new Error("Potentially unsafe script blocked");
    }
  }

  return page.evaluate(script);
}

export async function url(page: Page): Promise<string> {
  return page.url();
}

export async function title(page: Page): Promise<string> {
  return page.title();
}

export interface ContentOptions {
  selector?: string;
  maxLength?: number;
}

export async function content(page: Page, options: ContentOptions = {}): Promise<string> {
  const maxLength = options.maxLength || 10000;

  let text: string;
  if (options.selector) {
    const { parseSelector } = await import("../utils/selector");
    const parsed = parseSelector(options.selector);

    let locator;
    if (parsed.type === "css") {
      locator = page.locator(parsed.value);
    } else if (parsed.type === "text") {
      locator = page.getByText(parsed.value);
    } else if (parsed.type === "xpath") {
      locator = page.locator(`xpath=${parsed.value}`);
    } else {
      throw new Error(`Unsupported selector type: ${parsed.type}`);
    }

    text = (await locator.textContent()) || "";
  } else {
    text = (await page.textContent("body")) || "";
  }

  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + `... (truncated at ${maxLength} chars)`;
  }

  return text;
}
