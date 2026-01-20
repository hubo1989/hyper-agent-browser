export class HBAError extends Error {
  code: string;
  hint?: string;

  constructor(message: string, code: string, hint?: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.hint = hint;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SessionNotFoundError extends HBAError {
  constructor(sessionName: string) {
    super(
      `Session '${sessionName}' not found`,
      "SESSION_NOT_FOUND",
      "Run 'hab sessions' to see available sessions",
    );
  }
}

export class ElementNotFoundError extends HBAError {
  constructor(selector: string) {
    super(
      `Element not found: ${selector}`,
      "ELEMENT_NOT_FOUND",
      "Run 'hab snapshot -i' to see available elements",
    );
  }
}

export class BrowserNotRunningError extends HBAError {
  constructor() {
    super("Browser not running", "BROWSER_NOT_RUNNING", "Run 'hab open <url>' first");
  }
}

export class TimeoutError extends HBAError {
  constructor(operation: string, timeout: number) {
    super(
      `Operation timed out: ${operation} (${timeout}ms)`,
      "TIMEOUT",
      "Increase timeout with --timeout option",
    );
  }
}

export class NavigationError extends HBAError {
  constructor(url: string, reason?: string) {
    super(
      `Navigation failed: ${url}${reason ? ` (${reason})` : ""}`,
      "NAVIGATION_FAILED",
      "Check if the URL is accessible and valid",
    );
  }
}

export class SelectorError extends HBAError {
  constructor(selector: string) {
    super(
      `Invalid selector: ${selector}`,
      "INVALID_SELECTOR",
      "Use @eN, css=..., text=..., or xpath=...",
    );
  }
}

export class ConfigError extends HBAError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR", "Check ~/.hab/config.json for syntax errors");
  }
}

export class PermissionError extends HBAError {
  constructor(path: string) {
    super(`Permission denied: ${path}`, "PERMISSION_ERROR", "Check file/directory permissions");
  }
}

/**
 * Format error for CLI output
 */
export function formatError(error: Error): string {
  let output = `Error: ${error.message}`;

  if (error instanceof HBAError) {
    if (error.hint) {
      output += `\n  Hint: ${error.hint}`;
    }
    output += `\n  Code: ${error.code}`;
  }

  return output;
}

/**
 * Get exit code for error type
 */
export function getExitCode(error: Error): number {
  if (error instanceof HBAError) {
    switch (error.code) {
      case "INVALID_SELECTOR":
        return 2; // Argument error
      case "SESSION_NOT_FOUND":
      case "CONFIG_ERROR":
        return 3; // Session error
      case "BROWSER_NOT_RUNNING":
      case "NAVIGATION_FAILED":
        return 4; // Browser error
      case "ELEMENT_NOT_FOUND":
        return 5; // Element error
      case "TIMEOUT":
        return 6; // Timeout
      default:
        return 1; // General error
    }
  }
  return 1; // General error
}
