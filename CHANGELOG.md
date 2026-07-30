# Changelog

## 0.1.0 — 2026-07-30

Initial MVP.

- Command palette: export the open page/block (default format, or pinned Markdown/PDF/EPUB),
  dump it, and check server health.
- Settings: server URL, default format, default project type, request timeout, extra
  export-request fields (JSON escape hatch).
- Exported documents arrive through the browser save dialog, named by the server's
  `Content-Disposition`; failures show the complete server-side error text in an overlay.
- One invocation at a time client-side, matching the server's serialized execution.
