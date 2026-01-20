import type { Page } from "patchright";

export interface TableData {
  type: "table";
  url: string;
  selector: string;
  timestamp: number;
  headers: string[];
  rows: number;
  data: Record<string, string>[];
}

export class TableExtractor {
  /**
   * 提取表格数据
   */
  async extract(
    page: Page,
    selector?: string,
    options: { includeHeaders?: boolean; maxRows?: number } = {},
  ): Promise<TableData> {
    const maxRows = options.maxRows ?? Number.POSITIVE_INFINITY;

    const url = page.url();
    const timestamp = Date.now();

    // 在页面上下文中执行提取逻辑
    const result = await page.evaluate(
      ({ selector, maxRows }) => {
        // 查找表格元素
        let table: HTMLTableElement | null = null;

        if (selector) {
          const element = document.querySelector(selector);
          if (element instanceof HTMLTableElement) {
            table = element;
          } else if (element) {
            // 在指定元素内查找表格
            const nestedTable = element.querySelector("table");
            if (nestedTable instanceof HTMLTableElement) {
              table = nestedTable;
            }
          }
        } else {
          // 查找第一个可见的表格
          const tables = Array.from(document.querySelectorAll("table"));
          table =
            tables.find((t) => {
              const style = window.getComputedStyle(t);
              return style.display !== "none" && style.visibility !== "hidden";
            }) || null;
        }

        if (!table) {
          // 尝试查找 ARIA table
          const ariaTable = selector
            ? document.querySelector(selector)
            : document.querySelector('[role="table"], [role="grid"]');

          if (ariaTable) {
            return extractAriaTable(ariaTable as HTMLElement, maxRows);
          }

          throw new Error("No table found on page");
        }

        return extractHtmlTable(table, maxRows);
      },
      { selector: selector || "", maxRows },
    );

    return {
      type: "table",
      url,
      selector: selector || "table",
      timestamp,
      headers: result.headers,
      rows: result.data.length,
      data: result.data,
    };
  }
}

/**
 * 在页面上下文中执行的辅助函数
 */

// 提取 HTML 表格
function extractHtmlTable(
  table: HTMLTableElement,
  maxRows: number,
): { headers: string[]; data: Record<string, string>[] } {
  const headers: string[] = [];
  const data: Record<string, string>[] = [];

  // 提取表头
  const thead = table.querySelector("thead");
  const headerRow = thead?.querySelector("tr") || table.querySelector("tr");

  if (headerRow) {
    const headerCells = Array.from(headerRow.querySelectorAll("th, td"));
    headerCells.forEach((cell, index) => {
      const text = cell.textContent?.trim() || "";
      const headerText = text || `column_${index + 1}`;
      headers.push(headerText);
    });
  }

  // 如果没有表头，根据第一行推断
  if (headers.length === 0) {
    const firstRow = table.querySelector("tr");
    if (firstRow) {
      const cells = Array.from(firstRow.querySelectorAll("td, th"));
      cells.forEach((_, index) => {
        headers.push(`column_${index + 1}`);
      });
    }
  }

  // 提取数据行
  const tbody = table.querySelector("tbody") || table;
  const rows = Array.from(tbody.querySelectorAll("tr"));

  // 跳过表头行（如果表头在 tbody 内）
  const startIndex = thead ? 0 : 1;

  for (let i = startIndex; i < rows.length && data.length < maxRows; i++) {
    const row = rows[i];

    // 跳过隐藏行
    const style = window.getComputedStyle(row);
    if (style.display === "none" || style.visibility === "hidden") {
      continue;
    }

    const cells = Array.from(row.querySelectorAll("td, th"));
    const rowData: Record<string, string> = {};

    cells.forEach((cell, index) => {
      if (index >= headers.length) return;

      const text = cell.textContent?.trim() || "";
      // 处理合并单元格
      const colspan = Number.parseInt(cell.getAttribute("colspan") || "1");

      if (colspan > 1) {
        // 对于合并的单元格，填充到多个列
        for (let j = 0; j < colspan && index + j < headers.length; j++) {
          rowData[headers[index + j]] = text;
        }
      } else {
        rowData[headers[index]] = text;
      }
    });

    // 只添加非空行
    if (Object.values(rowData).some((v) => v !== "")) {
      data.push(rowData);
    }
  }

  return { headers, data };
}

// 提取 ARIA 表格
function extractAriaTable(
  table: HTMLElement,
  maxRows: number,
): { headers: string[]; data: Record<string, string>[] } {
  const headers: string[] = [];
  const data: Record<string, string>[] = [];

  // 查找表头行
  const headerRow = table.querySelector('[role="row"]:first-child');
  if (headerRow) {
    const headerCells = Array.from(
      headerRow.querySelectorAll('[role="columnheader"], [role="gridcell"]'),
    );
    headerCells.forEach((cell, index) => {
      const text = cell.textContent?.trim() || "";
      headers.push(text || `column_${index + 1}`);
    });
  }

  // 查找数据行
  const rows = Array.from(table.querySelectorAll('[role="row"]'));

  // 跳过表头行
  const startIndex = headerRow ? 1 : 0;

  for (let i = startIndex; i < rows.length && data.length < maxRows; i++) {
    const row = rows[i];

    // 跳过隐藏行
    const style = window.getComputedStyle(row);
    if (style.display === "none" || style.visibility === "hidden") {
      continue;
    }

    const cells = Array.from(row.querySelectorAll('[role="gridcell"], [role="cell"]'));
    const rowData: Record<string, string> = {};

    cells.forEach((cell, index) => {
      if (index >= headers.length) return;
      const text = cell.textContent?.trim() || "";
      rowData[headers[index]] = text;
    });

    if (Object.values(rowData).some((v) => v !== "")) {
      data.push(rowData);
    }
  }

  return { headers, data };
}
