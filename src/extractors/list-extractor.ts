import type { Page } from "patchright";

export interface ListData {
  type: "list";
  url: string;
  selector: string;
  timestamp: number;
  pattern: string;
  items: number;
  data: Record<string, any>[];
}

export class ListExtractor {
  /**
   * 提取列表数据
   */
  async extract(
    page: Page,
    selector?: string,
    options: { pattern?: string; maxItems?: number } = {},
  ): Promise<ListData> {
    const pattern = options.pattern ?? "auto";
    const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;

    const url = page.url();
    const timestamp = Date.now();

    const result = await page.evaluate(
      ({ selector, pattern, maxItems }) => {
        let container: Element | null = null;

        if (selector) {
          container = document.querySelector(selector);
        } else {
          // 查找常见的列表容器
          container =
            document.querySelector("ul") ||
            document.querySelector("ol") ||
            document.querySelector('[role="list"]') ||
            document.body;
        }

        if (!container) {
          throw new Error("No list container found");
        }

        // 自动检测重复结构
        let items: Element[] = [];
        let detectedPattern = "";

        if (pattern === "auto") {
          // 尝试不同的模式
          const patterns = [
            "li",
            '[role="listitem"]',
            ".item",
            ".product",
            ".card",
            "[class*='item']",
            "[class*='card']",
            "[class*='product']",
          ];

          for (const p of patterns) {
            const elements = Array.from(container.querySelectorAll(p));
            if (elements.length > 1) {
              items = elements;
              detectedPattern = p;
              break;
            }
          }

          // 如果还是找不到，尝试检测相同 class 的兄弟元素
          if (items.length === 0) {
            const children = Array.from(container.children);
            const classMap = new Map<string, Element[]>();

            children.forEach((child) => {
              const className = child.className;
              if (className) {
                if (!classMap.has(className)) {
                  classMap.set(className, []);
                }
                classMap.get(className)!.push(child);
              }
            });

            // 找到最多重复的 class
            let maxCount = 0;
            let maxClass = "";
            classMap.forEach((elements, className) => {
              if (elements.length > maxCount) {
                maxCount = elements.length;
                maxClass = className;
              }
            });

            if (maxCount > 1) {
              items = classMap.get(maxClass)!;
              detectedPattern = `.${maxClass.split(" ")[0]}`;
            }
          }
        } else {
          items = Array.from(container.querySelectorAll(pattern));
          detectedPattern = pattern;
        }

        if (items.length === 0) {
          throw new Error("No repeating items found");
        }

        // 限制数量
        items = items.slice(0, maxItems);

        // 提取每个 item 的数据
        const data = items.map((item) => extractItemData(item));

        return {
          pattern: detectedPattern,
          data,
        };
      },
      { selector: selector || "", pattern, maxItems },
    );

    return {
      type: "list",
      url,
      selector: selector || "auto",
      timestamp,
      pattern: result.pattern,
      items: result.data.length,
      data: result.data,
    };
  }
}

/**
 * 提取单个列表项的数据
 */
function extractItemData(item: Element): Record<string, any> {
  const data: Record<string, any> = {};

  // 提取 data-* 属性
  if (item instanceof HTMLElement) {
    Array.from(item.attributes).forEach((attr) => {
      if (attr.name.startsWith("data-")) {
        const key = attr.name.substring(5);
        data[key] = attr.value;
      }
    });
  }

  // 提取 id
  if (item.id) {
    data.id = item.id;
  }

  // 提取文本内容
  const textNodes: string[] = [];
  const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, null);

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim();
    if (text && text.length > 0) {
      textNodes.push(text);
    }
  }

  if (textNodes.length === 1) {
    data.text = textNodes[0];
  } else if (textNodes.length > 1) {
    data.text = textNodes.join(" ");
  }

  // 提取链接
  const link = item.querySelector("a");
  if (link instanceof HTMLAnchorElement) {
    data.link = link.href;
    if (!data.text) {
      data.text = link.textContent?.trim();
    }
  }

  // 提取图片
  const img = item.querySelector("img");
  if (img instanceof HTMLImageElement) {
    data.image = img.src;
    if (img.alt) {
      data.imageAlt = img.alt;
    }
  }

  // 提取常见字段（通过 class 或元素结构）
  const title = item.querySelector('[class*="title"], h1, h2, h3, h4, h5, h6');
  if (title) {
    data.title = title.textContent?.trim();
  }

  const price = item.querySelector('[class*="price"]');
  if (price) {
    data.price = price.textContent?.trim();
  }

  const description = item.querySelector('[class*="desc"], [class*="summary"], p');
  if (description && description !== title) {
    data.description = description.textContent?.trim();
  }

  return data;
}
