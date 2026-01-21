import type { Page } from "patchright";

export interface FormData {
  type: "form";
  url: string;
  selector: string;
  timestamp: number;
  fields: FormField[];
}

export interface FormField {
  ref?: string;
  name: string;
  type: string;
  value?: string;
  checked?: boolean;
  label?: string;
  placeholder?: string;
  required: boolean;
  disabled: boolean;
  readonly?: boolean;
  options?: string[];
  selectedOptions?: string[];
}

export class FormExtractor {
  /**
   * 提取表单数据
   */
  async extract(
    page: Page,
    selector?: string,
    options: { includeDisabled?: boolean } = {},
  ): Promise<FormData> {
    const includeDisabled = options.includeDisabled ?? false;

    const url = page.url();
    const timestamp = Date.now();

    const result = await page.evaluate(
      ({ selector, includeDisabled }) => {
        let container: Element | null = null;

        if (selector) {
          container = document.querySelector(selector);
        } else {
          container = document.querySelector("form") || document.body;
        }

        if (!container) {
          throw new Error("No form container found");
        }

        const fields: FormField[] = [];

        // 查找所有表单控件
        const inputs = container.querySelectorAll("input, textarea, select");

        for (const input of Array.from(inputs)) {
          if (
            !(
              input instanceof HTMLInputElement ||
              input instanceof HTMLTextAreaElement ||
              input instanceof HTMLSelectElement
            )
          ) {
            continue;
          }

          // 跳过禁用字段（如果不包含）
          if (!includeDisabled && input.disabled) {
            continue;
          }

          const field: FormField = {
            name: input.name || input.id || "",
            type:
              input instanceof HTMLSelectElement
                ? "select"
                : (input as HTMLInputElement).type || "text",
            required: input.required,
            disabled: input.disabled,
          };

          // 提取 placeholder
          if ("placeholder" in input && input.placeholder) {
            field.placeholder = input.placeholder;
          }

          // 提取 readonly
          if ("readOnly" in input) {
            field.readonly = input.readOnly;
          }

          // 提取值
          if (input instanceof HTMLInputElement) {
            if (input.type === "checkbox" || input.type === "radio") {
              field.checked = input.checked;
              field.value = input.value;
            } else if (input.type !== "password") {
              // 不提取密码值
              field.value = input.value;
            } else {
              field.value = input.value ? "******" : "";
            }
          } else if (input instanceof HTMLTextAreaElement) {
            field.value = input.value;
          } else if (input instanceof HTMLSelectElement) {
            const selectedOptions = Array.from(input.selectedOptions).map((opt) => opt.value);
            field.selectedOptions = selectedOptions;
            field.options = Array.from(input.options).map((opt) => opt.value);
          }

          // 查找关联的 label
          let label: HTMLLabelElement | null = null;

          if (input.id) {
            label = document.querySelector(`label[for="${input.id}"]`);
          }

          if (!label) {
            // 查找父级 label
            let parent = input.parentElement;
            while (parent) {
              if (parent instanceof HTMLLabelElement) {
                label = parent;
                break;
              }
              parent = parent.parentElement;
            }
          }

          if (label) {
            field.label = label.textContent?.trim();
          }

          fields.push(field);
        }

        return { fields };
      },
      { selector: selector || "", includeDisabled },
    );

    return {
      type: "form",
      url,
      selector: selector || "form",
      timestamp,
      fields: result.fields,
    };
  }
}
