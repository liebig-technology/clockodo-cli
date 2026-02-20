import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import { printDetail, printResult, printTable, resolveOutputMode } from "../lib/output.js";
import { parseId, parseIntStrict } from "../lib/validate.js";
import type { GlobalOptions } from "../types/index.js";

export function registerProjectsCommands(program: Command): void {
  const projects = program.command("projects").description("Manage projects");

  projects
    .command("list", { isDefault: true })
    .description("List projects")
    .option("--customer <id>", "Filter by customer ID", parseIntStrict)
    .option("--active", "Show only active projects")
    .option("--search <text>", "Search by name")
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const filter: Record<string, unknown> = {};
      if (cmdOpts.customer) filter.customersId = cmdOpts.customer;
      if (cmdOpts.active) filter.active = true;
      if (cmdOpts.search) filter.fulltext = cmdOpts.search;

      const result = await client.getProjects(
        Object.keys(filter).length > 0 ? { filter } : undefined,
      );
      const items = result.data ?? [];

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: items, meta: { count: items.length } }, opts);
        return;
      }

      const rows = items.map((p) => [
        String(p.id),
        p.name,
        p.number ?? "—",
        String(p.customersId),
        p.active ? "Yes" : "No",
        p.completed ? "Yes" : "No",
      ]);
      printTable(["ID", "Name", "Number", "Customer", "Active", "Completed"], rows, opts);
    });

  projects
    .command("get <id>")
    .description("Get project details")
    .action(async (id: string) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();
      const result = await client.getProject({ id: parseId(id) });
      const p = result.data;

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: p }, opts);
        return;
      }

      printDetail(
        [
          ["ID", p.id],
          ["Name", p.name],
          ["Number", p.number ?? null],
          ["Customer ID", p.customersId],
          ["Active", p.active],
          ["Completed", p.completed],
          ["Budget", p.budget?.amount ?? null],
          ["Budget Type", p.budget?.monetary ? "Money" : "Hours"],
          ["Note", p.note ?? null],
        ],
        opts,
      );
    });
}
