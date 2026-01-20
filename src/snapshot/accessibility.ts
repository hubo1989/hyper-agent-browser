import type { Page } from "patchright";

export interface SnapshotElement {
  ref: string;
  role: string;
  name: string;
  value?: string;
  description?: string;
  checked?: boolean;
  selected?: boolean;
  disabled?: boolean;
  focused?: boolean;
  required?: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Snapshot {
  url: string;
  title: string;
  timestamp: number;
  elements: SnapshotElement[];
}

const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "menuitem",
  "tab",
  "searchbox",
  "spinbutton",
  "slider",
  "switch",
  "option",
]);

interface AccessibilityNode {
  role?: string;
  name?: string;
  value?: string | number;
  description?: string;
  checked?: boolean | "mixed";
  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  level?: number;
  modal?: boolean;
  multiline?: boolean;
  multiselectable?: boolean;
  orientation?: string;
  placeholder?: string;
  pressed?: boolean | "mixed";
  readonly?: boolean;
  required?: boolean;
  selected?: boolean;
  valuemax?: number;
  valuemin?: number;
  valuenow?: number;
  valuetext?: string;
  children?: AccessibilityNode[];
}

export class AccessibilityExtractor {
  private elementCounter = 0;
  private elementMap = new Map<string, SnapshotElement>();

  private async getAccessibilitySnapshot(page: Page): Promise<AccessibilityNode | null> {
    try {
      // Try to use accessibility API if available
      return await (page as any).accessibility?.snapshot();
    } catch {
      // Fallback: return null, we'll implement alternative extraction later
      return null;
    }
  }

  async extract(page: Page, interactiveOnly = true): Promise<Snapshot> {
    this.elementCounter = 0;
    this.elementMap.clear();

    const url = page.url();
    const title = await page.title();
    const timestamp = Date.now();

    // Get accessibility tree
    // Note: Using locator API as fallback since accessibility API may not be available
    const snapshot = await this.getAccessibilitySnapshot(page);
    if (!snapshot) {
      return { url, title, timestamp, elements: [] };
    }

    // Extract elements
    const elements = this.extractElements(snapshot, interactiveOnly);

    return {
      url,
      title,
      timestamp,
      elements,
    };
  }

  private extractElements(node: AccessibilityNode, interactiveOnly: boolean): SnapshotElement[] {
    const elements: SnapshotElement[] = [];

    if (this.shouldInclude(node, interactiveOnly)) {
      const element = this.nodeToElement(node);
      if (element) {
        elements.push(element);
      }
    }

    // Recursively process children
    if (node.children) {
      for (const child of node.children) {
        elements.push(...this.extractElements(child, interactiveOnly));
      }
    }

    return elements;
  }

  private shouldInclude(node: AccessibilityNode, interactiveOnly: boolean): boolean {
    if (!node.role) {
      return false;
    }

    if (interactiveOnly) {
      return INTERACTIVE_ROLES.has(node.role);
    }

    return true;
  }

  private nodeToElement(node: AccessibilityNode): SnapshotElement | null {
    if (!node.role) {
      return null;
    }

    this.elementCounter++;
    const ref = `e${this.elementCounter}`;

    const element: SnapshotElement = {
      ref,
      role: node.role,
      name: node.name || "",
      value: this.formatValue(node.value),
      description: node.description,
      checked: typeof node.checked === "boolean" ? node.checked : undefined,
      selected: node.selected,
      disabled: node.disabled,
      focused: node.focused,
      required: node.required,
    };

    this.elementMap.set(ref, element);
    return element;
  }

  private formatValue(value: string | number | undefined): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return String(value);
  }

  getElementByRef(ref: string): SnapshotElement | undefined {
    return this.elementMap.get(ref);
  }

  getAllElements(): SnapshotElement[] {
    return Array.from(this.elementMap.values());
  }
}
