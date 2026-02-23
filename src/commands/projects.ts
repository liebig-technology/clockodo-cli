import * as p from "@clack/prompts";
import type { AddProjectParams, EditProjectParams } from "clockodo";
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
      if (items.length === 0) {
        if (mode !== "human") {
          printResult({ data: [], meta: { count: 0 } }, opts);
        } else {
          printInfo("No projects found.");
        }
        return;
      }

      if (mode !== "human") {
        printResult({ data: items, meta: { count: items.length } }, opts);
        return;
      }

      const rows = items.map((proj) => [
        String(proj.id),
        proj.name,
        proj.number ?? "—",
        String(proj.customersId),
        proj.active ? "Yes" : "No",
        proj.completed ? "Yes" : "No",
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
      const proj = result.data;

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: proj }, opts);
        return;
      }

      printDetail(
        [
          ["ID", proj.id],
          ["Name", proj.name],
          ["Number", proj.number ?? null],
          ["Customer ID", proj.customersId],
          ["Active", proj.active],
          ["Completed", proj.completed],
          ["Budget", proj.budget?.amount ?? null],
          ["Budget Type", proj.budget?.monetary ? "Money" : "Hours"],
          ["Note", proj.note ?? null],
        ],
        opts,
      );
    });

  projects
    .command("create")
    .description("Create a project")
    .requiredOption("--name <name>", "Project name")
    .requiredOption("--customer <id>", "Customer ID", parseIntStrict)
    .option("--number <text>", "Project number")
    .option("--note <text>", "Note")
    .option("--active", "Set as active (default)")
    .option("--no-active", "Set as inactive")
    .option("--billable", "Set as billable by default")
    .option("--no-billable", "Set as not billable by default")
    .action(async (cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const params: AddProjectParams = {
        name: cmdOpts.name,
        customersId: cmdOpts.customer,
        ...(cmdOpts.number != null && { number: cmdOpts.number }),
        ...(cmdOpts.note != null && { note: cmdOpts.note }),
        ...(cmdOpts.active !== undefined && { active: cmdOpts.active }),
        ...(cmdOpts.billable !== undefined && {
          billableDefault: cmdOpts.billable,
        }),
      };

      const result = await client.addProject(params);

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.data }, opts);
        return;
      }

      printSuccess(`Project created (ID: ${result.data.id})`);
      console.log(`  ${result.data.name}`);
    });

  projects
    .command("update <id>")
    .description("Update a project")
    .option("--name <name>", "New name")
    .option("--customer <id>", "New customer ID", parseIntStrict)
    .option("--number <text>", "New number")
    .option("--note <text>", "New note")
    .option("--active", "Set as active")
    .option("--no-active", "Set as inactive")
    .option("--billable", "Set as billable by default")
    .option("--no-billable", "Set as not billable by default")
    .action(async (id: string, cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      const params: EditProjectParams = {
        id: parseId(id),
        ...(cmdOpts.name != null && { name: cmdOpts.name }),
        ...(cmdOpts.customer != null && { customersId: cmdOpts.customer }),
        ...(cmdOpts.number != null && { number: cmdOpts.number }),
        ...(cmdOpts.note != null && { note: cmdOpts.note }),
        ...(cmdOpts.active !== undefined && { active: cmdOpts.active }),
        ...(cmdOpts.billable !== undefined && {
          billableDefault: cmdOpts.billable,
        }),
      };

      const result = await client.editProject(params);

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: result.data }, opts);
        return;
      }

      printSuccess(`Project ${id} updated`);
    });

  projects
    .command("delete <id>")
    .description("Delete a project")
    .option("-f, --force", "Skip confirmation")
    .action(async (id: string, cmdOpts) => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();

      if (!cmdOpts.force && process.stdout.isTTY) {
        const confirm = await p.confirm({
          message: `Delete project ${id}?`,
        });
        if (!confirm || p.isCancel(confirm)) return;
      }

      const projectId = parseId(id);
      await client.deleteProject({ id: projectId });

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: { success: true, id: projectId } }, opts);
        return;
      }

      printSuccess(`Project ${id} deleted`);
    });
}
