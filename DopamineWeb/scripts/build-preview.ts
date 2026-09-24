// Bundles the dashboard into one self-contained HTML file that opens on sample data.
// Useful for sharing the UI without installing an agent:  bun run preview
import { $ } from "bun";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const outDir = join(root, "preview");
await mkdir(outDir, { recursive: true });

const js = await Bun.build({
  entrypoints: [join(root, "src/preview.tsx")],
  target: "browser",
  format: "esm",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!js.success) {
  console.error(js.logs.join("\n"));
  process.exit(1);
}
const script = (await js.outputs[0].text()).replaceAll("</script", "<\\/script");

const cssFile = join(outDir, ".preview.css");
await $`bunx @tailwindcss/cli -i ${join(root, "src/app/globals.css")} -o ${cssFile} --minify`.cwd(root).quiet();
const css = await Bun.file(cssFile).text();
await $`rm -f ${cssFile}`;

const theme = `try{var t=localStorage.getItem("dopamine.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

const html = `<title>Dopamine</title>
<meta name="description" content="Dopamine screen-time dashboard with sample data">
<style>${css}</style>
<div id="root"></div>
<script>${theme}</script>
<script type="module">${script}</script>
`;

const out = join(outDir, "dopamine-preview.html");
await Bun.write(out, html);
console.log(`✓ ${out} (${(html.length / 1024).toFixed(0)} KB)`);
