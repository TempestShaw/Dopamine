import { describe, expect, test } from "bun:test";
import { AGENT_PROCESS, MAX_SEGMENT, RawEvent, bucketize, buildSegments, buildSessions, hourEdges, longestFocus, summarize } from "./analytics";
import { categorize, cleanTitle } from "./categories";
import { MINUTE } from "./time";

const day = new Date(2026, 8, 24).getTime(); // local midnight
const at = (h: number, m = 0) => (day + h * 3_600_000 + m * MINUTE) / 1000;
let nextId = 1;
const ev = (ts: number, processName: string, windowTitle = ""): RawEvent => ({ id: nextId++, timestamp: ts, processName, windowTitle });
const range = { start: day, end: day + 86_400_000 };
const later = day + 3 * 86_400_000;

describe("buildSegments", () => {
  test("each event lasts until the next one, markers end a segment", () => {
    const segs = buildSegments(
      [ev(at(9), "Code", "a.ts"), ev(at(9, 30), "chrome", "YouTube - Google Chrome"), ev(at(10), AGENT_PROCESS, "<Stopped>"), ev(at(11), "Code", "b.ts")],
      range,
      at(11, 15) * 1000,
    );
    expect(segs.map((s) => [s.app, (s.end - s.start) / MINUTE, s.category])).toEqual([
      ["VS Code", 30, "work"],
      ["Chrome", 30, "entertainment"],
      ["VS Code", 15, "work"],
    ]);
    expect(segs[1].title).toBe("YouTube");
  });

  test("clips to the range and caps runaway segments", () => {
    const segs = buildSegments([ev(at(-1), "Code"), ev(at(23), "Code")], range, later);
    expect(segs[0].start).toBe(day);
    expect(segs[0].end).toBe(day + 3_600_000);
    expect(segs[1].end - segs[1].start).toBe(Math.min(MAX_SEGMENT, 3_600_000));
  });

  test("the open-ended last event runs until now", () => {
    const segs = buildSegments([ev(at(9), "Code")], range, at(9, 20) * 1000);
    expect(segs[0].end - segs[0].start).toBe(20 * MINUTE);
  });
});

describe("summaries", () => {
  const segs = buildSegments(
    [
      ev(at(9), "Code", "a.ts"),
      ev(at(9, 50), "Discord", "chat"),
      ev(at(9, 51), "Code", "a.ts"),
      ev(at(10, 30), "Discord", "chat"),
      ev(at(10, 45), "Code", "b.ts"),
      ev(at(11), AGENT_PROCESS, "<Stopped>"),
    ],
    range,
    later,
  );

  test("totals by category and app", () => {
    const s = summarize(segs, range);
    expect(s.total).toBe(120 * MINUTE);
    expect(s.byCategory.work).toBe(104 * MINUTE);
    expect(s.byCategory.social).toBe(16 * MINUTE);
    expect(s.apps[0].app).toBe("VS Code");
    expect(s.apps[0].titles[0]).toMatchObject({ title: "a.ts", total: 89 * MINUTE });
    expect(s.switches).toBe(4);
  });

  test("focus blocks tolerate short detours only", () => {
    const f = longestFocus(segs)!;
    expect(f.start).toBe(at(9) * 1000);
    expect(f.focused).toBe(89 * MINUTE);
  });

  test("hour buckets split segments across hours", () => {
    const b = bucketize(segs, hourEdges(day));
    expect(b[9].total).toBe(60 * MINUTE);
    expect(b[10].byCategory.social).toBe(15 * MINUTE);
    expect(b[10].total).toBe(60 * MINUTE);
  });

  test("sessions merge same-app runs, newest first", () => {
    const s = buildSessions(segs);
    expect(s.map((x) => x.app)).toEqual(["VS Code", "Discord", "VS Code", "Discord", "VS Code"]);
  });
});

describe("categories", () => {
  test("site keywords win over the browser", () => {
    expect(categorize("Pull requests · GitHub - Google Chrome", "chrome")).toBe("work");
    expect(categorize("Bilibili - Google Chrome", "chrome")).toBe("entertainment");
    expect(categorize("New Tab - Google Chrome", "chrome")).toBe("other");
    expect(categorize("Lecture.pdf", "Preview")).toBe("study");
  });

  test("titles are cleaned", () => {
    expect(cleanTitle("Docs - Personal - Microsoft\u200b Edge", "msedge")).toBe("Docs");
    expect(cleanTitle("C:\\Users\\me\\notes.txt", "notepad")).toBe("notes.txt");
    expect(cleanTitle("", "Finder")).toBe("Finder");
  });
});
