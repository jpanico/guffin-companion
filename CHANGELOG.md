# Changelog

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
