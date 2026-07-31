# Changelog

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
