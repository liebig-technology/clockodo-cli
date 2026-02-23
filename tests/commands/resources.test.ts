import { Billability } from "clockodo";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockClient, type MockClockodo } from "../helpers/mock-client.js";
import { runCommand } from "../helpers/run-command.js";

vi.mock("../../src/lib/client.js");
vi.mock("../../src/lib/config.js");

let client: MockClockodo;

beforeEach(async () => {
  vi.resetAllMocks();
  client = createMockClient();
  const { getClient } = await import("../../src/lib/client.js");
  vi.mocked(getClient).mockReturnValue(client as unknown as ReturnType<typeof getClient>);
});

const { registerCustomersCommands } = await import("../../src/commands/customers.js");
const { registerProjectsCommands } = await import("../../src/commands/projects.js");
const { registerServicesCommands } = await import("../../src/commands/services.js");

const resources = [
  {
    name: "customers",
    register: registerCustomersCommands,
    listMethod: "getCustomers" as const,
    getMethod: "getCustomer" as const,
    addMethod: "addCustomer" as const,
    editMethod: "editCustomer" as const,
    deleteMethod: "deleteCustomer" as const,
    listData: { data: [{ id: 1, name: "Acme Corp", number: "C-001", active: true }] },
    getData: {
      data: {
        id: 1,
        name: "Acme Corp",
        number: "C-001",
        active: true,
        billableDefault: 0,
        note: null,
      },
    },
    createArgs: ["--name", "New Customer"],
    createExpected: { name: "New Customer" },
    createResult: { data: { id: 10, name: "New Customer", active: true } },
    updateArgs: ["--name", "Updated Name", "--note", "A note"],
    updateExpected: { id: 1, name: "Updated Name", note: "A note" },
    updateResult: { data: { id: 1, name: "Updated Name", note: "A note" } },
  },
  {
    name: "projects",
    register: registerProjectsCommands,
    listMethod: "getProjects" as const,
    getMethod: "getProject" as const,
    addMethod: "addProject" as const,
    editMethod: "editProject" as const,
    deleteMethod: "deleteProject" as const,
    listData: {
      data: [
        { id: 2, name: "Website", number: "P-001", customersId: 1, active: true, completed: false },
      ],
    },
    getData: {
      data: {
        id: 2,
        name: "Website",
        number: "P-001",
        customersId: 1,
        active: true,
        completed: false,
        budget: null,
        note: null,
      },
    },
    createArgs: ["--name", "New Project", "--customer", "1"],
    createExpected: { name: "New Project", customersId: 1 },
    createResult: { data: { id: 20, name: "New Project", customersId: 1, active: true } },
    updateArgs: ["--name", "Updated Project", "--note", "A note"],
    updateExpected: { id: 2, name: "Updated Project", note: "A note" },
    updateResult: { data: { id: 2, name: "Updated Project", note: "A note" } },
  },
  {
    name: "services",
    register: registerServicesCommands,
    listMethod: "getServices" as const,
    getMethod: "getService" as const,
    addMethod: "addService" as const,
    editMethod: "editService" as const,
    deleteMethod: "deleteService" as const,
    listData: { data: [{ id: 3, name: "Development", number: "S-001", active: true }] },
    getData: { data: { id: 3, name: "Development", number: "S-001", active: true, note: null } },
    createArgs: ["--name", "New Service"],
    createExpected: { name: "New Service" },
    createResult: { data: { id: 30, name: "New Service", active: true } },
    updateArgs: ["--name", "Updated Service", "--note", "A note"],
    updateExpected: { id: 3, name: "Updated Service", note: "A note" },
    updateResult: { data: { id: 3, name: "Updated Service", note: "A note" } },
  },
] as const;

describe.each(resources)("$name", ({
  name,
  register,
  listMethod,
  getMethod,
  addMethod,
  editMethod,
  deleteMethod,
  listData,
  getData,
  createArgs,
  createExpected,
  createResult,
  updateArgs,
  updateExpected,
  updateResult,
}) => {
  it("list: returns data array in JSON", async () => {
    client[listMethod].mockResolvedValue(listData);

    const result = await runCommand(register, [name, "list", "--json"]);
    const json = result.parseJson();

    expect(client[listMethod]).toHaveBeenCalledOnce();
    expect(json.data).toBeInstanceOf(Array);
  });

  it("get: calls getter with parsed ID", async () => {
    client[getMethod].mockResolvedValue(getData);

    const result = await runCommand(register, [name, "get", "1", "--json"]);

    expect(client[getMethod]).toHaveBeenCalledWith({ id: 1 });
    expect(result.parseJson().data).toBeDefined();
  });

  it("create: calls add method with required params", async () => {
    client[addMethod].mockResolvedValue(createResult);

    const result = await runCommand(register, [name, "create", ...createArgs, "--json"]);
    const json = result.parseJson();

    expect(client[addMethod]).toHaveBeenCalledWith(expect.objectContaining(createExpected));
    expect(json.data).toBeDefined();
  });

  it("create: passes optional fields when provided", async () => {
    client[addMethod].mockResolvedValue(createResult);

    await runCommand(register, [
      name,
      "create",
      ...createArgs,
      "--number",
      "X-001",
      "--note",
      "Test note",
      "--no-active",
      "--json",
    ]);

    expect(client[addMethod]).toHaveBeenCalledWith(
      expect.objectContaining({
        ...createExpected,
        number: "X-001",
        note: "Test note",
        active: false,
      }),
    );
  });

  it("update: calls edit method with id and provided fields", async () => {
    client[editMethod].mockResolvedValue(updateResult);

    const result = await runCommand(register, [
      name,
      "update",
      String(getData.data.id),
      ...updateArgs,
      "--json",
    ]);
    const json = result.parseJson();

    expect(client[editMethod]).toHaveBeenCalledWith(expect.objectContaining(updateExpected));
    expect(json.data).toBeDefined();
  });

  it("delete: calls delete method with correct id", async () => {
    client[deleteMethod].mockResolvedValue({ success: true });

    const result = await runCommand(register, [name, "delete", "42", "--force", "--json"]);
    const json = result.parseJson();

    expect(client[deleteMethod]).toHaveBeenCalledWith({ id: 42 });
    expect(json.data).toEqual({ success: true, id: 42 });
  });
});

describe("create: requires --name option", () => {
  it.each([
    { name: "customers", register: registerCustomersCommands, args: ["customers"] },
    { name: "services", register: registerServicesCommands, args: ["services"] },
  ])("$name create fails without --name", async ({ register, args }) => {
    await expect(runCommand(register, [...args, "create", "--json"])).rejects.toThrow(
      /required.*--name/i,
    );
  });
});

describe("projects create", () => {
  it("requires --customer option", async () => {
    client.addProject.mockResolvedValue({ data: { id: 1 } });

    await expect(
      runCommand(registerProjectsCommands, ["projects", "create", "--name", "Test", "--json"]),
    ).rejects.toThrow(/required.*--customer/i);
  });
});

describe("customers create: billable flag", () => {
  it("passes Billability.Billable when --billable is set", async () => {
    client.addCustomer.mockResolvedValue({ data: { id: 1, name: "Test" } });

    await runCommand(registerCustomersCommands, [
      "customers",
      "create",
      "--name",
      "Test",
      "--billable",
      "--json",
    ]);

    expect(client.addCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ billableDefault: Billability.Billable }),
    );
  });

  it("passes Billability.NotBillable when --no-billable is set", async () => {
    client.addCustomer.mockResolvedValue({ data: { id: 1, name: "Test" } });

    await runCommand(registerCustomersCommands, [
      "customers",
      "create",
      "--name",
      "Test",
      "--no-billable",
      "--json",
    ]);

    expect(client.addCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ billableDefault: Billability.NotBillable }),
    );
  });
});

describe("projects create: billable flag", () => {
  it("passes billable when --billable is set", async () => {
    client.addProject.mockResolvedValue({ data: { id: 1, name: "Test" } });

    await runCommand(registerProjectsCommands, [
      "projects",
      "create",
      "--name",
      "Test",
      "--customer",
      "1",
      "--billable",
      "--json",
    ]);

    expect(client.addProject).toHaveBeenCalledWith(
      expect.objectContaining({ billableDefault: true }),
    );
  });
});
