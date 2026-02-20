import { styleText } from "node:util";
import * as p from "@clack/prompts";
import { getEntryDurationUntilNow, isTimeEntry } from "clockodo";
import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import { getConfigValue } from "../lib/config.js";
import { CliError, ExitCode } from "../lib/errors.js";
import {
  printDetail,
  printResult,
  printSuccess,
  printTable,
  resolveOutputMode,
} from "../lib/output.js";
import { selectCustomerProjectService, shouldPrompt } from "../lib/prompts.js";
import {
  endOfDay,
  formatDate,
  formatDecimalHours,
  formatDuration,
  formatTime,
  parseDateTime,
  toClockodoDateTime,
} from "../lib/time.js";
import { parseId, parseIntStrict } from "../lib/validate.js";
import type { GlobalOptions } from "../types/index.js";

export function registerEntriesCommands(program: Command): void {
  const entries = program.command("entries").description("Manage time entries");

  // List entries (also the desire path: `clockodo entries` defaults to list)
  entries
    .command("list", { isDefault: true })
    .description("List time entries")
    .option("--since <date>", "Start date (default: today)", "today")
    .option("--until <date>", "End date (default: today)")
    .option("--customer <id>", "Filter by customer ID", parseIntStrict)
    .option("--project <id>", "Filter by project ID", parseIntStrict)
    .option("--service <id>", "Filter by service ID", parseIntStrict)
    .option("--text <search>", "Filter by description text")
    .option(
      "-g, --group <field>",
      "Group by: customer, project, service, text (shows summary table instead)",
    )
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const since = parseDateTime(cmdOpts.since);
      const until = cmdOpts.until
        ? parseDateTime(cmdOpts.until)
        : toClockodoDateTime(endOfDay(new Date()));

      const filter: Record<string, unknown> = {};
      if (cmdOpts.customer) filter.customersId = cmdOpts.customer;
      if (cmdOpts.project) filter.projectsId = cmdOpts.project;
      if (cmdOpts.service) filter.servicesId = cmdOpts.service;
      if (cmdOpts.text) filter.text = cmdOpts.text;

      const result = await client.getEntries({
        timeSince: since,
        timeUntil: until,
        ...(Object.keys(filter).length > 0 && { filter }),
      });

      const entryList = result.entries ?? [];

      const mode = resolveOutputMode(opts);

      if (entryList.length === 0) {
        if (mode !== "human") {
          printResult({ data: [], meta: { count: 0, totalSeconds: 0 } }, opts);
        } else {
          console.log(styleText("dim", "  No entries found for the given period."));
        }
        return;
      }

      const totalSeconds = entryList.reduce((sum, e) => sum + getEntryDurationUntilNow(e), 0);

      // Grouped view
      if (cmdOpts.group) {
        const groupKey = resolveGroupKey(cmdOpts.group);
        const groups = groupEntries(entryList, groupKey);

        if (mode !== "human") {
          printResult(
            {
              data: {
                groups,
                total: { seconds: totalSeconds, formatted: formatDuration(totalSeconds) },
              },
              meta: { count: entryList.length },
            },
            opts,
          );
          return;
        }

        const rows = groups.map((g) => [
          g.key,
          String(g.count),
          formatDuration(g.seconds),
          formatDecimalHours(g.seconds),
        ]);
        printTable(["Group", "Entries", "Duration", "Hours"], rows, opts);
        console.log();
        console.log(
          `  ${styleText("bold", "Total")}: ${formatDuration(totalSeconds)} (${formatDecimalHours(totalSeconds)}) across ${entryList.length} entries`,
        );
        console.log();
        return;
      }

      // Regular list view
      if (mode !== "human") {
        printResult(
          {
            data: entryList,
            meta: { count: entryList.length, totalSeconds },
          },
          opts,
        );
        return;
      }

      const rows = entryList.map((e) => [
        String(e.id),
        formatDate(new Date(e.timeSince)),
        formatTime(e.timeSince),
        isTimeEntry(e) && !e.timeUntil
          ? styleText("green", "running")
          : formatTime(e.timeUntil ?? e.timeSince),
        formatDuration(getEntryDurationUntilNow(e)),
        e.text || styleText("dim", "—"),
      ]);

      printTable(["ID", "Date", "Start", "End", "Duration", "Description"], rows, opts);
      console.log();
      console.log(
        `  ${styleText("bold", "Total")}: ${formatDuration(totalSeconds)} (${formatDecimalHours(totalSeconds)}) across ${entryList.length} entries`,
      );
      console.log();
    });

  // Get single entry
  entries
    .command("get <id>")
    .description("Get details of a specific entry")
    .action(async (id: string) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();
      const result = await client.getEntry({ id: parseId(id) });
      const e = result.entry;

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: e }, opts);
        return;
      }

      const timeUntilDisplay =
        isTimeEntry(e) && !e.timeUntil ? "running" : formatTime(e.timeUntil ?? e.timeSince);
      const duration = getEntryDurationUntilNow(e);

      printDetail(
        [
          ["ID", e.id],
          ["Date", formatDate(new Date(e.timeSince))],
          ["Start", formatTime(e.timeSince)],
          ["End", timeUntilDisplay],
          ["Duration", formatDuration(duration)],
          ["Description", e.text ?? null],
          ["Customer ID", e.customersId],
          ["Project ID", e.projectsId ?? null],
          ["Service ID", isTimeEntry(e) ? e.servicesId : null],
          ["Billable", e.billable === 1 ? "Yes" : e.billable === 2 ? "Billed" : "No"],
        ],
        opts,
      );
    });

  // Create entry (after the fact)
  entries
    .command("create")
    .description("Create a time entry")
    .requiredOption("--from <datetime>", "Start time (e.g., '2024-01-15 09:00' or '09:00')")
    .requiredOption("--to <datetime>", "End time (e.g., '2024-01-15 17:00' or '17:00')")
    .option("-c, --customer <id>", "Customer ID", parseIntStrict)
    .option("-p, --project <id>", "Project ID", parseIntStrict)
    .option("-s, --service <id>", "Service ID", parseIntStrict)
    .option("-t, --text <description>", "Entry description")
    .option("-b, --billable", "Mark as billable")
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
          "Customer ID and Service ID are required.",
          ExitCode.INVALID_ARGS,
          "Use --customer and --service flags, or set defaults via: clockodo config set",
        );
      }

      const result = await client.addEntry({
        customersId,
        servicesId,
        billable: cmdOpts.billable ? 1 : 0,
        timeSince: parseDateTime(cmdOpts.from),
        timeUntil: parseDateTime(cmdOpts.to),
        ...(projectsId && { projectsId }),
        ...(cmdOpts.text && { text: cmdOpts.text }),
      });

      if (mode !== "human") {
        printResult({ data: result.entry }, opts);
        return;
      }

      const entry = result.entry;
      const duration = getEntryDurationUntilNow(entry);
      printSuccess(`Entry created (ID: ${entry.id})`);
      console.log(
        `  ${formatTime(entry.timeSince)} — ${entry.timeUntil ? formatTime(entry.timeUntil) : "?"} (${formatDuration(duration)})`,
      );
    });

  // Update entry
  entries
    .command("update <id>")
    .description("Update a time entry")
    .option("--from <datetime>", "New start time")
    .option("--to <datetime>", "New end time")
    .option("-t, --text <description>", "New description")
    .option("-b, --billable", "Mark as billable")
    .option("--no-billable", "Mark as not billable")
    .action(async (id: string, cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const updates: Record<string, unknown> = { id: parseId(id) };
      if (cmdOpts.from) updates.timeSince = parseDateTime(cmdOpts.from);
      if (cmdOpts.to) updates.timeUntil = parseDateTime(cmdOpts.to);
      if (cmdOpts.text !== undefined) updates.text = cmdOpts.text;
      if (cmdOpts.billable !== undefined) updates.billable = cmdOpts.billable ? 1 : 0;

      const result = await client.editEntry(updates as Parameters<typeof client.editEntry>[0]);

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.entry }, opts);
        return;
      }

      printSuccess(`Entry ${id} updated`);
    });

  // Delete entry
  entries
    .command("delete <id>")
    .description("Delete a time entry")
    .option("-f, --force", "Skip confirmation")
    .action(async (id: string, cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      if (!cmdOpts.force && process.stdout.isTTY) {
        const confirm = await p.confirm({
          message: `Delete entry ${id}?`,
        });
        if (!confirm || p.isCancel(confirm)) return;
      }

      const entryId = parseId(id);
      await client.deleteEntry({ id: entryId });

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: { success: true, id: entryId } }, opts);
        return;
      }

      printSuccess(`Entry ${id} deleted`);
    });
}

type EntryLike = { customersId: number; projectsId: number | null; text?: string | null } & (
  | { type: 1; servicesId: number }
  | { type: 2 | 3 }
);

function resolveGroupKey(input: string): string {
  const aliases: Record<string, string> = {
    customer: "customersId",
    customers: "customersId",
    customers_id: "customersId",
    project: "projectsId",
    projects: "projectsId",
    projects_id: "projectsId",
    service: "servicesId",
    services: "servicesId",
    services_id: "servicesId",
    text: "text",
    description: "text",
  };
  const resolved = aliases[input.toLowerCase()];
  if (!resolved) {
    throw new CliError(
      `Unknown group field: "${input}". Valid options: customer, project, service, text`,
      ExitCode.INVALID_ARGS,
    );
  }
  return resolved;
}

function groupEntries(
  entries: EntryLike[],
  key: string,
): Array<{ key: string; count: number; seconds: number }> {
  const map = new Map<string, { count: number; seconds: number }>();

  for (const e of entries) {
    let groupValue: string;
    if (key === "text") {
      groupValue = e.text || "(no description)";
    } else {
      const val = (e as Record<string, unknown>)[key];
      groupValue = val != null ? String(val) : "(none)";
    }

    const existing = map.get(groupValue);
    const duration = getEntryDurationUntilNow(e as Parameters<typeof getEntryDurationUntilNow>[0]);
    if (existing) {
      existing.count++;
      existing.seconds += duration;
    } else {
      map.set(groupValue, { count: 1, seconds: duration });
    }
  }

  return [...map.entries()]
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.seconds - a.seconds);
}
