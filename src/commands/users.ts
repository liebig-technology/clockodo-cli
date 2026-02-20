import type { Command } from "commander";
import { getClient } from "../lib/client.js";
import { printDetail, printResult, printTable, resolveOutputMode } from "../lib/output.js";
import type { GlobalOptions } from "../types/index.js";

export function registerUsersCommands(program: Command): void {
  const users = program.command("users").description("User management");

  users
    .command("me")
    .description("Show current user info")
    .action(async () => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();
      const result = await client.getMe();
      const u = result.data;

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: u }, opts);
        return;
      }

      printDetail(
        [
          ["ID", u.id],
          ["Name", u.name],
          ["Email", u.email],
          ["Role", u.role],
          ["Active", u.active],
        ],
        opts,
      );
    });

  users
    .command("list")
    .description("List all users")
    .action(async () => {
      const opts = program.opts<GlobalOptions>();
      const client = getClient();
      const result = await client.getUsers();
      const items = result.data ?? [];

      const mode = resolveOutputMode(opts);
      if (mode !== "human") {
        printResult({ data: items, meta: { count: items.length } }, opts);
        return;
      }

      const rows = items.map((u) => [
        String(u.id),
        u.name,
        u.email,
        u.role ?? "—",
        u.active ? "Yes" : "No",
      ]);
      printTable(["ID", "Name", "Email", "Role", "Active"], rows, opts);
    });
}
