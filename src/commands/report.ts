import { styleText } from "node:util";
import { getEntryDurationUntilNow } from "clockodo";
import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import { CliError, ExitCode } from "../lib/errors.js";
import { printResult, printTable, resolveOutputMode } from "../lib/output.js";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  formatDate,
  formatDecimalHours,
  formatDuration,
  formatTime,
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

const GROUP_ALIASES: Record<string, string> = {
  customer: "customers_id",
  customers: "customers_id",
  customers_id: "customers_id",
  project: "projects_id",
  projects: "projects_id",
  projects_id: "projects_id",
  service: "services_id",
  services: "services_id",
  services_id: "services_id",
  text: "text",
  description: "text",
};

function resolveReportGroupKey(input: string): string {
  const resolved = GROUP_ALIASES[input.toLowerCase()];
  if (!resolved) {
    throw new CliError(
      `Unknown group field: "${input}". Valid options: customer, project, service, text`,
      ExitCode.INVALID_ARGS,
    );
  }
  return resolved;
}

interface TextGroup {
  key: string;
  count: number;
  seconds: number;
  timeRanges: Array<{ since: string; until: string }>;
}

function groupEntriesByText(
  entries: Array<{
    timeSince: string;
    timeUntil?: string | null;
    duration?: number | null;
    text?: string | null;
    type?: number;
  }>,
): TextGroup[] {
  const map = new Map<string, TextGroup>();
  const now = new Date().toISOString();

  for (const e of entries) {
    const groupKey = e.text || "(no description)";
    const duration = getEntryDurationUntilNow(e as Parameters<typeof getEntryDurationUntilNow>[0]);

    const existing = map.get(groupKey);
    const timeRange = { since: e.timeSince, until: e.timeUntil ?? now };
    if (existing) {
      existing.count++;
      existing.seconds += duration;
      existing.timeRanges.push(timeRange);
    } else {
      map.set(groupKey, {
        key: groupKey,
        count: 1,
        seconds: duration,
        timeRanges: [timeRange],
      });
    }
  }

  return [...map.values()].sort((a, b) => b.seconds - a.seconds);
}

async function runTextReport(program: Command, since: Date, until: Date): Promise<void> {
  const opts = program.opts<GlobalOptions>();
  const client = getClient();

  const result = await client.getEntries({
    timeSince: toClockodoDateTime(since),
    timeUntil: toClockodoDateTime(until),
  });

  const entryList = result.entries ?? [];
  const groups = groupEntriesByText(entryList);
  const totalSeconds = groups.reduce((sum, g) => sum + g.seconds, 0);

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

  printReportHeader(since, until);

  if (groups.length === 0) {
    console.log(styleText("dim", "  No entries found for this period."));
    return;
  }

  const rows = groups.map((g) => {
    const ranges = g.timeRanges
      .map((r) => `${formatTime(r.since)}\u2013${formatTime(r.until)}`)
      .join(", ");
    return [g.key, formatDuration(g.seconds), formatDecimalHours(g.seconds), ranges];
  });

  printTable(["Description", "Duration", "Hours", "Time Ranges"], rows, opts);
  printReportTotal(totalSeconds);
}

function printReportHeader(since: Date, until: Date): void {
  console.log();
  console.log(`  ${styleText("bold", "Report")}: ${formatDate(since)} — ${formatDate(until)}`);
  console.log();
}

function printReportTotal(totalSeconds: number): void {
  console.log();
  console.log(
    `  ${styleText("bold", "Total")}: ${formatDuration(totalSeconds)} (${formatDecimalHours(totalSeconds)})`,
  );
  console.log();
}

async function runReport(
  program: Command,
  since: Date,
  until: Date,
  cmdOpts: ReportOptions,
): Promise<void> {
  const groupField = resolveReportGroupKey(cmdOpts.group ?? "projects_id");

  if (groupField === "text") {
    return runTextReport(program, since, until);
  }

  const opts = program.opts<GlobalOptions>();
  const client = getClient();

  const result = await client.getEntryGroups({
    timeSince: toClockodoDateTime(since),
    timeUntil: toClockodoDateTime(until),
    grouping: [groupField],
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

  printReportHeader(since, until);

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
  printReportTotal(totalSeconds);
}

export function registerReportCommands(program: Command): void {
  const report = program.command("report").description("Aggregated time reports");

  report
    .command("today", { isDefault: true })
    .description("Today's summary")
    .option("-g, --group <field>", "Group by: customer, project, service, text", "projects_id")
    .action(async (cmdOpts) => {
      const now = new Date();
      await runReport(program, startOfDay(now), endOfDay(now), cmdOpts);
    });

  report
    .command("week")
    .description("This week's summary (Mon-Sun)")
    .option("-g, --group <field>", "Group by: customer, project, service, text", "projects_id")
    .action(async (cmdOpts) => {
      const now = new Date();
      await runReport(program, startOfWeek(now), endOfWeek(now), cmdOpts);
    });

  report
    .command("month")
    .description("This month's summary")
    .option("-g, --group <field>", "Group by: customer, project, service, text", "projects_id")
    .action(async (cmdOpts) => {
      const now = new Date();
      await runReport(program, startOfMonth(now), endOfMonth(now), cmdOpts);
    });

  report
    .command("custom")
    .description("Custom date range report")
    .requiredOption("--since <date>", "Start date")
    .requiredOption("--until <date>", "End date")
    .option("-g, --group <field>", "Group by: customer, project, service, text", "projects_id")
    .action(async (cmdOpts) => {
      const since = new Date(parseDateTime(cmdOpts.since));
      const until = new Date(parseDateTime(cmdOpts.until));
      await runReport(program, since, until, cmdOpts);
    });
}
