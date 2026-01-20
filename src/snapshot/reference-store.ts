import type { Session } from '../session/store';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/**
 * Stores and retrieves element reference mappings for a session
 * Maps @eN references to actual CSS selectors
 */
export class ReferenceStore {
  private sessionDir: string;
  private mappingsFile: string;
  private mappings: Map<string, string> = new Map();

  constructor(session: Session) {
    this.sessionDir = join(session.userDataDir, '..');
    this.mappingsFile = join(this.sessionDir, 'element-mappings.json');
  }

  /**
   * Load mappings from disk
   */
  async load(): Promise<void> {
    if (!existsSync(this.mappingsFile)) {
      this.mappings.clear();
      return;
    }

    try {
      const content = await readFile(this.mappingsFile, 'utf-8');
      const data = JSON.parse(content);
      this.mappings = new Map(Object.entries(data));
    } catch (error) {
      console.error('Failed to load element mappings:', error);
      this.mappings.clear();
    }
  }

  /**
   * Save mappings to disk
   */
  async save(): Promise<void> {
    try {
      // Ensure directory exists
      if (!existsSync(this.sessionDir)) {
        await mkdir(this.sessionDir, { recursive: true, mode: 0o700 });
      }

      const data = Object.fromEntries(this.mappings);
      await writeFile(this.mappingsFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save element mappings:', error);
    }
  }

  /**
   * Store a new mapping
   */
  set(ref: string, selector: string): void {
    this.mappings.set(ref, selector);
  }

  /**
   * Get selector for a reference
   */
  get(ref: string): string | undefined {
    return this.mappings.get(ref);
  }

  /**
   * Update all mappings at once
   */
  setAll(mappings: Map<string, string>): void {
    this.mappings = new Map(mappings);
  }

  /**
   * Clear all mappings
   */
  clear(): void {
    this.mappings.clear();
  }

  /**
   * Get all mappings
   */
  getAll(): Map<string, string> {
    return new Map(this.mappings);
  }

  /**
   * Check if a reference exists
   */
  has(ref: string): boolean {
    return this.mappings.has(ref);
  }
}
