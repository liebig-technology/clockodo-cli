import * as p from "@clack/prompts";
import type { GlobalOptions, OutputMode } from "../types/index.js";
import { getClient } from "./client.js";
import { getConfigValue } from "./config.js";

interface SelectionResult {
  customersId: number;
  projectsId?: number;
  servicesId: number;
}

/** Check whether interactive prompts should be shown */
export function shouldPrompt(opts: GlobalOptions, mode: OutputMode): boolean {
  if (opts.noInput) return false;
  if (mode !== "human") return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

/** Interactively select customer, project, and service via @clack/prompts */
export async function selectCustomerProjectService(): Promise<SelectionResult | null> {
  const client = getClient();

  // 1. Select customer
  const customersResult = await client.getCustomers({ filter: { active: true } });
  const customers = customersResult.data ?? [];

  const defaultCustomerId = getConfigValue("defaultCustomerId");

  const customersId = await p.select({
    message: "Select a customer",
    options: customers.map((c) => ({ value: c.id, label: c.name })),
    ...(defaultCustomerId && { initialValue: defaultCustomerId }),
  });

  if (p.isCancel(customersId)) {
    return null;
  }

  // 2. Select project (filtered by customer)
  const projectsResult = await client.getProjects({
    filter: { customersId: customersId as number, active: true },
  });
  const projects = projectsResult.data ?? [];

  const defaultProjectId = getConfigValue("defaultProjectId");

  const projectOptions = [
    { value: 0, label: "(no project)" },
    ...projects.map((proj) => ({ value: proj.id, label: proj.name })),
  ];

  const projectsId = await p.select({
    message: "Select a project",
    options: projectOptions,
    ...(defaultProjectId && { initialValue: defaultProjectId }),
  });

  if (p.isCancel(projectsId)) {
    return null;
  }

  // 3. Select service
  const servicesResult = await client.getServices({ filter: { active: true } });
  const services = servicesResult.data ?? [];

  const defaultServiceId = getConfigValue("defaultServiceId");

  const servicesId = await p.select({
    message: "Select a service",
    options: services.map((s) => ({ value: s.id, label: s.name })),
    ...(defaultServiceId && { initialValue: defaultServiceId }),
  });

  if (p.isCancel(servicesId)) {
    return null;
  }

  return {
    customersId: customersId as number,
    ...(projectsId !== 0 && { projectsId: projectsId as number }),
    servicesId: servicesId as number,
  };
}
