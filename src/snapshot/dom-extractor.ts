import type { Page } from "patchright";
import type { SnapshotElement } from "./accessibility";

/**
 * Fallback snapshot extractor using DOM traversal
 * Used when accessibility API is not available
 */
export class DomSnapshotExtractor {
  private elementCounter = 0;
  private elementMap = new Map<string, { selector: string; element: SnapshotElement }>();

  async extract(page: Page, interactiveOnly = true): Promise<SnapshotElement[]> {
    this.elementCounter = 0;
    this.elementMap.clear();

    // Inject script to extract interactive elements from DOM
    const elements = await page.evaluate((interactiveOnly) => {
      const interactiveRoles = new Set([
        "button",
        "link",
        "textbox",
        "checkbox",
        "radio",
        "combobox",
        "menuitem",
        "tab",
        "searchbox",
      ]);

      const results: any[] = [];

      // Helper to get role from element
      function getRole(el: Element): string | null {
        // Check ARIA role
        const ariaRole = el.getAttribute("role");
        if (ariaRole) return ariaRole;

        // Infer from tag name
        const tagName = el.tagName.toLowerCase();
        switch (tagName) {
          case "button":
            return "button";
          case "a":
            return "link";
          case "input": {
            const type = (el as HTMLInputElement).type.toLowerCase();
            if (type === "checkbox") return "checkbox";
            if (type === "radio") return "radio";
            if (type === "submit" || type === "button") return "button";
            return "textbox";
          }
          case "textarea":
            return "textbox";
          case "select":
            return "combobox";
          default:
            return null;
        }
      }

      // Helper to get accessible name
      function getName(el: Element): string {
        // Check aria-label
        const ariaLabel = el.getAttribute("aria-label");
        if (ariaLabel) return ariaLabel;

        // Check aria-labelledby
        const labelledBy = el.getAttribute("aria-labelledby");
        if (labelledBy) {
          const labelEl = document.getElementById(labelledBy);
          if (labelEl) return labelEl.textContent?.trim() || "";
        }

        // Check associated label
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          const labels = (el as any).labels;
          if (labels && labels.length > 0) {
            return labels[0].textContent?.trim() || "";
          }
        }

        // Check placeholder
        const placeholder = el.getAttribute("placeholder");
        if (placeholder) return placeholder;

        // Use text content for buttons and links
        if (el.tagName === "BUTTON" || el.tagName === "A") {
          return el.textContent?.trim() || "";
        }

        // Use value for inputs
        if (el instanceof HTMLInputElement) {
          return el.value || "";
        }

        return "";
      }

      // Helper to generate CSS selector
      function getSelector(el: Element): string {
        // Try ID first
        if (el.id) return `#${el.id}`;

        // Generate nth-child selector
        let selector = el.tagName.toLowerCase();
        let current: Element | null = el;

        while (current && current.parentElement) {
          const parent: Element = current.parentElement;
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(current);

          if (index >= 0) {
            selector = `${parent.tagName.toLowerCase()} > ${selector}:nth-child(${index + 1})`;
          }

          current = parent;
          if (current && current.id) {
            selector = `#${current.id} ${selector}`;
            break;
          }

          // Limit depth
          if (selector.split(">").length > 5) break;
        }

        return selector;
      }

      // Traverse DOM
      function traverse(el: Element) {
        const role = getRole(el);

        if (role && (!interactiveOnly || interactiveRoles.has(role))) {
          const name = getName(el);
          const selector = getSelector(el);

          // Get element properties
          const result: any = {
            role,
            name,
            selector,
            disabled: (el as any).disabled || false,
            focused: el === document.activeElement,
            required: (el as any).required || false,
          };

          // Get value for inputs
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            result.value = el.value;
          }

          // Get checked state for checkboxes/radios
          if (el instanceof HTMLInputElement) {
            if (el.type === "checkbox" || el.type === "radio") {
              result.checked = el.checked;
            }
          }

          results.push(result);
        }

        // Recurse to children
        for (const child of Array.from(el.children)) {
          traverse(child);
        }
      }

      traverse(document.body);
      return results;
    }, interactiveOnly);

    // Convert to SnapshotElement format with @eN references
    const snapshotElements: SnapshotElement[] = [];

    for (const el of elements) {
      this.elementCounter++;
      const ref = `e${this.elementCounter}`;

      const snapshotElement: SnapshotElement = {
        ref,
        role: el.role,
        name: el.name,
        value: el.value,
        checked: el.checked,
        disabled: el.disabled,
        focused: el.focused,
        required: el.required,
      };

      snapshotElements.push(snapshotElement);

      // Store mapping from ref to selector
      this.elementMap.set(ref, {
        selector: el.selector,
        element: snapshotElement,
      });
    }

    return snapshotElements;
  }

  /**
   * Get CSS selector for an element reference
   */
  getSelector(ref: string): string | undefined {
    return this.elementMap.get(ref)?.selector;
  }

  /**
   * Get all element references and their selectors
   */
  getAllMappings(): Map<string, string> {
    const mappings = new Map<string, string>();
    for (const [ref, { selector }] of this.elementMap.entries()) {
      mappings.set(ref, selector);
    }
    return mappings;
  }
}
