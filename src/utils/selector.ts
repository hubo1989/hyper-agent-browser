export type SelectorType = "ref" | "css" | "text" | "xpath";

export interface ParsedSelector {
  type: SelectorType;
  value: string;
}

export function parseSelector(selector: string): ParsedSelector {
  if (selector.startsWith("@e")) {
    return { type: "ref", value: selector.slice(1) };
  }
  if (selector.startsWith("css=")) {
    return { type: "css", value: selector.slice(4) };
  }
  if (selector.startsWith("text=")) {
    return { type: "text", value: selector.slice(5) };
  }
  if (selector.startsWith("xpath=")) {
    return { type: "xpath", value: selector.slice(6) };
  }
  // Default to CSS
  return { type: "css", value: selector };
}
