# Changelog

## 0.4.3 — 2026-10-15

- The export-options dialog also pre-seeds `"suppress_notes": false` among its extra request
  fields. It is guffin's default, seeded so the option is visible and one edit away: set to
  `true`, the export leaves its notes out altogether, in every format and project type — each
  note marker reads as its plain lead-in, no footnote, endnote, or Notes section appears, and no
  note check runs, so a draft with unfinished notes exports. A guffin server older than commit
  `ac60ce0` rejects the unknown field with a 400.

## 0.4.2 — 2026-10-12

- The export-options dialog also pre-seeds `"render_alternatives": false` among its extra request
  fields. It is guffin's default, seeded so the option is visible and one edit away: set to
  `true`, a PDF export shows each versioned block's alternative wordings beside its selected one
  (guffin's EPUB and Markdown renderers don't present them yet, and warn). A guffin server older
  than commit `d73721e` rejects the unknown field with a 400; `2ac342d` is the first that renders
  alternatives.

## 0.4.1 — 2026-10-09

- The export-options dialog pre-seeds its extra request fields with `"preamble": true` on top
  of the settings' extra fields (the settings win on conflict). Guffin's `book` profile drops a
  root's loose preamble — the blocks ahead of its first heading — so a chapter page exported on
  its own as a book lost its epigraph; the dialog, being where single pages get exported, now
  keeps it by default. The plain export commands are unchanged.

## 0.4.0 — 2026-07-30

- Page context menus: right-clicking a page title, a `[[page reference]]` inside a block, or
  a page link in linked references / query results offers *Export page*, *Export page with
  options…*, and *Dump page* for that page — no navigation required. A menu surface absent
  from the running Roam build is skipped.

## 0.3.0 — 2026-07-30

- The dump commands now render guffin's console output as styled HTML in a sandboxed
  inspector overlay (wrap width settable via the new *Dump width* setting) instead of plain
  text.
- Right-click block context menu: *Export block subtree*, *Export block subtree with
  options…*, and *Dump block subtree* target the clicked block without zooming.
- Exports are integrity-verified before saving: the received bytes' SHA-256 is compared
  against the server's `Content-Digest`; a mismatch shows an error and saves nothing.

## 0.2.0 — 2026-07-30

- New command *Guffin: Export current page/block with options…* — a dialog choosing format,
  project type, and extra request fields for a single export, pre-seeded from the settings
  and leaving them untouched.
- Project-type vocabulary follows guffin's rename: `article` (formerly `default`).

## 0.1.0 — 2026-07-30

Initial MVP.

- Command palette: export the open page/block (default format, or pinned Markdown/PDF/EPUB),
  dump it, and check server health.
- Settings: server URL, default format, default project type, request timeout, extra
  export-request fields (JSON escape hatch).
- Exported documents arrive through the browser save dialog, named by the server's
  `Content-Disposition`; failures show the complete server-side error text in an overlay.
- One invocation at a time client-side, matching the server's serialized execution.
