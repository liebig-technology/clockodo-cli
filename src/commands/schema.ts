import type { Command } from "commander";

interface SchemaNode {
  name: string;
  description: string;
  options?: Array<{
    flags: string;
    description: string;
    required: boolean;
    defaultValue?: unknown;
  }>;
  subcommands?: SchemaNode[];
}

function commandToSchema(cmd: Command): SchemaNode {
  const node: SchemaNode = {
    name: cmd.name(),
    description: cmd.description(),
  };

  const options = cmd.options.map((opt) => ({
    flags: opt.flags,
    description: opt.description,
    required: opt.required,
    ...(opt.defaultValue !== undefined && { defaultValue: opt.defaultValue }),
  }));

  if (options.length > 0) {
    node.options = options;
  }

  const subcommands = cmd.commands.map(commandToSchema);
  if (subcommands.length > 0) {
    node.subcommands = subcommands;
  }

  return node;
}

export function registerSchemaCommand(program: Command): void {
  program
    .command("schema")
    .description("Output machine-readable CLI structure (for AI agents)")
    .action(() => {
      const schema = {
        schemaVersion: 1,
        cli: commandToSchema(program),
      };
      console.log(JSON.stringify(schema, null, 2));
    });
}
