import { styleText } from "node:util";
import { isTimeEntry } from "clockodo";
import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import { printResult, resolveOutputMode } from "../lib/output.js";
import {
  elapsedSince,
  endOfDay,
  formatDuration,
  formatTime,
  startOfDay,
  toClockodoDateTime,
} from "../lib/time.js";
import type { GlobalOptions } from "../types/index.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show running clock and today's summary")
    .option("--prompt", "Single-line output for shell prompts (p10k, starship)")
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();
      const mode = resolveOutputMode(opts);

      // Fast path for shell prompt integration — single API call, single-line output
      if (cmdOpts.prompt) {
        const clock = await client.getClock();
        const running = clock.running;
        const elapsed = running ? elapsedSince(running.timeSince) : 0;

        if (mode !== "human") {
          printResult(
            {
              data: {
                running: !!running,
                text: running?.text ?? null,
                elapsed,
                formatted: formatDuration(elapsed),
              },
            },
            opts,
          );
          return;
        }

        // Plain text, no colors — safe for shell prompts
        if (running) {
          const parts = [running.text, formatDuration(elapsed)].filter(Boolean);
          console.log(parts.join(" "));
        }
        // Idle: print nothing (prompt segment hides when empty)
        return;
      }

      const now = new Date();
      const [clockResult, entriesResult] = await Promise.all([
        client.getClock(),
        client.getEntries({
          timeSince: toClockodoDateTime(startOfDay(now)),
          timeUntil: toClockodoDateTime(endOfDay(now)),
        }),
      ]);

      const running = clockResult.running;
      const entries = entriesResult.entries ?? [];
      const totalSeconds = entries.reduce(
        (sum, e) => sum + (isTimeEntry(e) ? (e.duration ?? 0) : 0),
        0,
      );
      const runningSeconds = running ? elapsedSince(running.timeSince) : 0;

      if (mode !== "human") {
        printResult(
          {
            data: {
              running: running
                ? {
                    id: running.id,
                    text: running.text,
                    customersId: running.customersId,
                    projectsId: running.projectsId,
                    servicesId: running.servicesId,
                    timeSince: running.timeSince,
                    elapsed: runningSeconds,
                  }
                : null,
              today: {
                entries: entries.length,
                totalSeconds: totalSeconds + runningSeconds,
                totalFormatted: formatDuration(totalSeconds + runningSeconds),
              },
            },
          },
          opts,
        );
        return;
      }

      // Human output
      console.log();
      if (running) {
        const elapsed = formatDuration(runningSeconds);
        const desc = running.text || styleText("dim", "(no description)");
        console.log(
          `  ${styleText("green", "●")} Running: ${styleText("bold", desc)} (${elapsed})`,
        );
        console.log(`    Started at ${formatTime(running.timeSince)}`);
      } else {
        console.log(`  ${styleText("dim", "○")} No clock running`);
      }

      console.log();
      console.log(
        `  Today: ${styleText("bold", formatDuration(totalSeconds + runningSeconds))} tracked across ${entries.length} entries`,
      );
      console.log();
    });
}
