import * as p from "@clack/prompts";
import type { AddCustomerParams, EditCustomerParams } from "clockodo";
import { Billability } from "clockodo";
import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import {
  printDetail,
  printInfo,
  printResult,
  printSuccess,
  printTable,
  resolveOutputMode,
} from "../lib/output.js";
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
      if (items.length === 0) {
        if (mode !== "human") {
          printResult({ data: [], meta: { count: 0 } }, opts);
        } else {
          printInfo("No customers found.");
        }
        return;
      }

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

  customers
    .command("create")
    .description("Create a customer")
    .requiredOption("--name <name>", "Customer name")
    .option("--number <text>", "Customer number")
    .option("--note <text>", "Note")
    .option("--active", "Set as active (default)")
    .option("--no-active", "Set as inactive")
    .option("--billable", "Set as billable by default")
    .option("--no-billable", "Set as not billable by default")
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const params: AddCustomerParams = {
        name: cmdOpts.name,
        ...(cmdOpts.number != null && { number: cmdOpts.number }),
        ...(cmdOpts.note != null && { note: cmdOpts.note }),
        ...(cmdOpts.active !== undefined && { active: cmdOpts.active }),
        ...(cmdOpts.billable !== undefined && {
          billableDefault: cmdOpts.billable ? Billability.Billable : Billability.NotBillable,
        }),
      };

      const result = await client.addCustomer(params);

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.data }, opts);
        return;
      }

      printSuccess(`Customer created (ID: ${result.data.id})`);
      console.log(`  ${result.data.name}`);
    });

  customers
    .command("update <id>")
    .description("Update a customer")
    .option("--name <name>", "New name")
    .option("--number <text>", "New number")
    .option("--note <text>", "New note")
    .option("--active", "Set as active")
    .option("--no-active", "Set as inactive")
    .option("--billable", "Set as billable by default")
    .option("--no-billable", "Set as not billable by default")
    .action(async (id: string, cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const params: EditCustomerParams = {
        id: parseId(id),
        ...(cmdOpts.name != null && { name: cmdOpts.name }),
        ...(cmdOpts.number != null && { number: cmdOpts.number }),
        ...(cmdOpts.note != null && { note: cmdOpts.note }),
        ...(cmdOpts.active !== undefined && { active: cmdOpts.active }),
        ...(cmdOpts.billable !== undefined && {
          billableDefault: cmdOpts.billable ? Billability.Billable : Billability.NotBillable,
        }),
      };

      const result = await client.editCustomer(params);

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.data }, opts);
        return;
      }

      printSuccess(`Customer ${id} updated`);
    });

  customers
    .command("delete <id>")
    .description("Delete a customer")
    .option("-f, --force", "Skip confirmation")
    .action(async (id: string, cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      if (!cmdOpts.force && process.stdout.isTTY) {
        const confirm = await p.confirm({
          message: `Delete customer ${id}?`,
        });
        if (!confirm || p.isCancel(confirm)) return;
      }

      const customerId = parseId(id);
      await client.deleteCustomer({ id: customerId });

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: { success: true, id: customerId } }, opts);
        return;
      }

      printSuccess(`Customer ${id} deleted`);
    });
}
