import { describe, expect, test } from "bun:test";
import { AGENT_PROCESS, FORGOTTEN_TITLE, RawEvent } from "./analytics";
import { DataSource, EventStore, Preferences, preferencesFromSettings, settingsFromPreferences, updateFrom } from "./source";

class FakeSource implements DataSource {
  platform = "mac" as const;
  version = "test";
  forgotten: number[][] = [];
  constructor(private events: RawEvent[]) {}
  async fetchEvents(): Promise<RawEvent[]> {
    return this.events;
  }
  async fetchApps() {
    return {};
  }
  async loadPreferences(): Promise<Preferences> {
    return { overrides: {}, sharing: "ask", hidden: [], titleRules: [], checkUpdates: true };
  }
  async fetchUpdate() {
    return null;
  }
  async savePreferences() {}
  async forget(ids: number[]) {
    this.forgotten.push(ids);
  }
}

const day = new Date(2026, 8, 24).getTime();
const range = { start: day, end: day + 86_400_000 };

describe("EventStore.forget", () => {
  test("asks the agent to forget the rows and redacts them in the cache", async () => {
    const source = new FakeSource([
      { id: 1, timestamp: day / 1000 + 60, processName: "Arc", windowTitle: "secret" },
      { id: 2, timestamp: day / 1000 + 120, processName: "Arc", windowTitle: "Lectures" },
    ]);
    const store = new EventStore(source);
    await store.ensure(range);
    const before = store.slice(range);

    await store.forget([1]);

    expect(source.forgotten).toEqual([[1]]);
    expect(store.slice(range)).toEqual([
      { id: 1, timestamp: day / 1000 + 60, processName: AGENT_PROCESS, windowTitle: FORGOTTEN_TITLE },
      { id: 2, timestamp: day / 1000 + 120, processName: "Arc", windowTitle: "Lectures" },
    ]);
    expect(before[0].windowTitle).toBe("secret"); // earlier snapshots are not mutated
  });

  test("keeps the cache as it was when the agent refuses", async () => {
    const source = new FakeSource([{ id: 1, timestamp: day / 1000 + 60, processName: "Arc", windowTitle: "secret" }]);
    source.forget = async () => {
      throw new Error("405");
    };
    const store = new EventStore(source);
    await store.ensure(range);
    await expect(store.forget([1])).rejects.toThrow("405");
    expect(store.slice(range)[0].windowTitle).toBe("secret");
  });
});

describe("preferences", () => {
  test("title rules and the update check travel through agent settings", () => {
    const rules = [{ contains: "Lectures", category: "study" as const, scope: "browsers" }];
    const prefs = preferencesFromSettings({ titleRules: [...rules, { contains: "", category: "work", scope: "x" }], checkForUpdates: false }, "mac");
    expect(prefs.titleRules).toEqual(rules);
    expect(prefs.checkUpdates).toBe(false);
    expect(settingsFromPreferences({ titleRules: rules, checkUpdates: true })).toEqual({ titleRules: rules, checkForUpdates: true });
    expect(preferencesFromSettings({}, "mac")).toMatchObject({ titleRules: [], checkUpdates: true });
  });
});

describe("updateFrom", () => {
  test("accepts only a newer version with a link to this project's releases", () => {
    const url = "https://github.com/TempestShaw/Dopamine/releases/tag/v0.0.3";
    expect(updateFrom({ update: { version: "0.0.3", url } })).toEqual({ version: "0.0.3", url });
    expect(updateFrom({ update: { version: "0.0.3", url: "https://evil.example/releases/tag/v0.0.3" } })).toBeNull();
    expect(updateFrom({ update: { version: "0.0.3", url: "https://github.com/TempestShaw/Dopamine/releases/tag/v0.0.3/../../x" } })).toBeNull();
    expect(updateFrom({ update: { version: "<b>", url } })).toBeNull();
    expect(updateFrom({})).toBeNull();
  });
});
