import { beforeEach, describe, expect, it, vi } from "vitest";
import { CliError, ExitCode } from "../../src/lib/errors.js";
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

const { registerUserReportCommands } = await import("../../src/commands/userreports.js");

const fakeUser = {
  id: 42,
  name: "John Doe",
  email: "john@example.com",
  role: "owner",
  active: true,
};

const fakeUserReport = {
  usersId: 42,
  usersName: "John Doe",
  usersNumber: null,
  usersEmail: "john@example.com",
  sumTarget: 604800,
  sumHours: 590400,
  sumReductionUsed: 14400,
  sumReductionPlanned: 0,
  overtimeCarryover: 0,
  overtimeReduced: 0,
  diff: -14400,
  holidaysQuota: 30,
  holidaysCarry: 2,
  sumAbsence: {
    regularHolidays: 10,
    sickSelf: 3,
    sickChild: 0,
    specialLeaves: 0,
    school: 0,
    maternityProtection: 0,
    homeOffice: 5,
    outOfOffice: 0,
    quarantine: 0,
    militaryService: 0,
  },
  monthDetails: [
    {
      nr: 1,
      sumTarget: 50400,
      sumHours: 50400,
      sumHoursWithoutCompensation: 50400,
      sumReductionUsed: 0,
      sumOvertimeReduced: 0,
      diff: 0,
    },
    {
      nr: 2,
      sumTarget: 50400,
      sumHours: 48000,
      sumHoursWithoutCompensation: 48000,
      sumReductionUsed: 0,
      sumOvertimeReduced: 0,
      diff: -2400,
    },
  ],
};

describe("userreport", () => {
  it("calls getMe then getUserReport with own user ID and current year by default", async () => {
    client.getMe.mockResolvedValue({ data: fakeUser });
    client.getUserReport.mockResolvedValue({ userreport: fakeUserReport });

    await runCommand(registerUserReportCommands, ["userreport", "--json"]);

    expect(client.getMe).toHaveBeenCalledOnce();
    expect(client.getUserReport).toHaveBeenCalledWith({
      usersId: 42,
      year: new Date().getFullYear(),
    });
  });

  it("uses --user to skip getMe call", async () => {
    client.getUserReport.mockResolvedValue({ userreport: fakeUserReport });

    await runCommand(registerUserReportCommands, ["userreport", "--user", "99", "--json"]);

    expect(client.getMe).not.toHaveBeenCalled();
    expect(client.getUserReport).toHaveBeenCalledWith({
      usersId: 99,
      year: new Date().getFullYear(),
    });
  });

  it("uses --year to override default year", async () => {
    client.getMe.mockResolvedValue({ data: fakeUser });
    client.getUserReport.mockResolvedValue({ userreport: fakeUserReport });

    await runCommand(registerUserReportCommands, ["userreport", "--year", "2025", "--json"]);

    expect(client.getUserReport).toHaveBeenCalledWith({
      usersId: 42,
      year: 2025,
    });
  });

  it("maps --detail months to type=1", async () => {
    client.getMe.mockResolvedValue({ data: fakeUser });
    client.getUserReport.mockResolvedValue({ userreport: fakeUserReport });

    await runCommand(registerUserReportCommands, ["userreport", "--detail", "months", "--json"]);

    expect(client.getUserReport).toHaveBeenCalledWith({
      usersId: 42,
      year: new Date().getFullYear(),
      type: 1,
    });
  });

  it("maps --detail weeks to type=2", async () => {
    client.getMe.mockResolvedValue({ data: fakeUser });
    client.getUserReport.mockResolvedValue({ userreport: fakeUserReport });

    await runCommand(registerUserReportCommands, ["userreport", "--detail", "weeks", "--json"]);

    expect(client.getUserReport).toHaveBeenCalledWith({
      usersId: 42,
      year: new Date().getFullYear(),
      type: 2,
    });
  });

  it("maps --detail days to type=3", async () => {
    client.getMe.mockResolvedValue({ data: fakeUser });
    client.getUserReport.mockResolvedValue({ userreport: fakeUserReport });

    await runCommand(registerUserReportCommands, ["userreport", "--detail", "days", "--json"]);

    expect(client.getUserReport).toHaveBeenCalledWith({
      usersId: 42,
      year: new Date().getFullYear(),
      type: 3,
    });
  });

  it("throws INVALID_ARGS for unknown detail level", async () => {
    try {
      await runCommand(registerUserReportCommands, [
        "userreport",
        "--user",
        "42",
        "--detail",
        "foobar",
        "--json",
      ]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(ExitCode.INVALID_ARGS);
    }
  });

  it("returns report data in JSON output", async () => {
    client.getMe.mockResolvedValue({ data: fakeUser });
    client.getUserReport.mockResolvedValue({ userreport: fakeUserReport });

    const result = await runCommand(registerUserReportCommands, ["userreport", "--json"]);
    const json = result.parseJson();

    expect((json.data as Record<string, unknown>).usersId).toBe(42);
    expect((json.data as Record<string, unknown>).usersName).toBe("John Doe");
    expect((json.data as Record<string, unknown>).sumTarget).toBe(604800);
    expect((json.data as Record<string, unknown>).sumHours).toBe(590400);
  });
});

describe("userreports", () => {
  it("calls getUserReports with current year by default", async () => {
    client.getUserReports.mockResolvedValue({
      userreports: [fakeUserReport],
    });

    await runCommand(registerUserReportCommands, ["userreports", "--json"]);

    expect(client.getUserReports).toHaveBeenCalledWith({
      year: new Date().getFullYear(),
    });
  });

  it("uses --year to override default year", async () => {
    client.getUserReports.mockResolvedValue({
      userreports: [fakeUserReport],
    });

    await runCommand(registerUserReportCommands, ["userreports", "--year", "2024", "--json"]);

    expect(client.getUserReports).toHaveBeenCalledWith({ year: 2024 });
  });

  it("returns array of reports in JSON output", async () => {
    client.getUserReports.mockResolvedValue({
      userreports: [fakeUserReport],
    });

    const result = await runCommand(registerUserReportCommands, ["userreports", "--json"]);
    const json = result.parseJson();

    expect(json.data).toBeInstanceOf(Array);
    const reports = json.data as Array<Record<string, unknown>>;
    expect(reports).toHaveLength(1);
    expect(reports[0]?.usersName).toBe("John Doe");
    expect((json.meta as Record<string, unknown>).count).toBe(1);
  });

  it("handles empty reports array", async () => {
    client.getUserReports.mockResolvedValue({ userreports: [] });

    const result = await runCommand(registerUserReportCommands, ["userreports", "--json"]);
    const json = result.parseJson();

    expect(json.data).toBeInstanceOf(Array);
    expect(json.data).toHaveLength(0);
    expect((json.meta as Record<string, unknown>).count).toBe(0);
  });
});
