import type { Page } from "patchright";

export interface MetaData {
  type: "metadata";
  url: string;
  timestamp: number;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
    canonical?: string;
    robots?: string;
  };
  og?: Record<string, string>;
  twitter?: Record<string, string>;
  schema?: any[];
  other?: Record<string, string>;
}

export class MetaExtractor {
  /**
   * 提取页面元数据
   */
  async extract(page: Page, options: { include?: string[] } = {}): Promise<MetaData> {
    const include = options.include ?? ["seo", "og", "twitter", "schema", "other"];

    const url = page.url();
    const timestamp = Date.now();

    const result = await page.evaluate((includeTypes) => {
      const data: any = {};

      // SEO 基础元数据
      if (includeTypes.includes("seo")) {
        data.seo = {
          title: document.title,
        };

        const description = document.querySelector('meta[name="description"]');
        if (description instanceof HTMLMetaElement) {
          data.seo.description = description.content;
        }

        const keywords = document.querySelector('meta[name="keywords"]');
        if (keywords instanceof HTMLMetaElement) {
          data.seo.keywords = keywords.content.split(",").map((k) => k.trim());
        }

        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical instanceof HTMLLinkElement) {
          data.seo.canonical = canonical.href;
        }

        const robots = document.querySelector('meta[name="robots"]');
        if (robots instanceof HTMLMetaElement) {
          data.seo.robots = robots.content;
        }
      }

      // Open Graph
      if (includeTypes.includes("og")) {
        data.og = {};
        const ogTags = document.querySelectorAll('meta[property^="og:"]');
        for (const tag of Array.from(ogTags)) {
          if (tag instanceof HTMLMetaElement) {
            const property = tag.getAttribute("property");
            if (property) {
              const key = property.substring(3); // 移除 "og:" 前缀
              data.og[key] = tag.content;
            }
          }
        }
      }

      // Twitter Cards
      if (includeTypes.includes("twitter")) {
        data.twitter = {};
        const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
        for (const tag of Array.from(twitterTags)) {
          if (tag instanceof HTMLMetaElement) {
            const name = tag.getAttribute("name");
            if (name) {
              const key = name.substring(8); // 移除 "twitter:" 前缀
              data.twitter[key] = tag.content;
            }
          }
        }
      }

      // Schema.org (JSON-LD)
      if (includeTypes.includes("schema")) {
        data.schema = [];
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of Array.from(scripts)) {
          try {
            const json = JSON.parse(script.textContent || "");
            data.schema.push(json);
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      // 其他元数据
      if (includeTypes.includes("other")) {
        data.other = {};

        const charset = document.characterSet;
        if (charset) {
          data.other.charset = charset;
        }

        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport instanceof HTMLMetaElement) {
          data.other.viewport = viewport.content;
        }

        const lang = document.documentElement.lang;
        if (lang) {
          data.other.lang = lang;
        }

        const author = document.querySelector('meta[name="author"]');
        if (author instanceof HTMLMetaElement) {
          data.other.author = author.content;
        }
      }

      return data;
    }, include);

    return {
      type: "metadata",
      url,
      timestamp,
      ...result,
    };
  }
}
