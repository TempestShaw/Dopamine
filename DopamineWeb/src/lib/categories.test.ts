import { describe, expect, test } from "bun:test";
import { CORPUS } from "./__fixtures__/categorize-corpus";
import { HOLDOUT } from "./__fixtures__/categorize-holdout";
import { appHaystack, categorize, makeClassifier } from "./categories";
import { SWIFT_RULES_PATH, renderSwiftRules } from "../../scripts/sync-rules";

describe("categorize", () => {
  test.each(CORPUS.map((k) => [k.process, k.title, k.expected, k] as const))("%s | %s → %s", (_p, _t, expected, k) => {
    expect(categorize(k.title, k.process, k.hint)).toBe(expected);
  });

  test("held-out accuracy stays above 85%", () => {
    const misses = HOLDOUT.filter((k) => categorize(k.title, k.process, k.hint) !== k.expected);
    const accuracy = 1 - misses.length / HOLDOUT.length;
    if (misses.length) console.log(`held-out misses:\n${misses.map((k) => `  ${k.process} | ${k.title} (want ${k.expected})`).join("\n")}`);
    expect(accuracy).toBeGreaterThanOrEqual(0.85);
  });

  test("process names are split so rules can use plain words", () => {
    expect(appHaystack("idea64")).toContain("idea 64");
    expect(appHaystack("LeagueClientUx")).toContain("league client ux");
    expect(appHaystack("VALORANT-Win64-Shipping")).toContain("valorant win 64 shipping");
  });
});

describe("shared rules", () => {
  test("the macOS agent embeds the same rules (run `bun run sync-rules`)", async () => {
    const json = await Bun.file(new URL("./category-rules.json", import.meta.url)).text();
    expect(await Bun.file(SWIFT_RULES_PATH).text()).toBe(renderSwiftRules(json));
  });
});

describe("makeClassifier", () => {
  test("a user's choice wins over detection", () => {
    const classify = makeClassifier(undefined, { Discord: "study" });
    expect(classify("#general", "Discord")).toBe("study");
    expect(classify("#general", "Slack")).toBe("work");
  });

  test("hints from the agent classify unknown apps", () => {
    const classify = makeClassifier((p) => (p === "Balatro" ? { kind: "public.app-category.card-games" } : undefined));
    expect(classify("Balatro", "Balatro")).toBe("entertainment");
  });
});
