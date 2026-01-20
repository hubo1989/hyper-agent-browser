import type { Snapshot, SnapshotElement } from "./accessibility";

export interface FormatOptions {
  maxElements?: number;
  includeDisabled?: boolean;
}

export class SnapshotFormatter {
  format(snapshot: Snapshot, options: FormatOptions = {}): string {
    const lines: string[] = [];

    // Header
    lines.push(`URL: ${snapshot.url}`);
    lines.push(`Title: ${snapshot.title}`);
    lines.push("");

    // Elements
    let elements = snapshot.elements;

    // Filter disabled elements if needed
    if (!options.includeDisabled) {
      elements = elements.filter((el) => !el.disabled);
    }

    // Limit elements
    if (options.maxElements && elements.length > options.maxElements) {
      elements = elements.slice(0, options.maxElements);
      lines.push(
        `Interactive Elements (showing ${options.maxElements} of ${snapshot.elements.length}):`,
      );
    } else {
      lines.push("Interactive Elements:");
    }

    // Format each element
    for (const element of elements) {
      lines.push(this.formatElement(element));
    }

    if (elements.length === 0) {
      lines.push("  (no interactive elements found)");
    }

    return lines.join("\n");
  }

  formatElement(element: SnapshotElement): string {
    const parts: string[] = [];

    // Reference
    parts.push(`@${element.ref}`);

    // Role
    parts.push(`[${element.role}]`.padEnd(12));

    // Name
    if (element.name) {
      parts.push(`"${element.name}"`);
    }

    // Value
    if (element.value && element.value !== element.name) {
      parts.push(`value="${element.value}"`);
    }

    // States
    const states: string[] = [];
    if (element.focused) states.push("focused");
    if (element.checked !== undefined) {
      states.push(element.checked ? "checked" : "unchecked");
    }
    if (element.selected) states.push("selected");
    if (element.disabled) states.push("disabled");
    if (element.required) states.push("required");

    if (states.length > 0) {
      parts.push(`(${states.join(", ")})`);
    }

    return parts.join("  ");
  }

  formatJson(snapshot: Snapshot, pretty = true): string {
    return JSON.stringify(snapshot, null, pretty ? 2 : 0);
  }

  formatCompact(snapshot: Snapshot): string {
    const lines: string[] = [];
    lines.push(`${snapshot.url} | ${snapshot.title}`);
    lines.push(`Elements: ${snapshot.elements.length}`);
    return lines.join("\n");
  }

  formatSummary(snapshot: Snapshot): string {
    const roleCounts = new Map<string, number>();

    for (const element of snapshot.elements) {
      const count = roleCounts.get(element.role) || 0;
      roleCounts.set(element.role, count + 1);
    }

    const lines: string[] = [];
    lines.push(`URL: ${snapshot.url}`);
    lines.push(`Title: ${snapshot.title}`);
    lines.push("");
    lines.push("Element Summary:");

    const sorted = Array.from(roleCounts.entries()).sort((a, b) => b[1] - a[1]);
    for (const [role, count] of sorted) {
      lines.push(`  ${role}: ${count}`);
    }

    return lines.join("\n");
  }
}
