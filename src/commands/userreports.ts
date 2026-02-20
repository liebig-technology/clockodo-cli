import { styleText } from "node:util";
import { UserReportType } from "clockodo";
import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import { CliError, ExitCode } from "../lib/errors.js";
import { printDetail, printResult, printTable, resolveOutputMode } from "../lib/output.js";
import { formatDuration } from "../lib/time.js";
import { parseIntStrict } from "../lib/validate.js";
import type { GlobalOptions } from "../types/index.js";

interface UserReportOptions {
  user?: number;
  year?: number;
  detail?: string;
}

interface UserReportsOptions {
  year?: number;
}

const DETAIL_TYPE_MAP: Record<string, UserReportType> = {
  months: UserReportType.YearAndMonths,
  weeks: UserReportType.YearMonthsAndWeeks,
  days: UserReportType.YearMonthsWeeksAndDays,
};

export function registerUserReportCommands(program: Command): void {
  program
    .command("userreport")
    .description("Show user report (overtime, holidays, absences) for a year")
    .option("-u, --user <id>", "User ID (defaults to current user)", parseIntStrict)
    .option("-y, --year <year>", "Year to report on (defaults to current year)", parseIntStrict)
    .option("-d, --detail <level>", "Detail level: months, weeks, or days")
    .action(async (cmdOpts: UserReportOptions) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const usersId = cmdOpts.user ?? (await client.getMe()).data.id;
      const year = cmdOpts.year ?? new Date().getFullYear();

      let type: UserReportType | undefined;
      if (cmdOpts.detail) {
        type = DETAIL_TYPE_MAP[cmdOpts.detail];
        if (type === undefined) {
          throw new CliError(
            `Unknown detail level: "${cmdOpts.detail}". Valid options: months, weeks, days`,
            ExitCode.INVALID_ARGS,
          );
        }
      }

      const result = await client.getUserReport({
        usersId,
        year,
        ...(type !== undefined && { type }),
      });
      const report = result.userreport;

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: report }, opts);
        return;
      }

      // Human-readable output
      const sumTarget = report.sumTarget ?? 0;
      const holidaysRemaining =
        report.holidaysQuota + report.holidaysCarry - report.sumAbsence.regularHolidays;

      console.log();
      console.log(`  ${styleText("bold", "User Report")}: ${report.usersName} (${year})`);
      console.log();

      printDetail(
        [
          ["Name", report.usersName],
          ["Year", year],
          ["Target hours", formatDuration(sumTarget)],
          ["Worked hours", formatDuration(report.sumHours)],
          ["Overtime", formatDuration(report.diff)],
          [
            "Holidays",
            `${holidaysRemaining} remaining (${report.holidaysQuota} quota + ${report.holidaysCarry} carry - ${report.sumAbsence.regularHolidays} used)`,
          ],
          ["Sick days", report.sumAbsence.sickSelf],
          ["Home office days", report.sumAbsence.homeOffice],
        ],
        opts,
      );
      console.log();
    });

  program
    .command("userreports")
    .description("Show user reports for all users in a year")
    .option("-y, --year <year>", "Year to report on (defaults to current year)", parseIntStrict)
    .action(async (cmdOpts: UserReportsOptions) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const year = cmdOpts.year ?? new Date().getFullYear();

      const result = await client.getUserReports({ year });
      const reports = result.userreports ?? [];

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: reports, meta: { count: reports.length } }, opts);
        return;
      }

      // Human-readable output
      console.log();
      console.log(`  ${styleText("bold", "User Reports")} (${year}): ${reports.length} users`);
      console.log();

      if (reports.length === 0) {
        console.log(styleText("dim", "  No reports found."));
        return;
      }

      const rows = reports.map((r) => {
        const sumTarget = r.sumTarget ?? 0;
        const holidaysRemaining = r.holidaysQuota + r.holidaysCarry - r.sumAbsence.regularHolidays;

        return [
          r.usersName,
          formatDuration(sumTarget),
          formatDuration(r.sumHours),
          formatDuration(r.diff),
          String(holidaysRemaining),
          String(r.sumAbsence.sickSelf),
        ];
      });

      printTable(
        ["Name", "Target", "Worked", "Overtime", "Holidays Remaining", "Sick Days"],
        rows,
        opts,
      );
      console.log();
    });
}
