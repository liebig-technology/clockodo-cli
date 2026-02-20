import { Command } from "commander";
import { vi } from "vitest";

interface RunCommandResult {
  /** All captured console.log output joined by newlines */
  stdout: string;
  /** Parse the captured stdout as JSON */
  parseJson: () => Record<string, unknown>;
}

/**
 * Invoke a CLI command in tests by setting up a Commander program,
 * registering the command, and capturing console.log output.
 *
 * @param register - The `registerXxxCommands(program)` function from a command module
 * @param argv - Simulated CLI args, e.g. ["status", "--json"]
 */
export async function runCommand(
  register: (program: Command) => void,
  argv: string[],
): Promise<RunCommandResult> {
  const program = new Command();
  program
    .name("clockodo")
    .option("-j, --json", "Output as JSON")
    .option("-p, --plain", "Output as plain text (no colors)")
    .option("--no-color", "Disable colors")
    .option("--no-input", "Disable interactive prompts")
    .option("-v, --verbose", "Verbose output");

  program.exitOverride();
  register(program);

  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  });

  try {
    await program.parseAsync(["node", "clockodo", ...argv]);
  } finally {
    spy.mockRestore();
  }

  const stdout = lines.join("\n");
  return {
    stdout,
    parseJson() {
      return JSON.parse(stdout) as Record<string, unknown>;
    },
  };
}
