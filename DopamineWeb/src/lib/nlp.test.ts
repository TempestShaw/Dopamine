import { describe, expect, test } from "bun:test";
import { categorize, makeClassifier, userModel } from "./categories";
import { tokenize } from "./nlp";

describe("title model", () => {
  test("Latin words and Chinese character pairs", () => {
    expect(tokenize("Python 零基础入门")).toEqual(["python", "零基", "基础", "础入", "入门"]);
    expect(tokenize("The 3 Best Tutorials")).toEqual(["best", "tutorials"]);
  });

  // Tabs from a real Arc session: page titles with no site name in them.
  test.each([
    ["教你网络基础", "study"],
    ["建立測試版本", "work"],
    ["Celery實務比較", "work"],
    ["HermesEngine | Quantitative Trading Platform", "work"],
    ["特厨探店｜最擅长做鲍鱼的餐厅？！阿一鲍鱼！_哔哩哔哩_bilibili", "entertainment"],
    ["仪表板", "other"],
  ] as const)("Arc | %s → %s", (title, expected) => {
    expect(categorize(title, "Arc")).toBe(expected);
  });

  test("a lecture on a video site counts as study, other videos don't", () => {
    expect(categorize("CS50 2024 - Lecture 3 - Algorithms - YouTube - Google Chrome", "chrome")).toBe("study");
    expect(categorize("Python 零基础入门教程_哔哩哔哩_bilibili", "Arc")).toBe("study");
    expect(categorize("(12) lofi hip hop radio - beats to relax/study to - YouTube - Google Chrome", "chrome")).toBe("entertainment");
  });

  test("a title rule teaches the words around its keyword", () => {
    const rules = { Hermes: "study" } as const;
    const model = userModel(rules, [["Hermes backtesting notes", "study"], ["Hermes order book simulator", "study"]]);
    const classify = makeClassifier(undefined, {}, {}, rules, model);
    expect(classify("Hermes order book simulator", "Arc")).toBe("study"); // the rule itself
    expect(classify("Order book simulator v2", "Arc")).toBe("study"); // learned from the rule's windows
  });
});
