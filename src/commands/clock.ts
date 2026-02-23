import { Billability, getEntryDurationUntilNow } from "clockodo";
import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import { getConfigValue } from "../lib/config.js";
import { CliError, ExitCode } from "../lib/errors.js";
import { printResult, printSuccess, resolveOutputMode } from "../lib/output.js";
import { selectCustomerProjectService, shouldPrompt } from "../lib/prompts.js";
import { elapsedSince, formatDuration, formatTime } from "../lib/time.js";
import { parseIntStrict } from "../lib/validate.js";
import type { GlobalOptions } from "../types/index.js";

export function registerClockCommands(program: Command): void {
  // Desire path: `clockodo start`
  program
    .command("start")
    .description("Start time tracking")
    .option("-c, --customer <id>", "Customer ID", parseIntStrict)
    .option("-p, --project <id>", "Project ID", parseIntStrict)
    .option("-s, --service <id>", "Service ID", parseIntStrict)
    .option("-t, --text <description>", "Entry description")
    .option("-b, --billable", "Mark as billable")
    .option("--no-billable", "Mark as not billable")
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const mode = resolveOutputMode(opts);
      const client = getClient();

      let customersId: number | undefined = cmdOpts.customer ?? getConfigValue("defaultCustomerId");
      let servicesId: number | undefined = cmdOpts.service ?? getConfigValue("defaultServiceId");
      let projectsId: number | undefined = cmdOpts.project ?? getConfigValue("defaultProjectId");

      if ((!customersId || !servicesId) && shouldPrompt(opts, mode)) {
        const selection = await selectCustomerProjectService();
        if (!selection) return;
        customersId ??= selection.customersId;
        servicesId ??= selection.servicesId;
        projectsId ??= selection.projectsId;
      }

      if (!customersId || !servicesId) {
        throw new CliError(
          "Customer ID and Service ID are required to start tracking.",
          ExitCode.INVALID_ARGS,
          "Use --customer and --service flags, or set defaults with: clockodo config set",
        );
      }

      const result = await client.startClock({
        customersId,
        servicesId,
        ...(cmdOpts.billable !== undefined && {
          billable: cmdOpts.billable ? Billability.Billable : Billability.NotBillable,
        }),
        ...(projectsId && { projectsId }),
        ...(cmdOpts.text && { text: cmdOpts.text }),
      });

      if (mode !== "human") {
        printResult({ data: result.running }, opts);
        return;
      }

      printSuccess("Clock started");
      if (result.running.text) {
        console.log(`  Description: ${result.running.text}`);
      }
      console.log(`  Started at: ${formatTime(result.running.timeSince)}`);
    });

  // Desire path: `clockodo stop`
  program
    .command("stop")
    .description("Stop time tracking")
    .action(async () => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const clock = await client.getClock();
      if (!clock.running) {
        throw new CliError("No clock is currently running.", ExitCode.EMPTY_RESULTS);
      }

      const result = await client.stopClock({ entriesId: clock.running.id });

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.stopped }, opts);
        return;
      }

      const duration = result.stopped.duration ?? elapsedSince(result.stopped.timeSince);
      printSuccess(`Clock stopped (${formatDuration(duration)})`);
      if (result.stopped.text) {
        console.log(`  Description: ${result.stopped.text}`);
      }
    });

  // Desire path: `clockodo edit`
  program
    .command("edit")
    .description("Edit the running clock entry")
    .option("-c, --customer <id>", "Customer ID", parseIntStrict)
    .option("-p, --project <id>", "Project ID", parseIntStrict)
    .option("-s, --service <id>", "Service ID", parseIntStrict)
    .option("-t, --text <description>", "Entry description")
    .option("-b, --billable", "Mark as billable")
    .option("--no-billable", "Mark as not billable")
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const clock = await client.getClock();
      if (!clock.running) {
        throw new CliError("No clock is currently running.", ExitCode.EMPTY_RESULTS);
      }

      const updates: Record<string, unknown> = { id: clock.running.id };
      if (cmdOpts.customer !== undefined) updates.customersId = cmdOpts.customer;
      if (cmdOpts.project !== undefined) updates.projectsId = cmdOpts.project;
      if (cmdOpts.service !== undefined) updates.servicesId = cmdOpts.service;
      if (cmdOpts.text !== undefined) updates.text = cmdOpts.text;
      if (cmdOpts.billable !== undefined)
        updates.billable = cmdOpts.billable ? Billability.Billable : Billability.NotBillable;

      // Only the id key means no actual updates were provided
      if (Object.keys(updates).length === 1) {
        throw new CliError(
          "No update flags provided.",
          ExitCode.INVALID_ARGS,
          "Use --text, --customer, --project, --service, --billable, or --no-billable",
        );
      }

      const result = await client.editEntry(updates as Parameters<typeof client.editEntry>[0]);

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.entry }, opts);
        return;
      }

      printSuccess("Running entry updated");
    });

  // Desire path: `clockodo extend`
  program
    .command("extend")
    .description("Extend the running clock by N minutes")
    .argument("<minutes>", "Minutes to extend by", parseIntStrict)
    .action(async (minutes: number) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const clock = await client.getClock();
      if (!clock.running) {
        throw new CliError("No clock is currently running.", ExitCode.EMPTY_RESULTS);
      }

      const durationBefore = getEntryDurationUntilNow(clock.running);
      const duration = durationBefore + minutes * 60;

      const result = await client.changeClockDuration({
        entriesId: clock.running.id,
        durationBefore,
        duration,
      });

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.updated }, opts);
        return;
      }

      printSuccess(`Clock extended by ${minutes} minutes`);
      console.log(`  New duration: ${formatDuration(duration)}`);
    });
}
