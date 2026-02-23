import * as p from "@clack/prompts";
import type { AddServiceParams, EditServiceParams } from "clockodo";
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
      if (items.length === 0) {
        if (mode !== "human") {
          printResult({ data: [], meta: { count: 0 } }, opts);
        } else {
          printInfo("No services found.");
        }
        return;
      }

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

  services
    .command("create")
    .description("Create a service")
    .requiredOption("--name <name>", "Service name")
    .option("--number <text>", "Service number")
    .option("--note <text>", "Note")
    .option("--active", "Set as active (default)")
    .option("--no-active", "Set as inactive")
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const params: AddServiceParams = {
        name: cmdOpts.name,
        ...(cmdOpts.number != null && { number: cmdOpts.number }),
        ...(cmdOpts.note != null && { note: cmdOpts.note }),
        ...(cmdOpts.active !== undefined && { active: cmdOpts.active }),
      };

      const result = await client.addService(params);

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.data }, opts);
        return;
      }

      printSuccess(`Service created (ID: ${result.data.id})`);
      console.log(`  ${result.data.name}`);
    });

  services
    .command("update <id>")
    .description("Update a service")
    .option("--name <name>", "New name")
    .option("--number <text>", "New number")
    .option("--note <text>", "New note")
    .option("--active", "Set as active")
    .option("--no-active", "Set as inactive")
    .action(async (id: string, cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const params: EditServiceParams = {
        id: parseId(id),
        ...(cmdOpts.name != null && { name: cmdOpts.name }),
        ...(cmdOpts.number != null && { number: cmdOpts.number }),
        ...(cmdOpts.note != null && { note: cmdOpts.note }),
        ...(cmdOpts.active !== undefined && { active: cmdOpts.active }),
      };

      const result = await client.editService(params);

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.data }, opts);
        return;
      }

      printSuccess(`Service ${id} updated`);
    });

  services
    .command("delete <id>")
    .description("Delete a service")
    .option("-f, --force", "Skip confirmation")
    .action(async (id: string, cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      if (!cmdOpts.force && process.stdout.isTTY) {
        const confirm = await p.confirm({
          message: `Delete service ${id}?`,
        });
        if (!confirm || p.isCancel(confirm)) return;
      }

      const serviceId = parseId(id);
      await client.deleteService({ id: serviceId });

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: { success: true, id: serviceId } }, opts);
        return;
      }

      printSuccess(`Service ${id} deleted`);
    });
}
