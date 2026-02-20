import * as p from "@clack/prompts";
import type { Command } from "commander";
import {
  getConfig,
  getConfigPath,
  getConfigValue,
  maskSecret,
  setConfigValue,
} from "../lib/config.js";
import { printDetail, printResult, resolveOutputMode } from "../lib/output.js";
import type { GlobalOptions } from "../types/index.js";

export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Manage CLI configuration");

  config
    .command("set")
    .description("Configure API credentials interactively")
    .action(async () => {
      p.intro("Clockodo CLI Configuration");

      const email = await p.text({
        message: "Clockodo email address:",
        placeholder: "you@example.com",
        initialValue: getConfigValue("email") ?? "",
        validate: (v) => (!v || !v.includes("@") ? "Must be a valid email" : undefined),
      });
      if (p.isCancel(email)) return process.exit(0);

      const apiKey = await p.password({
        message: "Clockodo API key:",
        validate: (v) => (!v || v.length < 5 ? "API key seems too short" : undefined),
      });
      if (p.isCancel(apiKey)) return process.exit(0);

      const timezone = await p.text({
        message: "Default timezone:",
        placeholder: "Europe/Berlin",
        initialValue: getConfigValue("timezone") ?? "Europe/Berlin",
      });
      if (p.isCancel(timezone)) return process.exit(0);

      setConfigValue("email", email);
      setConfigValue("apiKey", apiKey);
      setConfigValue("timezone", timezone);

      p.outro(`Configuration saved to ${getConfigPath()}`);
    });

  config
    .command("show")
    .description("Show current configuration (secrets masked)")
    .action(() => {
      const opts = program.opts<GlobalOptions>();
      const cfg = getConfig();
      const mode = resolveOutputMode(opts);

      if (mode !== "human") {
        const safeCfg = { ...cfg };
        if (safeCfg.apiKey) safeCfg.apiKey = maskSecret(safeCfg.apiKey);
        printResult({ data: safeCfg }, opts);
        return;
      }

      printDetail(
        [
          ["Email", cfg.email ?? null],
          ["API Key", cfg.apiKey ? maskSecret(cfg.apiKey) : null],
          ["Timezone", cfg.timezone ?? null],
          ["Default Customer ID", cfg.defaultCustomerId ?? null],
          ["Default Service ID", cfg.defaultServiceId ?? null],
          ["Default Project ID", cfg.defaultProjectId ?? null],
          ["Config Path", getConfigPath()],
        ],
        opts,
      );
    });

  config
    .command("path")
    .description("Print config file path")
    .action(() => {
      console.log(getConfigPath());
    });
}
