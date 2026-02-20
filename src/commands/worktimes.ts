import { styleText } from "node:util";
import type { WorkTimeDayInterval } from "clockodo";
import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import { printResult, printTable, resolveOutputMode } from "../lib/output.js";
import { endOfWeek, formatDate, formatDuration, formatTime, startOfWeek } from "../lib/time.js";
import { parseIntStrict } from "../lib/validate.js";
import type { GlobalOptions } from "../types/index.js";

interface DayStats {
  startTime: string | null;
  endTime: string | null;
  totalSeconds: number;
  breakSeconds: number;
  intervalCount: number;
}

function computeDayStats(day: { intervals: WorkTimeDayInterval[] }): DayStats {
  if (day.intervals.length === 0) {
    return {
      startTime: null,
      endTime: null,
      totalSeconds: 0,
      breakSeconds: 0,
      intervalCount: 0,
    };
  }

  const first = day.intervals[0];
  const last = day.intervals[day.intervals.length - 1];

  let totalSeconds = 0;
  let breakSeconds = 0;
  let prevEnd: number | null = null;

  for (const interval of day.intervals) {
    const start = new Date(interval.timeSince).getTime();
    const end = interval.timeUntil ? new Date(interval.timeUntil).getTime() : Date.now();
    totalSeconds += (end - start) / 1000;

    if (prevEnd !== null) {
      breakSeconds += (start - prevEnd) / 1000;
    }
    prevEnd = end;
  }

  return {
    startTime: first?.timeSince ?? null,
    endTime: last?.timeUntil ?? null,
    totalSeconds,
    breakSeconds,
    intervalCount: day.intervals.length,
  };
}

export function registerWorktimesCommands(program: Command): void {
  program
    .command("worktimes")
    .description("Show work time intervals")
    .option("--since <date>", "Start date (default: Monday of current week)")
    .option("--until <date>", "End date (default: Sunday of current week)")
    .option("--user <id>", "Filter by user ID", parseIntStrict)
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const now = new Date();
      const dateSince = cmdOpts.since ?? formatDate(startOfWeek(now));
      const dateUntil = cmdOpts.until ?? formatDate(endOfWeek(now));

      const result = await client.getWorkTimes({
        dateSince,
        dateUntil,
        ...(cmdOpts.user && { usersId: cmdOpts.user }),
      });
      const workTimeDays = result.workTimeDays ?? [];

      const daysWithStats = workTimeDays.map((day) => ({
        ...day,
        stats: computeDayStats(day),
      }));

      const totalSeconds = daysWithStats.reduce((sum, d) => sum + d.stats.totalSeconds, 0);

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult(
          {
            data: daysWithStats,
            meta: { count: daysWithStats.length, totalSeconds },
          },
          opts,
        );
        return;
      }

      // Human mode
      console.log();
      console.log(`  ${styleText("bold", "Work Times")}: ${dateSince} — ${dateUntil}`);
      console.log();

      if (daysWithStats.length === 0) {
        console.log(styleText("dim", "  No work time data found for this period."));
        return;
      }

      const rows = daysWithStats.map((day) => {
        const stats = day.stats;
        return [
          String(day.date),
          stats.startTime ? formatTime(stats.startTime) : "-",
          stats.endTime ? formatTime(stats.endTime) : "-",
          formatDuration(stats.totalSeconds),
          stats.breakSeconds > 0 ? formatDuration(stats.breakSeconds) : "-",
          String(stats.intervalCount),
        ];
      });

      printTable(["Date", "Start", "End", "Hours", "Break", "Intervals"], rows, opts);

      console.log();
      console.log(`  ${styleText("bold", "Total")}: ${formatDuration(totalSeconds)}`);
      console.log();
    });
}
