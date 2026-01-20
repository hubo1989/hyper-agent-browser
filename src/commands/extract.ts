import type { Page } from "patchright";
import { FormExtractor } from "../extractors/form-extractor";
import { ListExtractor } from "../extractors/list-extractor";
import { MetaExtractor } from "../extractors/meta-extractor";
import { TableExtractor } from "../extractors/table-extractor";

export interface ExtractTableOptions {
  selector?: string;
  includeHeaders?: boolean;
  maxRows?: number;
}

export interface ExtractListOptions {
  selector?: string;
  pattern?: string;
  maxItems?: number;
}

export interface ExtractFormOptions {
  selector?: string;
  includeDisabled?: boolean;
}

export interface ExtractMetaOptions {
  include?: string[];
}

/**
 * 提取表格数据
 */
export async function extractTable(page: Page, options: ExtractTableOptions = {}): Promise<string> {
  const extractor = new TableExtractor();
  const result = await extractor.extract(page, options.selector, {
    includeHeaders: options.includeHeaders,
    maxRows: options.maxRows,
  });

  return JSON.stringify(result, null, 2);
}

/**
 * 提取列表数据
 */
export async function extractList(page: Page, options: ExtractListOptions = {}): Promise<string> {
  const extractor = new ListExtractor();
  const result = await extractor.extract(page, options.selector, {
    pattern: options.pattern,
    maxItems: options.maxItems,
  });

  return JSON.stringify(result, null, 2);
}

/**
 * 提取表单数据
 */
export async function extractForm(page: Page, options: ExtractFormOptions = {}): Promise<string> {
  const extractor = new FormExtractor();
  const result = await extractor.extract(page, options.selector, {
    includeDisabled: options.includeDisabled,
  });

  return JSON.stringify(result, null, 2);
}

/**
 * 提取元数据
 */
export async function extractMeta(page: Page, options: ExtractMetaOptions = {}): Promise<string> {
  const extractor = new MetaExtractor();
  const result = await extractor.extract(page, {
    include: options.include,
  });

  return JSON.stringify(result, null, 2);
}
