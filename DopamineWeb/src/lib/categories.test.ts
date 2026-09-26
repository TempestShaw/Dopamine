import { describe, expect, test } from "bun:test";
import { CORPUS } from "./__fixtures__/categorize-corpus";
import { HOLDOUT } from "./__fixtures__/categorize-holdout";
import { BROWSER_SCOPE, TitleRule, appHaystack, categorize, makeClassifier, sanitizeTitleRules, titleRuleFor } from "./categories";
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

  test("keywords match their plural", () => {
    expect(categorize("15-445/645 F'26 Lectures", "Arc")).toBe("study");
    expect(categorize("Assignments", "Arc")).toBe("study");
    expect(categorize("Barcodes explained - Google Chrome", "chrome")).toBe("other"); // still whole words
  });

  test("course codes count as study", () => {
    expect(categorize("15-445/645 F'26", "Arc")).toBe("study");
    expect(categorize("CS 61A Fall 2026 - Google Chrome", "chrome")).toBe("study");
    expect(categorize("math2210 notes", "Safari")).toBe("study");
    expect(categorize("Order 12-345678 shipped - Google Chrome", "chrome")).toBe("other");
    expect(categorize("2026-09-26 - Google Chrome", "chrome")).toBe("other");
  });

  test("process names are split so rules can use plain words", () => {
    expect(appHaystack("idea64")).toContain("idea 64");
    expect(appHaystack("LeagueClientUx")).toContain("league client ux");
    expect(appHaystack("VALORANT-Win64-Shipping")).toContain("valorant win 64 shipping");
  });
});

describe("title rules", () => {
  test("found by case-insensitive substring within their scope", () => {
    const rules: TitleRule[] = [{ contains: "Lectures", category: "study", scope: BROWSER_SCOPE }];
    expect(titleRuleFor(rules, "15-445 LECTURES", "Arc")?.category).toBe("study");
    expect(titleRuleFor(rules, "15-445 LECTURES", "Preview")).toBeUndefined();
  });

  test("bad rules from the agent are dropped", () => {
    expect(
      sanitizeTitleRules([
        { contains: " Lectures ", category: "study", scope: "browsers" },
        { contains: "", category: "study", scope: "browsers" },
        { contains: "x", category: "nope", scope: "browsers" },
        { contains: "x", category: "work" },
        "junk",
      ]),
    ).toEqual([{ contains: "Lectures", category: "study", scope: "browsers" }]);
    expect(sanitizeTitleRules(undefined)).toEqual([]);
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

  test("a title rule beats the app choice, and the longest matching rule wins", () => {
    const rules: TitleRule[] = [
      { contains: "bilibili", category: "entertainment", scope: BROWSER_SCOPE },
      { contains: "15-213 lecture", category: "study", scope: BROWSER_SCOPE },
      { contains: "readme", category: "study", scope: "Code" },
    ];
    const classify = makeClassifier(undefined, { Arc: "social", Code: "other" }, {}, rules);
    expect(classify("15-213 Lecture 5 - bilibili", "Arc")).toBe("study");
    expect(classify("凡人修仙传 - bilibili", "Google Chrome")).toBe("entertainment"); // every browser
    expect(classify("Team Discussions", "Arc")).toBe("social"); // no rule: the app choice
    expect(classify("README.md — dopamine", "Code.app")).toBe("study"); // same app, other spelling
    expect(classify("README.md — dopamine", "Zed")).toBe("work"); // rule is limited to Code
  });

  test("hints from the agent classify unknown apps", () => {
    const classify = makeClassifier((p) => (p === "Balatro" ? { kind: "public.app-category.card-games" } : undefined));
    expect(classify("Balatro", "Balatro")).toBe("entertainment");
  });
});
