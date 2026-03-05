import "dotenv-defaults/config";
import { generateText } from "ai";
import { model } from "./_internal/setup";
import { createSession } from "./session";
import { createTools } from "./tools";

/** Set TARGET_URL in .env to the form page you want the agent to automate (e.g. your own form URL). */
const TARGET_URL =
  process.env.TARGET_URL || "https://example.com";

/**
 * Workflow variables — form data passed to the agent (e.g. name, DOB, ID).
 * Override via main({ firstName, lastName, ... }) or your API.
 */
export interface WorkflowVariables {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  id: string;
  passportNumber: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  occupation: string;
  income: string;
  education: string;
  maritalStatus: string;
  children: string;
  pets: string;
}

const DEFAULT_VARIABLES: WorkflowVariables = {
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: "1990-01-01",
  id: "12345678",
  passportNumber: "1234567890",
  email: "john.doe@example.com",
  phone: "1234567890",
  address: "123 Main St",
  city: "Anytown",
  state: "CA",
  zip: "12345",
  country: "USA",
  occupation: "Software Engineer",
  income: "100000",
  education: "Bachelor's Degree",
  maritalStatus: "Single",
  children: "0",
  pets: "0",
};

export async function main(variables?: Partial<WorkflowVariables>) {
  const vars: WorkflowVariables = { ...DEFAULT_VARIABLES, ...variables };

  console.log("\n Starting form automation...");
  console.log(` Form data: ${vars.firstName} ${vars.lastName}`);
  console.log(
    `DOB: ${vars.dateOfBirth} | ID: ${vars.id}\n`
  );

  const page = await createSession(TARGET_URL);
  const tools = createTools(page);

  await page.waitForLoadState("networkidle");

  const systemPrompt = `You are an AI agent that fills out web forms autonomously using Playwright-based browser tools. The form can be any kind (signup, survey, application, etc.).

## Your Workflow:
1. Call get_page_info to understand the page layout and all available form fields
2. Fill in ALL visible form fields in one step by batching multiple fill_field / select_option calls together
3. After completing visible fields, scroll down to discover additional sections
4. If a section is collapsed, click to expand it, then call get_page_info ONCE and immediately fill ALL fields in the next step
5. After ALL sections are filled, click the submit button (Submit / Send / Next / etc.)
6. Call "done" ALONE with a summary

## Critical Efficiency Rules:
- ALWAYS batch multiple actions (fill_field, select_option) in a SINGLE step — do NOT fill one field per step
- NEVER call get_page_info twice in a row — after getting info, immediately take action in the SAME step or the NEXT step
- Only use screenshot when you need visual verification (e.g. after submit), not for routine observation
- Use CSS selectors from get_page_info for reliable element targeting
- If fill_field fails, try type_text as fallback
- For fields that have no provided value, pick reasonable defaults from the available options
- When calling "done", it must be the ONLY tool call in that step`;

  const userPrompt = `Please fill out the form with the following data. Use each value where it matches a form field (labels may vary: name, DOB, ID, email, address, etc.).

- First Name: ${vars.firstName}
- Last Name: ${vars.lastName}
- Date of Birth: ${vars.dateOfBirth}
- ID: ${vars.id}
- Passport Number: ${vars.passportNumber}
- Email: ${vars.email}
- Phone: ${vars.phone}
- Address: ${vars.address}
- City: ${vars.city}
- State: ${vars.state}
- Zip: ${vars.zip}
- Country: ${vars.country}
- Occupation: ${vars.occupation}
- Income: ${vars.income}
- Education: ${vars.education}
- Marital Status: ${vars.maritalStatus}
- Children: ${vars.children}
- Pets: ${vars.pets}

Complete ALL sections of the form — not just the first. Look for additional sections by scrolling down.
For any fields that don't have a value above, choose appropriate default values from the available options.
After filling everything, submit the form and verify it was submitted successfully.`;

  let stepCount = 0;

  try {
    const result = await generateText({
      model,
      tools,
      toolChoice: "required", 
      maxSteps: 50,
      system: systemPrompt,
      prompt: userPrompt,
      onStepFinish: ({ text, toolCalls, finishReason }) => {
        stepCount++;
        const toolNames =
          toolCalls?.map((tc: any) => tc.toolName).join(", ") ||
          "text-response";
        console.log(
          `Step ${stepCount} | Tools: [${toolNames}] | Reason: ${finishReason}`
        );
        if (text) {
          console.log(`\n${text.substring(0, 150)}`);
        }
      },
    });

    const doneCall = result.toolCalls?.find(
      (tc: any) => tc.toolName === "done"
    );
    const summary = doneCall
      ? (doneCall.args as any).summary
      : result.text || "Workflow completed";
    const success = doneCall ? (doneCall.args as any).success : true;

    console.log("\n" + "═".repeat(60));
    console.log(
      success
        ? "Workflow completed successfully!"
        : "Workflow completed with issues"
    );
    console.log("Summary:", summary);
    console.log(`Total steps: ${stepCount}`);
    console.log("═".repeat(60) + "\n");

    await page.context().browser()?.close();

    return { success, summary, steps: stepCount };
  } catch (error: any) {
    console.error("\n Workflow failed:", error.message);

    try {
      await page.context().browser()?.close();
    } catch {
      console.error("Browser already closed");
    }

    return { success: false, error: error.message, steps: stepCount };
  }
}
