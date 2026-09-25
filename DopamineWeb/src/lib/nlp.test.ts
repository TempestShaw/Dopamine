import { describe, expect, test } from "bun:test";
import type { Category } from "./categories";
import { categorize, makeClassifier, seedModel, userModel } from "./categories";
import { MIN_CONFIDENCE, tokenize } from "./nlp";

// Titles with no site or app name in them, written apart from the seed examples and never used to
// tune them: how the seed model does on titles it hasn't seen. `null` means "no guess is fine".
const UNSEEN: [string, Category | null][] = [
  ["Week 6 lecture: dynamic programming", "study"],
  ["Chemistry homework due Friday", "study"],
  ["Final exam review session", "study"],
  ["机器学习课程 第五讲", "study"],
  ["高数习题讲解", "study"],
  ["統計學期末考複習", "study"],
  ["Q4 sales report", "work"],
  ["Team meeting agenda", "work"],
  ["Fix payment bug in checkout API", "work"],
  ["季度工作汇报", "work"],
  ["客户需求会议纪要", "work"],
  ["專案週報", "work"],
  ["Group chat with roommates", "social"],
  ["New messages from Alex", "social"],
  ["同学群聊", "social"],
  ["Official trailer 2", "entertainment"],
  ["Episode 12 full", "entertainment"],
  ["周末电影推荐", "entertainment"],
  ["遊戲實況精華", "entertainment"],
  ["New Tab", "other"],
  ["Order confirmation #88213", "other"],
  ["明天天气预报", "other"],
  ["asdf qwerty", null],
];

describe("title model", () => {
  test("Latin words and Chinese character pairs", () => {
    expect(tokenize("Python 零基础入门")).toEqual(["python", "零基", "基础", "础入", "入门"]);
    expect(tokenize("The 3 Best Tutorials")).toEqual(["best", "tutorials"]);
  });

  test("the seed model reads unseen titles well, and is rarely sure and wrong", () => {
    const model = seedModel();
    let right = 0;
    const sureWrong: string[] = [];
    for (const [title, want] of UNSEEN) {
      const g = model.guess(title);
      const got = g && g.p >= MIN_CONFIDENCE ? g.category : null;
      if (got === want || (want === null && got === null)) right++;
      else if (got !== null) sureWrong.push(`${title} → ${got} (want ${want})`);
    }
    if (sureWrong.length) console.log(`title model, confidently wrong:\n  ${sureWrong.join("\n  ")}`);
    expect(right / UNSEEN.length).toBeGreaterThanOrEqual(0.75);
    expect(sureWrong.length).toBeLessThanOrEqual(2);
  });

  test("a lecture on a video site counts as study, other videos stay entertainment", () => {
    expect(categorize("Lecture 3: Sorting algorithms - YouTube - Google Chrome", "chrome")).toBe("study");
    expect(categorize("Python 零基础入门教程_哔哩哔哩_bilibili", "Arc")).toBe("study");
    expect(categorize("(12) lofi hip hop radio - beats to relax/study to - YouTube - Google Chrome", "chrome")).toBe("entertainment");
    expect(categorize("Funny cat compilation - YouTube - Google Chrome", "chrome")).toBe("entertainment");
  });

  test("mixed-use apps are judged by the page, not the app", () => {
    expect(categorize("Lecture notes — Operating Systems", "Notion")).toBe("study");
    expect(categorize("Q3 roadmap", "Notion")).toBe("work");
    expect(categorize("Untitled", "Obsidian")).toBe("other");
  });

  test("sorting one window by hand changes it and teaches similar ones, like a spam filter", () => {
    const title = "Kestrel Bramble";
    expect(categorize(title, "Arc")).toBe("other"); // nothing to go on yet
    const labels = { [title]: "work" } as const;
    const classify = makeClassifier(undefined, {}, {}, {}, userModel(labels, {}, []), labels);
    expect(classify(title, "Arc")).toBe("work");
    expect(classify("Bramble v2", "Arc")).toBe("work"); // learned from the label
  });

  test("a title rule also teaches the words around its keyword", () => {
    const rules = { Kestrel: "study" } as const;
    const model = userModel({}, rules, [["Kestrel reading group notes", "study"]]);
    const classify = makeClassifier(undefined, {}, {}, rules, model);
    expect(classify("Reading group notes, week 2", "Arc")).toBe("study");
  });
});
