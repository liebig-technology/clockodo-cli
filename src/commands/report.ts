import { styleText } from "node:util";
import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import { printResult, printTable, resolveOutputMode } from "../lib/output.js";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  formatDate,
  formatDecimalHours,
  formatDuration,
  parseDateTime,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toClockodoDateTime,
} from "../lib/time.js";
import type { GlobalOptions } from "../types/index.js";

interface ReportOptions {
  group?: string;
}

async function runReport(
  program: Command,
  since: Date,
  until: Date,
  cmdOpts: ReportOptions,
): Promise<void> {
  const opts = program.opts<GlobalOptions>();
  const client = getClient();

  // Default grouping by project, allow override
  const grouping = [cmdOpts.group ?? "projects_id"];

  const result = await client.getEntryGroups({
    timeSince: toClockodoDateTime(since),
    timeUntil: toClockodoDateTime(until),
    grouping,
  });

  const groups = result.groups ?? [];
  const totalSeconds = groups.reduce((sum, g) => sum + (g.duration ?? 0), 0);

  const mode = resolveOutputMode(opts);
  if (mode !== "human") {
    printResult(
      {
        data: {
          period: { since: formatDate(since), until: formatDate(until) },
          groups,
          total: { seconds: totalSeconds, formatted: formatDuration(totalSeconds) },
        },
      },
      opts,
    );
    return;
  }

  console.log();
  console.log(`  ${styleText("bold", "Report")}: ${formatDate(since)} — ${formatDate(until)}`);
  console.log();

  if (groups.length === 0) {
    console.log(styleText("dim", "  No entries found for this period."));
    return;
  }

  const rows = groups.map((g) => [
    g.name || g.group || "Unknown",
    formatDuration(g.duration ?? 0),
    formatDecimalHours(g.duration ?? 0),
  ]);

  printTable(["Name", "Duration", "Hours"], rows, opts);

  console.log();
  console.log(
    `  ${styleText("bold", "Total")}: ${formatDuration(totalSeconds)} (${formatDecimalHours(totalSeconds)})`,
  );
  console.log();
}

export function registerReportCommands(program: Command): void {
  const report = program.command("report").description("Aggregated time reports");

  report
    .command("today", { isDefault: true })
    .description("Today's summary")
    .option(
      "-g, --group <field>",
      "Group by: projects_id, customers_id, services_id",
      "projects_id",
    )
    .action(async (cmdOpts) => {
      const now = new Date();
      await runReport(program, startOfDay(now), endOfDay(now), cmdOpts);
    });

  report
    .command("week")
    .description("This week's summary (Mon-Sun)")
    .option("-g, --group <field>", "Group by field", "projects_id")
    .action(async (cmdOpts) => {
      const now = new Date();
      await runReport(program, startOfWeek(now), endOfWeek(now), cmdOpts);
    });

  report
    .command("month")
    .description("This month's summary")
    .option("-g, --group <field>", "Group by field", "projects_id")
    .action(async (cmdOpts) => {
      const now = new Date();
      await runReport(program, startOfMonth(now), endOfMonth(now), cmdOpts);
    });

  report
    .command("custom")
    .description("Custom date range report")
    .requiredOption("--since <date>", "Start date")
    .requiredOption("--until <date>", "End date")
    .option("-g, --group <field>", "Group by field", "projects_id")
    .action(async (cmdOpts) => {
      const since = new Date(parseDateTime(cmdOpts.since));
      const until = new Date(parseDateTime(cmdOpts.until));
      await runReport(program, since, until, cmdOpts);
    });
}
