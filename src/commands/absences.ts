import { styleText } from "node:util";
import * as p from "@clack/prompts";
import type { Absence, AbsencesParams, AddAbsenceParams, EditAbsenceParams } from "clockodo";
import { AbsenceStatus, AbsenceType } from "clockodo";
import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import {
  printDetail,
  printResult,
  printSuccess,
  printTable,
  resolveOutputMode,
} from "../lib/output.js";
import { parseId, parseIntStrict } from "../lib/validate.js";
import type { GlobalOptions } from "../types/index.js";

/** Split a camelCase enum name into a human-readable label */
function formatEnumLabel(name: string): string {
  return name.replace(/([A-Z])/g, " $1").trim();
}

/** Get human-readable type name from AbsenceType enum value */
function formatAbsenceType(type: number | undefined): string {
  if (type == null) return styleText("dim", "—");
  const name = AbsenceType[type];
  return name ? formatEnumLabel(name) : String(type);
}

/** Get human-readable status name from AbsenceStatus enum value */
function formatAbsenceStatus(status: number): string {
  const name = AbsenceStatus[status];
  return name ? formatEnumLabel(name) : String(status);
}

/** Get days or hours display depending on absence type */
function formatDaysOrHours(absence: Absence): string {
  if ("countHours" in absence && absence.countHours != null) {
    return `${absence.countHours}h`;
  }
  if ("countDays" in absence && absence.countDays != null) {
    return `${absence.countDays}d`;
  }
  return "—";
}

export function registerAbsencesCommands(program: Command): void {
  const absences = program.command("absences").description("Manage absences");

  // List absences
  absences
    .command("list", { isDefault: true })
    .description("List absences")
    .option("--year <year>", "Filter by year (default: current year)", parseIntStrict)
    .option("--user <id>", "Filter by user ID", parseIntStrict)
    .option("--type <type>", "Filter by absence type", parseIntStrict)
    .option("--status <status>", "Filter by absence status", parseIntStrict)
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const year = cmdOpts.year ?? new Date().getFullYear();

      const filter: NonNullable<AbsencesParams["filter"]> = { year: [year] };
      if (cmdOpts.user) filter.usersId = [cmdOpts.user];
      if (cmdOpts.type != null) filter.type = [cmdOpts.type];
      if (cmdOpts.status != null) filter.status = [cmdOpts.status];

      const result = await client.getAbsences({ filter });

      const absenceList = result.data ?? [];

      const mode = resolveOutputMode(opts);
      if (absenceList.length === 0) {
        if (mode !== "human") {
          printResult({ data: [], meta: { count: 0 } }, opts);
        } else {
          console.log(styleText("dim", "  No absences found."));
        }
        return;
      }

      if (mode !== "human") {
        printResult({ data: absenceList, meta: { count: absenceList.length } }, opts);
        return;
      }

      const rows = absenceList.map((a) => [
        String(a.id),
        String(a.usersId),
        a.dateSince,
        a.dateUntil,
        formatAbsenceType(a.type),
        formatAbsenceStatus(a.status),
        formatDaysOrHours(a),
      ]);

      printTable(["ID", "User", "Since", "Until", "Type", "Status", "Days/Hours"], rows, opts);
    });

  // Get single absence
  absences
    .command("get <id>")
    .description("Get details of a specific absence")
    .action(async (id: string) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();
      const result = await client.getAbsence({ id: parseId(id) });
      const absence = result.data;

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: absence }, opts);
        return;
      }

      printDetail(
        [
          ["ID", absence.id],
          ["User ID", absence.usersId],
          ["Since", absence.dateSince],
          ["Until", absence.dateUntil],
          ["Type", formatAbsenceType(absence.type)],
          ["Status", formatAbsenceStatus(absence.status)],
          ["Days/Hours", formatDaysOrHours(absence)],
          ["Note", absence.note ?? null],
          ["Public Note", absence.publicNote ?? null],
          ["Date Enquired", absence.dateEnquired ?? null],
          ["Date Approved", absence.dateApproved ?? null],
        ],
        opts,
      );
    });

  // Create absence
  absences
    .command("create")
    .description("Create an absence")
    .requiredOption("--since <date>", "Start date (YYYY-MM-DD)")
    .requiredOption("--type <type>", "Absence type (number)", parseIntStrict)
    .option("--until <date>", "End date (YYYY-MM-DD)")
    .option("--half-day", "Half-day absence")
    .option("--sick-note", "Has sick note")
    .option("--note <text>", "Private note")
    .option("--public-note <text>", "Public note")
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const params: AddAbsenceParams = {
        dateSince: cmdOpts.since,
        type: cmdOpts.type,
        ...(cmdOpts.until && { dateUntil: cmdOpts.until }),
        ...(cmdOpts.halfDay && { halfDay: true }),
        ...(cmdOpts.sickNote && { sickNote: true }),
        ...(cmdOpts.note != null && { note: cmdOpts.note }),
        ...(cmdOpts.publicNote != null && { publicNote: cmdOpts.publicNote }),
      };

      const result = await client.addAbsence(params);

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.data }, opts);
        return;
      }

      printSuccess(`Absence created (ID: ${result.data.id})`);
      console.log(
        `  ${result.data.dateSince} — ${result.data.dateUntil ?? result.data.dateSince} (${formatAbsenceType(result.data.type)})`,
      );
    });

  // Update absence
  absences
    .command("update <id>")
    .description("Update an absence")
    .option("--since <date>", "New start date (YYYY-MM-DD)")
    .option("--until <date>", "New end date (YYYY-MM-DD)")
    .option("--type <type>", "New absence type (number)", parseIntStrict)
    .option("--half-day", "Half-day absence")
    .option("--no-half-day", "Not half-day")
    .option("--sick-note", "Has sick note")
    .option("--no-sick-note", "No sick note")
    .option("--note <text>", "New private note")
    .option("--public-note <text>", "New public note")
    .action(async (id: string, cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const params: EditAbsenceParams = { id: parseId(id) };
      if (cmdOpts.since) params.dateSince = cmdOpts.since;
      if (cmdOpts.until) params.dateUntil = cmdOpts.until;
      if (cmdOpts.type != null) params.type = cmdOpts.type;
      if (cmdOpts.halfDay !== undefined) params.halfDay = cmdOpts.halfDay;
      if (cmdOpts.sickNote !== undefined) params.sickNote = cmdOpts.sickNote;
      if (cmdOpts.note != null) params.note = cmdOpts.note;
      if (cmdOpts.publicNote != null) params.publicNote = cmdOpts.publicNote;

      const result = await client.editAbsence(params);

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.data }, opts);
        return;
      }

      printSuccess(`Absence ${id} updated`);
    });

  // Delete absence
  absences
    .command("delete <id>")
    .description("Delete an absence")
    .option("-f, --force", "Skip confirmation")
    .action(async (id: string, cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      if (!cmdOpts.force && process.stdout.isTTY) {
        const confirm = await p.confirm({
          message: `Delete absence ${id}?`,
        });
        if (!confirm || p.isCancel(confirm)) return;
      }

      const absenceId = parseId(id);
      await client.deleteAbsence({ id: absenceId });

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: { success: true, id: absenceId } }, opts);
        return;
      }

      printSuccess(`Absence ${id} deleted`);
    });
}
