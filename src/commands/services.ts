import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import { printDetail, printResult, printTable, resolveOutputMode } from "../lib/output.js";
import { parseId } from "../lib/validate.js";
import type { GlobalOptions } from "../types/index.js";

export function registerServicesCommands(program: Command): void {
  const services = program.command("services").description("Manage services");

  services
    .command("list", { isDefault: true })
    .description("List services")
    .option("--active", "Show only active services")
    .option("--search <text>", "Search by name")
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const filter: Record<string, unknown> = {};
      if (cmdOpts.active) filter.active = true;
      if (cmdOpts.search) filter.fulltext = cmdOpts.search;

      const result = await client.getServices(
        Object.keys(filter).length > 0 ? { filter } : undefined,
      );
      const items = result.data ?? [];

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: items, meta: { count: items.length } }, opts);
        return;
      }

      const rows = items.map((s) => [
        String(s.id),
        s.name,
        s.number ?? "—",
        s.active ? "Yes" : "No",
      ]);
      printTable(["ID", "Name", "Number", "Active"], rows, opts);
    });

  services
    .command("get <id>")
    .description("Get service details")
    .action(async (id: string) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();
      const result = await client.getService({ id: parseId(id) });
      const s = result.data;

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: s }, opts);
        return;
      }

      printDetail(
        [
          ["ID", s.id],
          ["Name", s.name],
          ["Number", s.number ?? null],
          ["Active", s.active],
          ["Note", s.note ?? null],
        ],
        opts,
      );
    });
}
