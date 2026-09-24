// Embeds src/lib/category-rules.json into the macOS agent so both classify apps the same way.
//   bun run sync-rules          (a test fails if this is forgotten)
import { join } from "node:path";

const root = join(import.meta.dir, "..");
export const SWIFT_RULES_PATH = join(root, "../DopamineMac/Sources/DopamineMac/CategoryRules.swift");

export function renderSwiftRules(json: string): string {
  return `// Generated from DopamineWeb/src/lib/category-rules.json by \`bun run sync-rules\`. Do not edit.

let categoryRulesJSON = #"""
${json.trim()}
"""#
`;
}

if (import.meta.main) {
  const json = await Bun.file(join(root, "src/lib/category-rules.json")).text();
  await Bun.write(SWIFT_RULES_PATH, renderSwiftRules(json));
  console.log(`✓ wrote ${SWIFT_RULES_PATH}`);
}
