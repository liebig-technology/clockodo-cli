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

const { registerUsersCommands } = await import("../../src/commands/users.js");

const fakeUser = {
  id: 1,
  name: "John Doe",
  email: "john@example.com",
  role: "admin",
  active: true,
};

describe("users me", () => {
  it("returns user data in JSON", async () => {
    client.getMe.mockResolvedValue({ data: fakeUser });

    const result = await runCommand(registerUsersCommands, ["users", "me", "--json"]);
    const json = result.parseJson();

    expect(client.getMe).toHaveBeenCalledOnce();
    expect((json.data as Record<string, unknown>).name).toBe("John Doe");
  });
});

describe("users list", () => {
  it("returns users array in JSON", async () => {
    client.getUsers.mockResolvedValue({ data: [fakeUser] });

    const result = await runCommand(registerUsersCommands, ["users", "list", "--json"]);
    const json = result.parseJson();

    expect(client.getUsers).toHaveBeenCalledOnce();
    expect(json.data).toBeInstanceOf(Array);
  });
});
