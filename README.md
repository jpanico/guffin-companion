# Guffin Companion

Export the open Roam page — or the zoomed-in block subtree — to **Markdown, PDF, or EPUB**
from Roam's command palette, rendered by [guffin](https://github.com/jpanico/guffin) running
on the same machine.

The extension is a thin client: it POSTs the open page/block's UID to a colocated
`guffin-server` (guffin's HTTP front end) and hands the rendered document to the browser's
save dialog. All the Roam connection specifics — Local API port, graph name, bearer token —
live in the *server's* environment; the extension never sees, stores, or transmits the token.

## Requirements

1. **guffin** installed on this machine, with **Roam Desktop** running (guffin reads content
   through the Roam Local API, which answers only on the machine running Roam Desktop).
2. **`guffin-server` running with browser admission enabled**:

   ```bash
   guffin-server --allow-origin https://roamresearch.com
   ```

   The server's environment must carry the Roam connection settings
   (`GUFFIN_ROAM_LOCAL_API_PORT`, `GUFFIN_ROAM_GRAPH_NAME`, `GUFFIN_ROAM_API_TOKEN`).
   Without `--allow-origin` the browser blocks this extension's requests — that is the
   server's deliberate default posture, and enabling it is read-side admission only, not
   authentication.

## Install

Not yet in Roam Depot. Load as a developer extension:

1. Roam Desktop → Settings → **Roam Depot** → enable **developer mode**.
2. **Load extension** → choose this directory.

## Commands

| Command | What it does |
|---|---|
| Guffin: Export current page/block | Exports using the settings' default format and type |
| Guffin: Export current page/block as Markdown / as PDF / as EPUB | Same, with the format pinned |
| Guffin: Dump current page/block | Shows guffin's diagnostic tree rendering in an overlay |
| Guffin: Server health | Toasts the server's version and provenance |

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
| Default project type | `article` | `article` / `book` / `manuscript` |
| Request timeout (seconds) | `600` | Renders queue server-side and can take minutes |
| Extra export request fields (JSON) | `{}` | Merged into every export request; the full field vocabulary is the server's `/openapi.json` |

## Troubleshooting

- **"server unreachable"** — `guffin-server` isn't running, or was started without
  `--allow-origin https://roamresearch.com`.
- **Export fails with a long error text** — that's guffin's own report (missing Roam
  connection env, semantics-gate violation, code-source drift, render error); read it as you
  would the CLI's output.
- **Timeout on a big book render** — raise the timeout setting; the server executes one
  invocation at a time, so a queued request also waits for the one before it.

## License

MIT
