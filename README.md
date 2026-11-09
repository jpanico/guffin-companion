# Guffin Companion

Export the open Roam page — or the zoomed-in block subtree — to **Markdown, PDF, or EPUB**
from Roam's command palette, rendered by [guffin](https://github.com/jpanico/guffin) running
on the same machine.

The extension is a thin client: it POSTs the open page/block's UID, and the name of the graph
it runs in, to a colocated `guffin-server` (guffin's HTTP front end) and hands the rendered
document to the browser's save dialog. One server serves every graph: it finds each graph's
Local API token itself, in Roam's tools registry (`~/.roam-tools.json`), so the extension
never sees, stores, or transmits a token.

## Requirements

1. **guffin** installed on this machine, with **Roam Desktop** running (guffin reads content
   through the Roam Local API, which answers only on the machine running Roam Desktop).
2. **`guffin-server` running with browser admission enabled**:

   ```bash
   guffin-server --allow-origin https://roamresearch.com
   ```

   The server's environment must carry the Local API port (`GUFFIN_ROAM_LOCAL_API_PORT`).
   Without `--allow-origin` the browser blocks this extension's requests — that is the
   server's deliberate default posture, and enabling it is read-side admission only, not
   authentication.
3. **Each graph you use the extension in listed, with its Local API token, in Roam's tools
   registry**, `~/.roam-tools.json` (connecting Roam's MCP server to a graph adds it there; the
   file can also be edited by hand).
   A graph the registry does not list can still be read if it is the server's default graph,
   `GUFFIN_ROAM_GRAPH_NAME`, with its token in `GUFFIN_ROAM_API_TOKEN`.

## Install

Not yet in Roam Depot. Load as a developer extension, in each graph you want it in:

1. Roam Desktop → Settings → **Roam Depot** → enable **developer mode**.
2. **Load extension** → choose this directory.

Every export and dump reads the graph the extension runs in.

## Commands

| Command | What it does |
|---|---|
| Guffin: Export current page/block | Exports using the settings' default format and type |
| Guffin: Export current page/block as Markdown / as PDF / as EPUB | Same, with the format pinned |
| Guffin: Export current page/block with options… | A dialog choosing format, work type, and extra request fields for this export only — settings untouched. The extra fields are pre-seeded from the settings plus `"snapshot": false`, so keeping the export's snapshot on guffin's machine, in the server's export directory, is one edit away (the download is still the document alone), `"preamble": true`, so a single page exported as a `book` keeps its content above the first heading (guffin's book profile otherwise drops it), `"render_alternatives": false`, so showing versioned blocks' alternative wordings (in any format) is one edit away, `"suppress_notes": false`, so leaving the notes out altogether (each marker as its plain lead-in, no footnote, endnote, or Notes section) is one edit away too, and two house choices that are not guffin's defaults: `"numbering": false` (no heading numbers, though a `book` numbers its chapters otherwise) and `"suppress_attributes": true` (no ordinary attribute pills, such as a heading's `tags::`; guffin's own tags still apply) |
| Guffin: Dump current page/block | Shows guffin's diagnostic tree rendering in a styled inspector overlay |
| Guffin: Server health | Toasts the server's version and provenance |

**Right-clicking any block's bullet** adds three more: *Export block subtree*, *Export block
subtree with options…*, and *Dump block subtree* — the clicked block is the target, no
zooming required.

**Right-clicking a page name** — a page title, a `[[page reference]]` inside a block, or a
page link in linked references / query results — offers *Export page*, *Export page with
options…*, and *Dump page* for that page, without navigating to it.

Every export is integrity-checked before saving: the received bytes are hashed
(SHA-256) and compared against the server's RFC 9530 `Content-Digest`; a mismatch shows an
error and saves nothing.

The target is whatever the main window shows: a page exports whole, a zoomed-in block
exports just that subtree. (The scrolling daily-notes view has no single target; the
extension says so rather than guessing.) A Markdown export in bundle mode arrives as a
`.mdbundle.zip` preserving the bundle's layout.

Errors are shown in full: a failed export's overlay carries the complete server-side error
text — the same log lines, gate findings, and traceback a terminal invocation would print.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Server URL | `http://127.0.0.1:8077` | The colocated guffin-server |
| Default export format | `markdown` | `markdown` / `pdf` / `epub` |
| Default work type | `article` | `article` / `book` / `manuscript` / `outline` — `outline` is the article with no title heading, so the source outline renders as authored, every heading at its own level |
| Request timeout (seconds) | `600` | Renders queue server-side and can take minutes |
| Dump width (characters) | `120` | How wide the dump inspector's console rendering wraps |
| Extra export request fields (JSON) | `{}` | Merged into every export request; the full field vocabulary is the server's `/openapi.json` |

## Troubleshooting

- **"server unreachable"** — `guffin-server` isn't running, or was started without
  `--allow-origin https://roamresearch.com`.
- **"no Local API token for graph '…'"** — the graph isn't listed in `~/.roam-tools.json`;
  add it with its Local API token, created in Roam's settings.
- **An extra field naming a token** — the "Extra export request fields" setting can carry
  `api_bearer_token`, which the server uses ahead of the registry, but it then sits in the
  extension's settings; prefer the registry.
- **Export fails with a long error text** — that's guffin's own report (missing Roam
  connection env, semantics-gate violation, code-source drift, render error); read it as you
  would the CLI's output.
- **Timeout on a big book render** — raise the timeout setting; the server executes one
  invocation at a time, so a queued request also waits for the one before it.

## License

MIT
