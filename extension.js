/* Guffin Companion — invoke guffin exports and dumps from inside Roam.
 *
 * A thin client of a colocated guffin-server (https://github.com/jpanico/guffin): command
 * palette entries POST the open page or zoomed block's UID to the server's loopback HTTP
 * endpoints and hand back the rendered document through the browser's save flow. All Roam
 * connection specifics (Local API port, graph, bearer token) live in the *server's*
 * environment — this extension never sees them.
 */

const DEFAULT_SERVER_URL = "http://127.0.0.1:8077";
const DEFAULT_TIMEOUT_SECONDS = 600; // renders can take minutes, and the server queues invocations
const HEALTH_TIMEOUT_SECONDS = 10;
const EXPORT_FORMATS = ["markdown", "pdf", "epub"];
const PROJECT_TYPES = ["article", "book", "manuscript"];

const SETTING_SERVER_URL = "server-url";
const SETTING_DEFAULT_FORMAT = "default-format";
const SETTING_DEFAULT_TYPE = "default-type";
const SETTING_TIMEOUT_SECONDS = "timeout-seconds";
const SETTING_EXTRA_FIELDS = "extra-fields";
const SETTING_DUMP_WIDTH = "dump-width";
const DEFAULT_DUMP_WIDTH = 120;

const NO_TARGET_MESSAGE =
  "Open a page or zoom into a block first — the scrolling daily-notes view has no single export target.";

/* The module object outlives an unload/load cycle (Roam re-imports a cached module), so this
 * state is shared across loads. Nothing here may be a registry that onunload drains: the
 * command set is the fixed COMMANDS list below, and onunload never nulls extensionAPI — a
 * stale unload arriving after a fresh load must not disable the live one. */
const state = {
  extensionAPI: null,
  activeCommand: null,
  activeAbort: null,
  overlay: null,
  overlayKeydown: null,
  toasts: [],
};

/* ---------------------------------------------------------------- settings */

function setting(key, fallback) {
  const value = state.extensionAPI.settings.get(key);
  return value === null || value === undefined || value === "" ? fallback : value;
}

function serverUrl() {
  return String(setting(SETTING_SERVER_URL, DEFAULT_SERVER_URL)).replace(/\/+$/, "");
}

function timeoutSeconds() {
  const parsed = Number.parseFloat(setting(SETTING_TIMEOUT_SECONDS, DEFAULT_TIMEOUT_SECONDS));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_SECONDS;
}

function dumpWidth() {
  const parsed = Number.parseInt(setting(SETTING_DUMP_WIDTH, DEFAULT_DUMP_WIDTH), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DUMP_WIDTH;
}

function parsedExtraFields() {
  const raw = String(setting(SETTING_EXTRA_FIELDS, "")).trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("must be a JSON object");
    }
    return parsed;
  } catch (err) {
    throw new Error(`The "Extra export request fields" setting is not a JSON object: ${err.message}`);
  }
}

/* ---------------------------------------------------------------------- UI */

function element(tag, cssText, props = {}) {
  const node = document.createElement(tag);
  node.style.cssText = cssText;
  Object.assign(node, props);
  return node;
}

function toast(message, milliseconds = 5000) {
  const node = element(
    "div",
    "position:fixed;right:16px;bottom:" +
      (16 + state.toasts.length * 44) +
      "px;z-index:2000;background:#1f2937;color:#f9fafb;padding:10px 14px;border-radius:6px;" +
      "font-size:13px;max-width:420px;box-shadow:0 2px 8px rgba(0,0,0,.35);",
    { textContent: message }
  );
  document.body.appendChild(node);
  state.toasts.push(node);
  window.setTimeout(() => {
    node.remove();
    state.toasts = state.toasts.filter((existing) => existing !== node);
  }, milliseconds);
}

function closeOverlay() {
  if (state.overlayKeydown) {
    document.removeEventListener("keydown", state.overlayKeydown);
    state.overlayKeydown = null;
  }
  if (state.overlay) {
    state.overlay.remove();
    state.overlay = null;
  }
}

function openOverlay(title) {
  closeOverlay();
  const backdrop = element(
    "div",
    "position:fixed;inset:0;z-index:1999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;"
  );
  const panel = element(
    "div",
    "background:#fff;color:#111827;border-radius:8px;max-width:min(880px,90vw);max-height:80vh;display:flex;" +
      "flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.4);"
  );
  const header = element(
    "div",
    "display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e5e7eb;"
  );
  header.appendChild(element("strong", "font-size:14px;", { textContent: title }));
  const close = element(
    "button",
    "border:none;background:none;font-size:18px;cursor:pointer;color:#6b7280;padding:0 4px;",
    { textContent: "×", onclick: closeOverlay, title: "Close (Esc)" }
  );
  header.appendChild(close);
  panel.appendChild(header);
  backdrop.appendChild(panel);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeOverlay();
  });
  document.body.appendChild(backdrop);
  state.overlay = backdrop;
  state.overlayKeydown = (event) => {
    if (event.key === "Escape") closeOverlay();
  };
  document.addEventListener("keydown", state.overlayKeydown);
  return panel;
}

function showOverlay(title, bodyText) {
  const panel = openOverlay(title);
  panel.appendChild(
    element(
      "pre",
      "margin:0;padding:14px 16px;overflow:auto;font-family:ui-monospace,Menlo,monospace;font-size:12px;" +
        "line-height:1.45;white-space:pre-wrap;",
      { textContent: bodyText }
    )
  );
}

function showHtmlOverlay(title, html) {
  const panel = openOverlay(title);
  panel.style.maxWidth = "min(1200px, 94vw)";
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", ""); // fully sandboxed: no scripts, no navigation — display only
  frame.style.cssText = "border:none;width:min(1100px,90vw);height:72vh;background:#fff;";
  frame.srcdoc = html;
  panel.appendChild(frame);
}

function labeledField(labelText, controlNode) {
  const wrapper = element("label", "display:flex;flex-direction:column;gap:4px;font-size:12px;color:#374151;");
  wrapper.appendChild(element("span", "font-weight:600;", { textContent: labelText }));
  wrapper.appendChild(controlNode);
  return wrapper;
}

function selectControl(items, selectedValue) {
  const select = element("select", "padding:6px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;background:#fff;color:#111827;");
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    option.selected = item === selectedValue;
    select.appendChild(option);
  }
  return select;
}

/* -------------------------------------------------------------------- HTTP */

async function fetchWithTimeout(url, options, seconds) {
  const controller = new AbortController();
  state.activeAbort = controller;
  const timer = window.setTimeout(() => controller.abort(), seconds * 1000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    state.activeAbort = null;
  }
}

function unreachableMessage() {
  return (
    `Cannot reach guffin-server at ${serverUrl()}.\n\n` +
    "Is it running with browser admission enabled?\n\n" +
    "    guffin-server --allow-origin https://roamresearch.com\n\n" +
    "The Roam connection settings (GUFFIN_ROAM_LOCAL_API_PORT, GUFFIN_ROAM_GRAPH_NAME,\n" +
    "GUFFIN_ROAM_API_TOKEN) must be set in the server's environment."
  );
}

async function problemText(response) {
  try {
    const problem = await response.json();
    const heading = [problem.title, problem.exit_code !== undefined ? `exit ${problem.exit_code}` : null]
      .filter(Boolean)
      .join(" — ");
    return `${heading}\n\n${problem.detail || "(no detail)"}`;
  } catch {
    return `HTTP ${response.status}\n\n${await response.text()}`;
  }
}

function fileNameFromDisposition(disposition) {
  if (!disposition) return null;
  const starForm = disposition.match(/filename\*=(?:utf-8|UTF-8)''([^;]+)/);
  if (starForm) return decodeURIComponent(starForm[1].trim());
  const plainForm = disposition.match(/filename="?([^";]+)"?/);
  return plainForm ? plainForm[1].trim() : null;
}

function contentDigestSha256(headerValue) {
  if (!headerValue) return null;
  const match = headerValue.match(/sha-256=:([A-Za-z0-9+/=]+):/i);
  return match ? match[1] : null;
}

async function sha256Base64(blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = element("a", "display:none;", { href: url, download: fileName });
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/* ----------------------------------------------------------------- targets */

async function currentTargetUid() {
  return await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
}

/* ---------------------------------------------------------------- commands */

async function guarded(label, work) {
  if (state.activeCommand) {
    toast(`Guffin: "${state.activeCommand}" is still running — one invocation at a time.`);
    return;
  }
  state.activeCommand = label;
  try {
    await work();
  } catch (err) {
    if (err.name === "AbortError") {
      showOverlay("Guffin: timed out", `No response within ${timeoutSeconds()}s. Raise the timeout setting for long renders.`);
    } else if (err instanceof TypeError) {
      showOverlay("Guffin: server unreachable", unreachableMessage());
    } else {
      showOverlay("Guffin: error", String(err.message || err));
    }
  } finally {
    state.activeCommand = null;
  }
}

async function executeExport(uid, body) {
  toast(`Guffin: exporting ${uid} as ${body.output_format} (${body.project_type})…`, 8000);
  const response = await fetchWithTimeout(
    `${serverUrl()}/v1/export`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    timeoutSeconds()
  );
  if (!response.ok) {
    showOverlay(`Guffin: export failed (${uid})`, await problemText(response));
    return;
  }
  const blob = await response.blob();
  const expectedDigest = contentDigestSha256(response.headers.get("Content-Digest"));
  if (expectedDigest) {
    const actualDigest = await sha256Base64(blob);
    if (actualDigest !== expectedDigest) {
      showOverlay(
        `Guffin: integrity check failed (${uid})`,
        `The received bytes do not match the server's Content-Digest.\n\n` +
          `expected sha-256: ${expectedDigest}\n` +
          `received sha-256: ${actualDigest}\n\n` +
          `Nothing was saved. Retry the export; if this repeats, something between the server and ` +
          `this page is altering the response body.`
      );
      return;
    }
  }
  const fileName = fileNameFromDisposition(response.headers.get("Content-Disposition")) || `${uid}.${body.output_format}`;
  saveBlob(blob, fileName);
  const verified = expectedDigest ? ", digest verified" : "";
  toast(`Guffin: export ready — choose where to save ${fileName} (${Math.ceil(blob.size / 1024)} KB${verified}).`, 8000);
}

async function runExport(formatOverride, fixedUid) {
  const uid = fixedUid ?? (await currentTargetUid());
  if (!uid) {
    showOverlay("Guffin: no target", NO_TARGET_MESSAGE);
    return;
  }
  const body = {
    output_format: setting(SETTING_DEFAULT_FORMAT, "markdown"),
    project_type: setting(SETTING_DEFAULT_TYPE, "article"),
    ...parsedExtraFields(),
    ...(formatOverride ? { output_format: formatOverride } : {}),
    target: uid,
  };
  await executeExport(uid, body);
}

const OPTIONS_COMMAND_LABEL = "Guffin: Export current page/block with options…";

function showExportOptionsDialog(fixedUid) {
  const panel = openOverlay(fixedUid ? `Guffin: export with options — ${fixedUid}` : "Guffin: export with options");
  const form = element("div", "display:flex;flex-direction:column;gap:12px;padding:14px 16px;min-width:360px;");
  const formatSelect = selectControl(EXPORT_FORMATS, String(setting(SETTING_DEFAULT_FORMAT, "markdown")));
  const typeSelect = selectControl(PROJECT_TYPES, String(setting(SETTING_DEFAULT_TYPE, "article")));
  const extraArea = element(
    "textarea",
    "padding:6px;border:1px solid #d1d5db;border-radius:4px;font-family:ui-monospace,Menlo,monospace;" +
      "font-size:12px;resize:vertical;background:#fff;color:#111827;",
    { value: String(setting(SETTING_EXTRA_FIELDS, "")), rows: 3, placeholder: '{"numbering": false}' }
  );
  form.appendChild(labeledField("Format", formatSelect));
  form.appendChild(labeledField("Project type", typeSelect));
  form.appendChild(labeledField("Extra request fields (JSON — this export only)", extraArea));
  const buttons = element("div", "display:flex;justify-content:flex-end;gap:8px;");
  buttons.appendChild(
    element(
      "button",
      "padding:6px 14px;border:1px solid #d1d5db;border-radius:4px;background:#fff;color:#374151;font-size:13px;cursor:pointer;",
      { textContent: "Cancel", onclick: closeOverlay }
    )
  );
  buttons.appendChild(
    element(
      "button",
      "padding:6px 14px;border:none;border-radius:4px;background:#2563eb;color:#fff;font-size:13px;cursor:pointer;",
      {
        textContent: "Export",
        onclick: () => submitExportOptions(formatSelect.value, typeSelect.value, extraArea.value, fixedUid),
      }
    )
  );
  form.appendChild(buttons);
  panel.appendChild(form);
}

async function submitExportOptions(outputFormat, projectType, extraText, fixedUid) {
  let extra = {};
  const raw = extraText.trim();
  if (raw) {
    try {
      extra = JSON.parse(raw);
      if (typeof extra !== "object" || extra === null || Array.isArray(extra)) throw new Error("must be a JSON object");
    } catch (err) {
      toast(`Guffin: extra fields is not a JSON object — ${err.message}`, 6000);
      return; // the dialog stays open for correction
    }
  }
  const uid = fixedUid ?? (await currentTargetUid());
  closeOverlay();
  if (!uid) {
    showOverlay("Guffin: no target", NO_TARGET_MESSAGE);
    return;
  }
  await guarded(OPTIONS_COMMAND_LABEL, () =>
    executeExport(uid, { ...extra, output_format: outputFormat, project_type: projectType, target: uid })
  );
}

async function runDump(fixedUid) {
  const uid = fixedUid ?? (await currentTargetUid());
  if (!uid) {
    showOverlay("Guffin: no target", NO_TARGET_MESSAGE);
    return;
  }
  toast(`Guffin: dumping ${uid}…`, 8000);
  const response = await fetchWithTimeout(
    `${serverUrl()}/v1/dump`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: uid, console_format: "html", console_width: dumpWidth() }),
    },
    timeoutSeconds()
  );
  if (!response.ok) {
    showOverlay(`Guffin: dump failed (${uid})`, await problemText(response));
    return;
  }
  showHtmlOverlay(`Guffin: dump — ${uid}`, await response.text());
}

async function runHealth() {
  const response = await fetchWithTimeout(`${serverUrl()}/v1/health`, { method: "GET" }, HEALTH_TIMEOUT_SECONDS);
  if (!response.ok) {
    showOverlay("Guffin: health check failed", await problemText(response));
    return;
  }
  const health = await response.json();
  toast(`Guffin: ${health.provenance || `server ${health.version}`} — ${health.status}.`, 8000);
}

/* ------------------------------------------------------------------- wiring */

/* The command set is fixed, not a registry accumulated at load time: onunload removes exactly
 * these labels, so an unload can never remove more (or fewer) than one load registered, and
 * removing an already-absent label is a no-op. */
const COMMANDS = [
  // Opening the dialog is instant, so it bypasses the single-flight guard; the guard applies
  // when its Export button submits.
  { label: OPTIONS_COMMAND_LABEL, run: () => showExportOptionsDialog(), unguarded: true },
  { label: "Guffin: Export current page/block", run: () => runExport(null) },
  { label: "Guffin: Export current page/block as Markdown", run: () => runExport("markdown") },
  { label: "Guffin: Export current page/block as PDF", run: () => runExport("pdf") },
  { label: "Guffin: Export current page/block as EPUB", run: () => runExport("epub") },
  { label: "Guffin: Dump current page/block", run: () => runDump() },
  { label: "Guffin: Server health", run: () => runHealth() },
];

/* Right-click block commands: the clicked block's subtree is the target, no zooming needed.
 * Registered on window.roamAlphaAPI (not extensionAPI), so onunload must remove them; the
 * same fixed-list discipline as COMMANDS applies. Roam passes the clicked block's info to
 * the callback with hyphenated keys ("block-uid"). */
const BLOCK_CONTEXT_COMMANDS = [
  {
    label: "Guffin: Export block subtree",
    run: (blockUid) => guarded("Guffin: Export block subtree", () => runExport(null, blockUid)),
  },
  {
    label: "Guffin: Export block subtree with options…",
    run: (blockUid) => showExportOptionsDialog(blockUid),
  },
  {
    label: "Guffin: Dump block subtree",
    run: (blockUid) => guarded("Guffin: Dump block subtree", () => runDump(blockUid)),
  },
];

/* Page-targeted context menus. Three Roam surfaces name a page: its title (pageContextMenu),
 * a [[reference]] inside a block (pageRefContextMenu), and a link in linked references or
 * query results (pageLinkContextMenu) — so any page name you can right-click is exportable
 * in place, without navigating. Each surface hands the page's uid to its callback under its
 * own key. A surface absent from the running Roam build is skipped. */
const PAGE_MENU_SURFACES = [
  { name: "pageContextMenu", uidKey: "page-uid" },
  { name: "pageRefContextMenu", uidKey: "ref-uid" },
  { name: "pageLinkContextMenu", uidKey: "page-uid" },
];

const PAGE_CONTEXT_COMMANDS = [
  { label: "Guffin: Export page", run: (pageUid) => guarded("Guffin: Export page", () => runExport(null, pageUid)) },
  { label: "Guffin: Export page with options…", run: (pageUid) => showExportOptionsDialog(pageUid) },
  { label: "Guffin: Dump page", run: (pageUid) => guarded("Guffin: Dump page", () => runDump(pageUid)) },
];

function pageMenuOf(surface) {
  const menu = window.roamAlphaAPI.ui[surface.name];
  return menu && typeof menu.addCommand === "function" ? menu : null;
}

export default {
  onload: ({ extensionAPI }) => {
    state.extensionAPI = extensionAPI;

    extensionAPI.settings.panel.create({
      tabTitle: "Guffin Companion",
      settings: [
        {
          id: SETTING_SERVER_URL,
          name: "Server URL",
          description: "The colocated guffin-server's base URL.",
          action: { type: "input", placeholder: DEFAULT_SERVER_URL },
        },
        {
          id: SETTING_DEFAULT_FORMAT,
          name: "Default export format",
          description: "Used by the plain export command; the per-format commands override it.",
          action: { type: "select", items: EXPORT_FORMATS },
        },
        {
          id: SETTING_DEFAULT_TYPE,
          name: "Default project type",
          description: "The --type profile every export request carries.",
          action: { type: "select", items: PROJECT_TYPES },
        },
        {
          id: SETTING_TIMEOUT_SECONDS,
          name: "Request timeout (seconds)",
          description: "How long to wait for an invocation; renders queue server-side and can take minutes.",
          action: { type: "input", placeholder: String(DEFAULT_TIMEOUT_SECONDS) },
        },
        {
          id: SETTING_DUMP_WIDTH,
          name: "Dump width (characters)",
          description: "How wide the dump inspector's console rendering wraps.",
          action: { type: "input", placeholder: String(DEFAULT_DUMP_WIDTH) },
        },
        {
          id: SETTING_EXTRA_FIELDS,
          name: "Extra export request fields (JSON)",
          description:
            "A JSON object merged into every export request (e.g. {\"numbering\": false}); " +
            "see the server's /openapi.json for the field vocabulary.",
          action: { type: "input", placeholder: "{}" },
        },
      ],
    });

    for (const command of COMMANDS) {
      extensionAPI.ui.commandPalette.addCommand({
        label: command.label,
        callback: command.unguarded ? command.run : () => guarded(command.label, command.run),
      });
    }
    for (const command of BLOCK_CONTEXT_COMMANDS) {
      window.roamAlphaAPI.ui.blockContextMenu.addCommand({
        label: command.label,
        callback: (context) => command.run(context["block-uid"]),
      });
    }
    for (const surface of PAGE_MENU_SURFACES) {
      const menu = pageMenuOf(surface);
      if (!menu) continue;
      for (const command of PAGE_CONTEXT_COMMANDS) {
        menu.addCommand({
          label: command.label,
          callback: (context) => command.run(context[surface.uidKey]),
        });
      }
    }
  },

  onunload: () => {
    const commandPalette = state.extensionAPI?.ui?.commandPalette;
    for (const command of COMMANDS) {
      try {
        commandPalette?.removeCommand({ label: command.label });
      } catch {
        /* a command Roam has already dropped is not worth failing an unload over */
      }
    }
    for (const command of BLOCK_CONTEXT_COMMANDS) {
      try {
        window.roamAlphaAPI.ui.blockContextMenu.removeCommand({ label: command.label });
      } catch {
        /* same posture as the palette removals above */
      }
    }
    for (const surface of PAGE_MENU_SURFACES) {
      const menu = pageMenuOf(surface);
      if (!menu) continue;
      for (const command of PAGE_CONTEXT_COMMANDS) {
        try {
          menu.removeCommand({ label: command.label });
        } catch {
          /* same posture as the palette removals above */
        }
      }
    }
    if (state.activeAbort) state.activeAbort.abort();
    closeOverlay();
    for (const node of state.toasts) node.remove();
    state.toasts = [];
    // extensionAPI is deliberately NOT nulled: on a reload Roam may run this after the fresh
    // onload, and nulling the shared reference would disable the live instance.
  },
};
