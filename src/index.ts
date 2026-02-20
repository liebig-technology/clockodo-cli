import { Command, CommanderError } from "commander";
import { registerAbsencesCommands } from "./commands/absences.js";
import { registerClockCommands } from "./commands/clock.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerCustomersCommands } from "./commands/customers.js";
import { registerEntriesCommands } from "./commands/entries.js";
import { registerProjectsCommands } from "./commands/projects.js";
import { registerReportCommands } from "./commands/report.js";
import { registerSchemaCommand } from "./commands/schema.js";
import { registerServicesCommands } from "./commands/services.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerUserReportCommands } from "./commands/userreports.js";
import { registerUsersCommands } from "./commands/users.js";
import { registerWorktimesCommands } from "./commands/worktimes.js";
import { handleError } from "./lib/errors.js";
import type { GlobalOptions } from "./types/index.js";

const program = new Command();

program
  .name("clockodo")
  .description("AI-friendly CLI for the Clockodo time tracking API")
  .version("0.1.0")
  .option("-j, --json", "Output as JSON")
  .option("-p, --plain", "Output as plain text (no colors)")
  .option("--no-color", "Disable colors")
  .option("--no-input", "Disable interactive prompts")
  .option("-v, --verbose", "Verbose output");

// Register all command groups
registerConfigCommands(program);
registerStatusCommand(program);
registerClockCommands(program);
registerEntriesCommands(program);
registerCustomersCommands(program);
registerProjectsCommands(program);
registerServicesCommands(program);
registerUsersCommands(program);
registerReportCommands(program);
registerAbsencesCommands(program);
registerWorktimesCommands(program);
registerUserReportCommands(program);
registerSchemaCommand(program);

// Global error handling
program.exitOverride();

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    // Commander throws on --help and --version; exit cleanly
    if (error instanceof CommanderError) {
      process.exit(error.exitCode);
    }
    const opts = program.opts<GlobalOptions>();
    handleError(error, opts);
  }
}

main();
