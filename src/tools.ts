import { tool } from "ai";
import { Page } from "playwright";
import { z } from "zod";

export function createTools(page: Page) {
  return {
    /**
     * Screenshot tool - allows the agent to see the current page state
     */
    screenshot: tool({
      description:
        "Take a screenshot of the current page to visually see what's on screen. Use this to understand page layout, verify actions, and check for errors.",
      parameters: z.object({}),
      execute: async () => {
        await page.waitForTimeout(300);
        const screenshot = await page.screenshot({ type: "jpeg", quality: 70 });
        return screenshot.toString("base64");
      },
      experimental_toToolResultContent(result) {
        return [
          {
            type: "image" as const,
            data: result,
            mimeType: "image/jpeg" as const,
          },
        ];
      },
    }),

    /**
     * Page info tool - get structured info about all interactive elements
     */
    get_page_info: tool({
      description:
        "Get structured information about all interactive elements on the page, including form fields, buttons, dropdowns, their CSS selectors, labels, and current values. Use this to identify elements before interacting with them.",
      parameters: z.object({}),
      execute: async () => {
        const info = await page.evaluate(() => {
          const elements: any[] = [];

          document
            .querySelectorAll(
              'input, select, textarea, button, [role="button"], [role="tab"], [role="combobox"], details > summary, [class*="accordion"], [class*="section-header"], [class*="collapsible"]'
            )
            .forEach((el: any, index: number) => {
              const rect = el.getBoundingClientRect();
              const isInViewport =
                rect.width > 0 &&
                rect.height > 0 &&
                rect.top < window.innerHeight &&
                rect.bottom > 0;

              let selector = "";
              if (el.id) selector = `#${el.id}`;
              else if (el.name) selector = `[name="${el.name}"]`;
              else if (el.type === "submit")
                selector = 'button[type="submit"], input[type="submit"]';

              const elementInfo: any = {
                index,
                tag: el.tagName.toLowerCase(),
                type: el.type || "",
                id: el.id || "",
                name: el.name || "",
                placeholder: el.placeholder || "",
                value: el.value || "",
                selector,
                label: "",
                text: el.textContent?.trim()?.substring(0, 150) || "",
                isInViewport,
                disabled: el.disabled || false,
              };

              if (el.id) {
                const label = document.querySelector(
                  `label[for="${el.id}"]`
                );
                if (label)
                  elementInfo.label = label.textContent?.trim() || "";
              }
              if (!elementInfo.label && el.labels?.length > 0) {
                elementInfo.label = el.labels[0].textContent?.trim() || "";
              }

              if (el.tagName === "SELECT") {
                elementInfo.options = Array.from(el.options).map(
                  (o: any) => ({
                    value: o.value,
                    text: o.text,
                    selected: o.selected,
                  })
                );
              }

              elements.push(elementInfo);
            });

          const headings = Array.from(
            document.querySelectorAll("h1, h2, h3, h4, h5, h6, legend")
          ).map((h) => ({
            tag: h.tagName.toLowerCase(),
            text: h.textContent?.trim(),
            id: (h as HTMLElement).id || "",
          }));

          const errors = Array.from(
            document.querySelectorAll(
              '.error, .invalid, [class*="error"], [class*="invalid"], [role="alert"]'
            )
          )
            .filter((el) => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            })
            .map((el) => el.textContent?.trim())
            .filter(Boolean);

          return {
            title: document.title,
            url: window.location.href,
            scrollPosition: {
              top: window.scrollY,
              totalHeight: document.documentElement.scrollHeight,
              viewportHeight: window.innerHeight,
            },
            headings,
            elements,
            errors,
          };
        });

        return JSON.stringify(info, null, 2);
      },
    }),

    /**
     * Fill field tool - clear and fill with the specified value
     */
    fill_field: tool({
      description:
        "Clear and fill a form input field with a value using its CSS selector.",
      parameters: z.object({
        selector: z
          .string()
          .describe(
            'CSS selector for the input field (e.g., \'#firstName\', \'[name="email"]\')'
          ),
        value: z.string().describe("The value to fill in"),
      }),
      execute: async ({ selector, value }) => {
        try {
          await page.locator(selector).scrollIntoViewIfNeeded();
          await page.locator(selector).click();
          await page.locator(selector).fill(value);
          return {
            success: true,
            message: `Filled "${selector}" with "${value}"`,
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to fill "${selector}": ${error.message}`,
          };
        }
      },
    }),

    /**
     * Click element tool - click via CSS selector
     */
    click_element: tool({
      description: "Click on an element using its CSS selector.",
      parameters: z.object({
        selector: z
          .string()
          .describe("CSS selector for the element to click"),
      }),
      execute: async ({ selector }) => {
        try {
          await page.locator(selector).scrollIntoViewIfNeeded();
          await page.locator(selector).click({ timeout: 5000 });
          return { success: true, message: `Clicked "${selector}"` };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to click "${selector}": ${error.message}`,
          };
        }
      },
    }),

    /**
     * Click by text - click an element by its visible text content
     */
    click_by_text: tool({
      description:
        "Click on an element by its visible text content. Useful when you don't have a reliable CSS selector.",
      parameters: z.object({
        text: z
          .string()
          .describe("The visible text of the element to click"),
        exact: z
          .boolean()
          .optional()
          .describe("Whether to match text exactly (default: false)"),
      }),
      execute: async ({ text, exact = false }) => {
        try {
          await page
            .getByText(text, { exact })
            .first()
            .scrollIntoViewIfNeeded();
          await page
            .getByText(text, { exact })
            .first()
            .click({ timeout: 5000 });
          return {
            success: true,
            message: `Clicked element with text "${text}"`,
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to click text "${text}": ${error.message}`,
          };
        }
      },
    }),

    /**
     * Select option tool - select from a dropdown
     */
    select_option: tool({
      description:
        "Select an option from a dropdown/select element by its value or visible text.",
      parameters: z.object({
        selector: z
          .string()
          .describe("CSS selector for the select element"),
        value: z
          .string()
          .describe(
            "The value attribute or visible text of the option to select"
          ),
      }),
      execute: async ({ selector, value }) => {
        try {
          await page.locator(selector).scrollIntoViewIfNeeded();
          try {
            await page.selectOption(selector, { value });
          } catch {
            await page.selectOption(selector, { label: value });
          }
          return {
            success: true,
            message: `Selected "${value}" in "${selector}"`,
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to select option in "${selector}": ${error.message}`,
          };
        }
      },
    }),

    /**
     * Scroll page tool - scroll the page up or down
     */
    scroll_page: tool({
      description: "Scroll the page up or down by a specified amount.",
      parameters: z.object({
        direction: z.enum(["up", "down"]).describe("Direction to scroll"),
        pixels: z
          .number()
          .optional()
          .describe("Pixels to scroll (default: 500)"),
      }),
      execute: async ({ direction, pixels = 500 }) => {
        const amount = direction === "down" ? pixels : -pixels;
        await page.evaluate((y) => window.scrollBy(0, y), amount);
        await page.waitForTimeout(300);
        const scrollInfo = await page.evaluate(() => ({
          scrollTop: Math.round(window.scrollY),
          scrollHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
        }));
        return {
          success: true,
          message: `Scrolled ${direction} by ${pixels}px. Position: ${scrollInfo.scrollTop}/${scrollInfo.scrollHeight - scrollInfo.viewportHeight}`,
        };
      },
    }),

    /**
     * Scroll to element tool - scroll a specific element into view
     */
    scroll_to_element: tool({
      description: "Scroll to make a specific element visible on the page.",
      parameters: z.object({
        selector: z
          .string()
          .describe("CSS selector of the element to scroll to"),
      }),
      execute: async ({ selector }) => {
        try {
          await page.locator(selector).scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
          return { success: true, message: `Scrolled to "${selector}"` };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to scroll to "${selector}": ${error.message}`,
          };
        }
      },
    }),

    /**
     * Type text tool - simulate character-by-character keyboard input
     */
    type_text: tool({
      description:
        "Type text character by character into an element. Use this when fill_field doesn't work (e.g., for date pickers, custom inputs).",
      parameters: z.object({
        selector: z.string().describe("CSS selector for the element"),
        text: z.string().describe("Text to type"),
        clearFirst: z
          .boolean()
          .optional()
          .describe("Whether to clear the field first (default: true)"),
      }),
      execute: async ({ selector, text, clearFirst = true }) => {
        try {
          await page.locator(selector).scrollIntoViewIfNeeded();
          await page.locator(selector).click();
          if (clearFirst) {
            await page.locator(selector).fill("");
          }
          await page.locator(selector).pressSequentially(text, { delay: 50 });
          return {
            success: true,
            message: `Typed "${text}" into "${selector}"`,
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to type into "${selector}": ${error.message}`,
          };
        }
      },
    }),

    /**
     * Press key tool - press a single keyboard key
     */
    press_key: tool({
      description:
        "Press a keyboard key (e.g., 'Enter', 'Tab', 'Escape', 'ArrowDown').",
      parameters: z.object({
        key: z.string().describe("Key to press"),
      }),
      execute: async ({ key }) => {
        try {
          await page.keyboard.press(key);
          return { success: true, message: `Pressed "${key}"` };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to press "${key}": ${error.message}`,
          };
        }
      },
    }),

    /**
     * Wait tool - pause execution for a given duration
     */
    wait: tool({
      description:
        "Wait for a specified duration. Useful after actions that trigger page changes or animations.",
      parameters: z.object({
        ms: z
          .number()
          .describe("Milliseconds to wait (between 100 and 10000)"),
      }),
      execute: async ({ ms }) => {
        const duration = Math.max(100, Math.min(ms, 10000));
        await page.waitForTimeout(duration);
        return { success: true, message: `Waited ${duration}ms` };
      },
    }),

    /**
     * Done tool - no execute function; calling this stops the agent loop
     */
    done: tool({
      description:
        'Call this tool ALONE (not combined with other tools) when the entire workflow is complete. Provide a detailed summary of everything accomplished.',
      parameters: z.object({
        summary: z
          .string()
          .describe(
            "Detailed summary of all actions taken and the final result"
          ),
        success: z
          .boolean()
          .describe("Whether the workflow completed successfully"),
      }),
    }),
  };
}
