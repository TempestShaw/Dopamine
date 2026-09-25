import { afterEach, describe, expect, test } from "bun:test";
import { DICTS } from "./i18n";
import { localeFromTag } from "./locale";
import { defaultHidden, hiddenKey, preferencesFromSettings, settingsFromPreferences } from "./source";
import { formatDuration, setTimeLocale } from "./time";

describe("language", () => {
  afterEach(() => setTimeLocale("en"));

  test("browser tags map to Simplified or Traditional Chinese", () => {
    expect(localeFromTag("zh-CN")).toBe("zh-CN");
    expect(localeFromTag("zh-SG")).toBe("zh-CN");
    expect(localeFromTag("zh")).toBe("zh-CN");
    expect(localeFromTag("zh-Hans-HK")).toBe("zh-CN");
    expect(localeFromTag("zh-TW")).toBe("zh-TW");
    expect(localeFromTag("zh-HK")).toBe("zh-TW");
    expect(localeFromTag("zh-Hant")).toBe("zh-TW");
    expect(localeFromTag("en-GB")).toBe("en");
    expect(localeFromTag("de-DE")).toBeNull();
  });

  test("durations use Chinese units", () => {
    const m = 60_000;
    setTimeLocale("zh-CN");
    expect(formatDuration(192 * m)).toBe("3小时12分");
    expect(formatDuration(45 * m)).toBe("45分钟");
    expect(formatDuration(30_000)).toBe("30秒");
    setTimeLocale("zh-TW");
    expect(formatDuration(120 * m)).toBe("2小時");
    expect(formatDuration(5 * m)).toBe("5分鐘");
    setTimeLocale("en");
    expect(formatDuration(192 * m)).toBe("3h 12m");
  });

  test("every language has every note", () => {
    const msg = { kind: "focusDelta", amount: "1h", more: true, view: "day" } as const;
    for (const d of Object.values(DICTS)) expect(d.insight(msg).length).toBeGreaterThan(3);
  });
});

describe("hidden apps", () => {
  test("Dopamine itself is hidden until the user changes the list", () => {
    expect(preferencesFromSettings({}, "windows").hidden).toEqual(["DopamineWin"]);
    expect(preferencesFromSettings({}, "mac").hidden).toEqual(defaultHidden("mac"));
    expect(preferencesFromSettings({ hiddenApps: [] }, "mac").hidden).toEqual([]);
    expect(preferencesFromSettings({ hiddenApps: ["Steam", 3, ""] }, "mac").hidden).toEqual(["Steam"]);
    expect(settingsFromPreferences({ hidden: ["Steam"] })).toEqual({ hiddenApps: ["Steam"] });
  });

  test("names match regardless of case and .exe", () => {
    expect(hiddenKey("DopamineWin.exe")).toBe(hiddenKey("dopaminewin"));
  });
});
