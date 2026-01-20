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

// ============ Get 系列命令 ============

export async function getText(page: Page, selector: string): Promise<string> {
  const locator = await getLocator(page, selector);
  const text = await locator.textContent();
  return text || "";
}

export async function getValue(page: Page, selector: string): Promise<string> {
  const locator = await getLocator(page, selector);
  const value = await locator.inputValue();
  return value || "";
}

export async function getAttr(page: Page, selector: string, attribute: string): Promise<string> {
  const locator = await getLocator(page, selector);
  const value = await locator.getAttribute(attribute);
  return value || "";
}

export async function getHtml(page: Page, selector: string): Promise<string> {
  const locator = await getLocator(page, selector);
  const html = await locator.innerHTML();
  return html || "";
}

export async function getCount(page: Page, selector: string): Promise<number> {
  const locator = await getLocator(page, selector);
  return await locator.count();
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function getBox(page: Page, selector: string): Promise<BoundingBox | null> {
  const locator = await getLocator(page, selector);
  return await locator.boundingBox();
}

// ============ Is 系列命令 (状态检查) ============

export async function isVisible(page: Page, selector: string): Promise<boolean> {
  const locator = await getLocator(page, selector);
  return await locator.isVisible();
}

export async function isEnabled(page: Page, selector: string): Promise<boolean> {
  const locator = await getLocator(page, selector);
  return await locator.isEnabled();
}

export async function isChecked(page: Page, selector: string): Promise<boolean> {
  const locator = await getLocator(page, selector);
  return await locator.isChecked();
}

export async function isEditable(page: Page, selector: string): Promise<boolean> {
  const locator = await getLocator(page, selector);
  return await locator.isEditable();
}

export async function isHidden(page: Page, selector: string): Promise<boolean> {
  const locator = await getLocator(page, selector);
  return await locator.isHidden();
}
