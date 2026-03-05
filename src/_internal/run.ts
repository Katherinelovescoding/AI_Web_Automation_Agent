import "dotenv-defaults/config";
import { main } from "../main";

const args = process.argv.slice(2);

if (args.includes("--schedule")) {
  /**
   * Scheduled mode (Bonus #4) - automatically run every 5 minutes
   * Usage: npm run schedule [-- --runs=N]  (default: 20 runs)
   */
  const INTERVAL_MS = 5 * 60 * 1000;
  const DEFAULT_MAX_RUNS = 20;

  const runsArg = args.find((a) => a.startsWith("--runs="));
  const maxRuns = runsArg ? parseInt(runsArg.split("=")[1], 10) : DEFAULT_MAX_RUNS;

  console.log(`Scheduled mode - running every 5 minutes (max ${maxRuns} runs)\n`);

  let runCount = 0;

  const runScheduled = async () => {
    runCount++;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Starting run ${runCount}/${maxRuns}...`);
    try {
      const result = await main();
      console.log(
        `[${timestamp}] Result:`,
        result.success ? "Success" : "Failed"
      );
    } catch (error: any) {
      console.error(`[${timestamp}] Error:`, error.message);
    }

    if (runCount >= maxRuns) {
      console.log(`\nReached max runs (${maxRuns}). Stopping scheduler.`);
      process.exit(0);
    }
    console.log(`Next run in 5 minutes... (${maxRuns - runCount} remaining)\n`);
  };

  runScheduled();
  setInterval(runScheduled, INTERVAL_MS);
} else if (args.includes("--server")) {
  /**
   * API server mode (Bonus #2)
   */
  import("../server").then(({ startServer }) => startServer());
} else {
  /**
   * Default mode - run once
   */
  (async () => {
    const result = await main();
    console.log("\nFinal result:", JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })();
}
