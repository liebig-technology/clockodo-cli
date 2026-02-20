import { vi } from "vitest";

/** All Clockodo SDK methods used by the CLI */
const METHODS = [
  "getClock",
  "startClock",
  "stopClock",
  "getEntries",
  "getEntry",
  "addEntry",
  "editEntry",
  "deleteEntry",
  "getEntryGroups",
  "getCustomers",
  "getCustomer",
  "getProjects",
  "getProject",
  "getServices",
  "getService",
  "getMe",
  "getUsers",
  "getAbsence",
  "getAbsences",
  "addAbsence",
  "editAbsence",
  "deleteAbsence",
  "getWorkTimes",
  "getUserReport",
  "getUserReports",
] as const;

type MockedMethod = ReturnType<typeof vi.fn>;

export type MockClockodo = {
  [K in (typeof METHODS)[number]]: MockedMethod;
};

/** Create a mock Clockodo client with vi.fn() stubs for every method the CLI uses */
export function createMockClient(): MockClockodo {
  const mock = {} as MockClockodo;
  for (const method of METHODS) {
    mock[method] = vi.fn();
  }
  return mock;
}
