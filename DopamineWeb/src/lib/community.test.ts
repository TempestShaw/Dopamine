import { describe, expect, test } from "bun:test";
import { categorize, makeClassifier } from "./categories";
import { communityAvailable, isShareable, votePayload } from "./community";

describe("community sharing", () => {
  test("a shared choice contains only the app, category, platform and install id", () => {
    expect(Object.keys(votePayload("id", "Balatro", "mac", "entertainment")).sort()).toEqual(["p_app", "p_category", "p_install", "p_platform"]);
    expect(Object.keys(votePayload("id", "Balatro", "mac", null)).sort()).toEqual(["p_app", "p_install", "p_platform"]);
  });

  test("browser choices are never shared", () => {
    expect(isShareable("chrome")).toBe(false);
    expect(isShareable("Google Chrome")).toBe(false);
    expect(isShareable("Balatro")).toBe(true);
  });

  test("nothing is sent while no backend is configured", () => {
    expect(communityAvailable()).toBe(false);
  });

  test("community categories fill gaps but never relabel apps our rules know", () => {
    const community = { Balatro: "entertainment" as const, Code: "entertainment" as const };
    expect(categorize("Balatro", "Balatro", undefined, community)).toBe("entertainment");
    expect(categorize("main.ts", "Code", undefined, community)).toBe("work");
  });

  test("the user's own choice beats the community", () => {
    const classify = makeClassifier(undefined, { Balatro: "study" }, { Balatro: "entertainment" });
    expect(classify("Balatro", "Balatro")).toBe("study");
  });
});
