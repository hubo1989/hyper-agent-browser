import { describe, expect, it } from "bun:test";
import { parseSelector } from "../../src/utils/selector";

describe("parseSelector", () => {
  it("should parse element reference", () => {
    const result = parseSelector("@e5");
    expect(result).toEqual({ type: "ref", value: "e5" });
  });

  it("should parse CSS selector", () => {
    const result = parseSelector("css=.btn");
    expect(result).toEqual({ type: "css", value: ".btn" });
  });

  it("should parse text selector", () => {
    const result = parseSelector("text=Login");
    expect(result).toEqual({ type: "text", value: "Login" });
  });

  it("should parse xpath selector", () => {
    const result = parseSelector("xpath=//button");
    expect(result).toEqual({ type: "xpath", value: "//button" });
  });

  it("should default to CSS for plain selectors", () => {
    const result = parseSelector(".btn");
    expect(result).toEqual({ type: "css", value: ".btn" });
  });
});
