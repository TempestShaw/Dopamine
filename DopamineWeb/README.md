# Dopamine dashboard

The dashboard the Dopamine agents serve at `http://localhost:26535`. It is a static Next.js export
built into the macOS app and the Windows exe; nothing is hosted anywhere else. It reads your
activity from the agent on your own computer.

```bash
bun install
bun dev            # http://localhost:3000, finds a running agent or offers sample data
bun test src       # unit tests
bun run build      # static export in out/, picked up by the agent builds
bun run preview    # one self-contained HTML file with sample data, for sharing the UI
bun run sync-rules # after editing src/lib/category-rules.json (the macOS agent embeds it)
```
