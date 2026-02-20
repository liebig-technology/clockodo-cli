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
  },
  {
    name: "projects",
    register: registerProjectsCommands,
    listMethod: "getProjects" as const,
    getMethod: "getProject" as const,
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
  },
  {
    name: "services",
    register: registerServicesCommands,
    listMethod: "getServices" as const,
    getMethod: "getService" as const,
    listData: { data: [{ id: 3, name: "Development", number: "S-001", active: true }] },
    getData: { data: { id: 3, name: "Development", number: "S-001", active: true, note: null } },
  },
] as const;

describe.each(resources)("$name", ({
  name,
  register,
  listMethod,
  getMethod,
  listData,
  getData,
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
});
