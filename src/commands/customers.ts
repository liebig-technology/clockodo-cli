import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import { printDetail, printResult, printTable, resolveOutputMode } from "../lib/output.js";
import { parseId } from "../lib/validate.js";
import type { GlobalOptions } from "../types/index.js";

export function registerCustomersCommands(program: Command): void {
  const customers = program.command("customers").description("Manage customers");

  customers
    .command("list", { isDefault: true })
    .description("List customers")
    .option("--active", "Show only active customers")
    .option("--search <text>", "Search by name")
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const filter: Record<string, unknown> = {};
      if (cmdOpts.active) filter.active = true;
      if (cmdOpts.search) filter.fulltext = cmdOpts.search;

      const result = await client.getCustomers(
        Object.keys(filter).length > 0 ? { filter } : undefined,
      );
      const items = result.data ?? [];

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: items, meta: { count: items.length } }, opts);
        return;
      }

      const rows = items.map((c) => [
        String(c.id),
        c.name,
        c.number ?? "—",
        c.active ? "Yes" : "No",
      ]);
      printTable(["ID", "Name", "Number", "Active"], rows, opts);
    });

  customers
    .command("get <id>")
    .description("Get customer details")
    .action(async (id: string) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();
      const result = await client.getCustomer({ id: parseId(id) });
      const c = result.data;

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: c }, opts);
        return;
      }

      printDetail(
        [
          ["ID", c.id],
          ["Name", c.name],
          ["Number", c.number ?? null],
          ["Active", c.active],
          ["Billable Default", c.billableDefault],
          ["Note", c.note ?? null],
        ],
        opts,
      );
    });
}
