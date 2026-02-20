import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockClient, type MockClockodo } from "../helpers/mock-client.js";

vi.mock("../../src/lib/client.js");
vi.mock("../../src/lib/config.js");
vi.mock("@clack/prompts");

let client: MockClockodo;

beforeEach(async () => {
  vi.resetAllMocks();
  client = createMockClient();
  const { getClient } = await import("../../src/lib/client.js");
  vi.mocked(getClient).mockReturnValue(client as unknown as ReturnType<typeof getClient>);

  const config = await import("../../src/lib/config.js");
  vi.mocked(config.getConfigValue).mockReturnValue(undefined);
});

const p = await import("@clack/prompts");
const { selectCustomerProjectService, shouldPrompt } = await import("../../src/lib/prompts.js");

const fakeCustomers = [
  { id: 1, name: "Acme Corp", active: true },
  { id: 2, name: "Beta Inc", active: true },
];

const fakeProjects = [
  { id: 10, name: "Website", customersId: 1, active: true },
  { id: 11, name: "API", customersId: 1, active: true },
];

const fakeServices = [
  { id: 100, name: "Development", active: true },
  { id: 101, name: "Design", active: true },
];

describe("selectCustomerProjectService", () => {
  it("returns selected customer, project, and service IDs", async () => {
    client.getCustomers.mockResolvedValue({ data: fakeCustomers });
    client.getProjects.mockResolvedValue({ data: fakeProjects });
    client.getServices.mockResolvedValue({ data: fakeServices });

    vi.mocked(p.select)
      .mockResolvedValueOnce(1) // customer
      .mockResolvedValueOnce(10) // project
      .mockResolvedValueOnce(100); // service

    const result = await selectCustomerProjectService();

    expect(result).toEqual({
      customersId: 1,
      projectsId: 10,
      servicesId: 100,
    });
  });

  it("fetches projects filtered by selected customer", async () => {
    client.getCustomers.mockResolvedValue({ data: fakeCustomers });
    client.getProjects.mockResolvedValue({ data: fakeProjects });
    client.getServices.mockResolvedValue({ data: fakeServices });

    vi.mocked(p.select)
      .mockResolvedValueOnce(1) // customer
      .mockResolvedValueOnce(10) // project
      .mockResolvedValueOnce(100); // service

    await selectCustomerProjectService();

    const projectsCallArgs = client.getProjects.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(projectsCallArgs).toEqual(
      expect.objectContaining({
        filter: expect.objectContaining({ customersId: 1 }),
      }),
    );
  });

  it("handles 'no project' selection", async () => {
    client.getCustomers.mockResolvedValue({ data: fakeCustomers });
    client.getProjects.mockResolvedValue({ data: fakeProjects });
    client.getServices.mockResolvedValue({ data: fakeServices });

    vi.mocked(p.select)
      .mockResolvedValueOnce(1) // customer
      .mockResolvedValueOnce(0) // no project (sentinel value)
      .mockResolvedValueOnce(100); // service

    const result = await selectCustomerProjectService();

    expect(result.projectsId).toBeUndefined();
  });

  it("returns null on cancel", async () => {
    client.getCustomers.mockResolvedValue({ data: fakeCustomers });

    const cancelSymbol = Symbol("cancel");
    vi.mocked(p.select).mockResolvedValueOnce(cancelSymbol);
    vi.mocked(p.isCancel).mockReturnValue(true);

    const result = await selectCustomerProjectService();

    expect(result).toBeNull();
  });
});

describe("shouldPrompt", () => {
  it("returns false when noInput is set", () => {
    expect(shouldPrompt({ noInput: true }, "human")).toBe(false);
  });

  it("returns false in non-human output mode", () => {
    expect(shouldPrompt({}, "json")).toBe(false);
    expect(shouldPrompt({}, "plain")).toBe(false);
  });
});
