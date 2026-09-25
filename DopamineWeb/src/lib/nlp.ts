// A tiny text classifier for window titles no rule recognises ("机器学习课程 第五讲", "Q4 sales
// report"). Multinomial naive Bayes over words (Latin scripts) and
// character pairs (Chinese, Japanese, Korean), so it needs no word segmenter and no model download.
// It trains in a few milliseconds from the seed examples in category-rules.json plus the user's own
// corrections (labelled windows and title rules). The macOS agent has a line-for-line port
// (TitleModel.swift).
import type { Category } from "./categories";

const CATEGORIES: Category[] = ["work", "study", "social", "entertainment", "other"];

// Words that say nothing about what a window is for.
const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "by", "at", "is", "are", "my", "your", "how", "what", "new"]);

const WORD = /[\p{L}\p{N}][\p{L}\p{N}+#'-]*/gu;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** "Python 零基础入门" → ["python", "零基", "基础", "础入", "入门"]. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.normalize("NFKC").toLowerCase().matchAll(WORD)) {
    // A run can mix scripts ("mv音乐"): split it into Latin words and CJK runs.
    for (const part of m[0].split(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+)/u)) {
      if (!part) continue;
      if (CJK.test(part[0])) {
        // Pairs carry the meaning (网络, 基础); a lone character (网, 的) says little, so it only
        // stands for itself when the run is one character long.
        if (part.length === 1) out.push(part);
        for (let i = 0; i + 1 < part.length; i++) out.push(part.slice(i, i + 2));
      } else {
        const w = part.replace(/['-]+$/, "");
        if (w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w)) out.push(w);
      }
    }
  }
  return out;
}

export interface Guess {
  category: Category;
  /** Posterior probability of `category`, 0…1. */
  p: number;
}

export class TitleModel {
  private counts = new Map<string, number[]>(); // token → count per category
  private totals = CATEGORIES.map(() => 0);

  add(text: string, category: Category, weight = 1) {
    const c = CATEGORIES.indexOf(category);
    for (const tok of tokenize(text)) {
      let row = this.counts.get(tok);
      if (!row) this.counts.set(tok, (row = CATEGORIES.map(() => 0)));
      row[c] += weight;
      this.totals[c] += weight;
    }
  }

  /**
   * The likeliest category, or null when the title shares no word with anything learned.
   * Priors are uniform: a person who watches a lot of video shouldn't make every unknown title
   * look like entertainment.
   */
  guess(text: string): Guess | null {
    const alpha = 0.1;
    const vocab = this.counts.size;
    const scores = CATEGORIES.map(() => 0);
    let known = 0;
    for (const tok of tokenize(text)) {
      const row = this.counts.get(tok);
      if (!row) continue; // unseen everywhere: no evidence either way
      known++;
      for (let c = 0; c < CATEGORIES.length; c++) scores[c] += Math.log((row[c] + alpha) / (this.totals[c] + alpha * vocab));
    }
    if (known === 0) return null;
    const max = Math.max(...scores);
    const exp = scores.map((s) => Math.exp(s - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    let best = 0;
    for (let c = 1; c < CATEGORIES.length; c++) if (exp[c] > exp[best]) best = c;
    return { category: CATEGORIES[best], p: exp[best] / sum };
  }
}

/** How sure the model must be before its guess is used instead of "other". */
export const MIN_CONFIDENCE = 0.6;

/**
 * Seed examples plus what the user taught: each window they labelled counts three times, like a
 * message marked as spam; a rule's keyword counts three times too, and the titles it matched add
 * the words around it.
 */
export function buildTitleModel(
  seed: Partial<Record<Category, string[]>>,
  labels: Record<string, Category> = {},
  rules: Record<string, Category> = {},
  ruledTitles: Iterable<[title: string, category: Category]> = [],
): TitleModel {
  const model = new TitleModel();
  for (const c of CATEGORIES) for (const t of seed[c] ?? []) model.add(t, c);
  for (const [t, c] of Object.entries(labels)) model.add(t, c, 3);
  for (const [k, c] of Object.entries(rules)) model.add(k, c, 3);
  for (const [t, c] of ruledTitles) model.add(t, c);
  return model;
}
