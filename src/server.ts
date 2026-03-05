import "dotenv-defaults/config";
import express from "express";
import { main, WorkflowVariables } from "./main";

const app = express();
app.use(express.json());

/**
 * POST /api/run - Run the form filling workflow
 *
 * Optional body: any subset of WorkflowVariables (firstName, lastName, dateOfBirth,
 * id, passportNumber, email, phone, address, city, state, zip, country,
 * occupation, income, education, maritalStatus, children, pets).
 * Omitted fields use defaults from main.ts.
 */
app.post("/api/run", async (req, res) => {
  try {
    console.log("📡 Received API request to run workflow");
    const variables: Partial<WorkflowVariables> = req.body || {};
    const result = await main(variables);
    res.json(result);
  } catch (error: any) {
    console.error("API error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/health - Health check
 */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export function startServer(port = 3000) {
  app.listen(port, () => {
    console.log(`\n Form Automation Agent API Server`);
    console.log(`   http://localhost:${port}`);
    console.log(`\n Endpoints:`);
    console.log(
      `   POST /api/run     - Run the workflow (optional body: WorkflowVariables)`
    );
    console.log(`   GET  /api/health  - Health check\n`);
  });
}

if (require.main === module) {
  startServer();
}
