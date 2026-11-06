window.__ModuleLoader__.load({ id: "@dsh-external/dsh-redteam-model", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/AdminPage.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/iconCompat.ts
var primitives = __toESM(require("@deepseek-ai/dsh-client-ui-primitives"), 1);
function pick(legacyName, modernName) {
  const table = primitives;
  return table[legacyName] ?? table[modernName];
}
var IconRefresh = pick("IconRefreshOutline16", "IconRefreshOutlineRegular");
var IconAgentPreset = pick("IconAgentPresetOutline16", "IconAgentPresetOutlineMedium");
var IconCordisPlugin = pick("IconCordisPluginOutline14", "IconCordisPluginOutlineMedium");

// src/client/controller.ts
function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
var API_CHANNEL = "/api/dsh-redteam-model";
var LEGACY_CHANNEL = "/dsh-redteam-model";
var AdminController = class {
  constructor(connection) {
    this.connection = connection;
  }
  channel = null;
  legacyTried = false;
  rpcId = 0;
  async status(force = false) {
    return this.call("status", { force });
  }
  async start(request) {
    return this.call("operation/start", request);
  }
  async cancel(id) {
    return this.call("operation/cancel", { id });
  }
  async clear() {
    return this.call("operations/clear", {});
  }
  inject() {
    return {
      status: (force) => this.status(force),
      start: (request) => this.start(request),
      cancel: (id) => this.cancel(id),
      clear: () => this.clear()
    };
  }
  async call(endpoint, payload) {
    if (this.channel === null) this.channel = API_CHANNEL;
    if (this.channel === API_CHANNEL) {
      try {
        return await this.invokeApi(endpoint, payload);
      } catch {
        if (this.legacyTried) throw new Error(`[dsh-redteam-model] ${endpoint} failed: modern /api channel unavailable`);
        this.legacyTried = true;
        this.channel = LEGACY_CHANNEL;
      }
    }
    return this.invokeLegacy(endpoint, payload);
  }
  async invokeApi(endpoint, payload) {
    const response = await fetch(`${API_CHANNEL}/${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "client-request", rpcId: `admin-${++this.rpcId}`, method: endpoint, payload })
    });
    if (!response.ok) throw new Error(`transport failure for ${API_CHANNEL}/${endpoint}: HTTP ${response.status}`);
    const envelope = await response.json();
    if (envelope.type !== "server-response" || envelope.result === void 0) {
      throw new Error(`transport failure for ${API_CHANNEL}/${endpoint}: malformed envelope`);
    }
    return this.unwrap(endpoint, envelope.result);
  }
  async invokeLegacy(endpoint, payload) {
    const result = await this.connection.rpc.call(LEGACY_CHANNEL, endpoint, payload);
    return this.unwrap(endpoint, result);
  }
  unwrap(endpoint, result) {
    if (result.ok !== true) {
      const detail = result.error?.message ?? "unknown error";
      throw new Error(`[dsh-redteam-model] ${endpoint} failed: ${detail}`);
    }
    return result.value;
  }
};
function errorMessage(error) {
  return messageOf(error);
}

// src/client/AdminPage.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function createAdminPage(face, t, _visibilityScope) {
  return function AdminPage() {
    const [status, setStatus] = (0, import_react.useState)(null);
    const [error, setError] = (0, import_react.useState)(null);
    const refresh = (0, import_react.useCallback)(async () => {
      try {
        setStatus(await face.status(true));
        setError(null);
      } catch (cause) {
        setStatus(null);
        setError(errorMessage(cause));
      }
    }, [face]);
    (0, import_react.useEffect)(() => {
      let alive = true;
      let timer;
      const tick = async () => {
        try {
          const next = await face.status();
          if (alive) {
            setStatus(next);
            setError(null);
          }
        } catch (cause) {
          if (alive) {
            setStatus(null);
            setError(errorMessage(cause));
          }
        }
        if (alive) timer = window.setTimeout(() => void tick(), 6e4);
      };
      void tick();
      return () => {
        alive = false;
        if (timer !== void 0) window.clearTimeout(timer);
      };
    }, [face]);
    const health = status?.health;
    const integrity = health?.bundleIntegrity ?? "unknown";
    const runtime = health?.runtimeHealth ?? "unknown";
    const overall = integrity === "incomplete" || runtime === "unhealthy" ? "error" : integrity === "complete" && runtime === "healthy" ? "healthy" : "unknown";
    const dot = (state) => state === "good" ? "done" : state === "bad" ? "error" : "warning";
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-rtm", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-rtm-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "dsh-rtm-title", children: t("title") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-rtm-sub", children: t("healthSubtitle") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { size: "sm", variant: "outline", icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconRefresh, { size: 14 }), onClick: () => void refresh(), children: t("refresh") })
      ] }),
      error !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-rtm-error", role: "alert", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        t("requestFailed"),
        ": ",
        error
      ] }) }),
      status === null && error === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-rtm-loading", children: t("loading") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: `dsh-rtm-overall dsh-rtm-overall--${overall}`, "aria-live": "polite", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.StateDot, { state: dot(overall === "healthy" ? "good" : overall === "error" ? "bad" : "unknown"), size: 8 }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("overallLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: t(overall === "healthy" ? "healthOverallReady" : overall === "error" ? "healthOverallError" : "healthUnknown") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-rtm-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-rtm-section-head", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "dsh-rtm-section-title", children: t("healthChecks") }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-rtm-attention-list", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HealthRow, { label: t("healthHostVersion"), value: health?.hostVersion || t("healthUnknown") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              HealthRow,
              {
                label: t("healthBundle"),
                value: t(integrity === "complete" ? "healthBundleComplete" : integrity === "incomplete" ? "healthBundleIncomplete" : "healthUnknown"),
                state: dot(integrity === "complete" ? "good" : integrity === "incomplete" ? "bad" : "unknown")
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              HealthRow,
              {
                label: t("healthRuntime"),
                value: t(runtime === "healthy" ? "healthRuntimeReady" : runtime === "unhealthy" ? "healthRuntimeError" : "healthUnknown"),
                state: dot(runtime === "healthy" ? "good" : runtime === "unhealthy" ? "bad" : "unknown")
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-rtm-restart-hint", children: t("healthLimit") }),
        health?.details?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-rtm-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-rtm-section-head", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "dsh-rtm-section-title", children: t("healthDetails") }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-rtm-attention-list", children: health.details.map((detail, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-rtm-attention-row", children: detail }, index)) })
        ] }) : null
      ] })
    ] });
  };
}
function HealthRow({ label, value, state }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-rtm-attention-row", children: [
    state && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.StateDot, { state, size: 7 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-rtm-attention-main", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: label }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: value })
  ] });
}

// src/conversationViewState.ts
var DEFAULT_CONVERSATION_VIEW_SETTINGS = Object.freeze({
  showCampaignMemory: true,
  showAttackAtlas: true,
  showRedteamResults: true,
  showHunter: true,
  showWebshellManager: true
});

// src/client/conversationViewSettings.ts
var CONVERSATION_VIEW_SETTINGS_NAMESPACE = "redteam-manager-ui";
var VIEW_FIELDS = [
  "showCampaignMemory",
  "showAttackAtlas",
  "showRedteamResults",
  "showHunter",
  "showWebshellManager"
];
function decodeConversationViewSettings(section) {
  if (typeof section !== "object" || section === null || Array.isArray(section)) return void 0;
  const candidate = section;
  if (VIEW_FIELDS.some((field) => typeof candidate[field] !== "boolean")) return void 0;
  return {
    showCampaignMemory: candidate.showCampaignMemory,
    showAttackAtlas: candidate.showAttackAtlas,
    showRedteamResults: candidate.showRedteamResults,
    showHunter: candidate.showHunter,
    showWebshellManager: candidate.showWebshellManager
  };
}

// src/client/settingsScopeShim.ts
var STORAGE_PREFIX = "dsh-redteam-model:settingsScope:";
var READY_SNAPSHOT_BASE = { status: "ready", writable: true, mode: "memory" };
function readSection(storage, namespace) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_PREFIX + namespace);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}
function writeSection(storage, namespace, section) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_PREFIX + namespace, JSON.stringify(section));
  } catch {
  }
}
function createSettingsScopeService() {
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    storage = void 0;
  }
  const listenersByNamespace = /* @__PURE__ */ new Map();
  const onStorage = (event) => {
    if (event.key === null || !event.key.startsWith(STORAGE_PREFIX)) return;
    const namespace = event.key.slice(STORAGE_PREFIX.length);
    const listeners = listenersByNamespace.get(namespace);
    if (!listeners) return;
    for (const listener of [...listeners]) listener();
  };
  if (typeof window.addEventListener === "function") {
    window.addEventListener("storage", onStorage);
  }
  return {
    bind(spec) {
      const { namespace, decode } = spec;
      const listeners = /* @__PURE__ */ new Set();
      listenersByNamespace.set(namespace, listeners);
      return {
        getSnapshot() {
          const section = readSection(storage, namespace);
          const value = decode ? decode(section) : section;
          return { ...READY_SNAPSHOT_BASE, value };
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        async set(field, value) {
          const section = readSection(storage, namespace);
          section[field] = value;
          writeSection(storage, namespace, section);
          for (const listener of [...listeners]) listener();
        }
      };
    }
  };
}

// src/client/locales.ts
var NS = "redteam-manager";
var en = {
  healthSubtitle: "Check bundle integrity and host runtime status.",
  healthOverallReady: "Checks passed",
  healthOverallError: "Attention required",
  healthUnknown: "Unknown",
  healthChecks: "Health checks",
  healthHostVersion: "DSH version",
  healthBundle: "Bundle integrity",
  healthBundleComplete: "Complete",
  healthBundleIncomplete: "Incomplete or modified",
  healthRuntime: "Runtime components",
  healthRuntimeReady: "Active",
  healthRuntimeError: "Unavailable",
  healthLimit: "Runtime checks cover components, presets, prompts and workflow skills. Model, credentials, external tools and API calls are not tested.",
  healthDetails: "Details",
  nav: "Redteam Manager",
  title: "Redteam Manager",
  subtitle: "Review the bundled security preset and its runtime components.",
  refresh: "Refresh",
  loading: "Loading\u2026",
  errorBannerTitle: "Unable to load manager status",
  profileError: "The DSH profile manifest cannot be read. Fix it manually before installing or uninstalling plugins.",
  requestFailed: "Request failed",
  retry: "Retry",
  managerPages: "Manager pages",
  pageOverview: "Overview",
  pageModes: "Modes",
  pagePlugins: "Plugins",
  pageLogs: "Logs",
  overallLabel: "Overall status",
  overallHealthy: "Healthy",
  overallAttention: "Attention required",
  overallBusy: "Operation running",
  overallError: "Profile error",
  attentionTitle: "Attention",
  overviewModesLabel: "Security modes",
  overviewModesHealthy: "All modes are ready",
  overviewModesAttention: "Modes need deployment or repair",
  overviewPluginsLabel: "Runtime plugins",
  overviewPluginsHealthy: "All plugin packages are included",
  overviewPluginsAttention: "A bundled plugin package needs attention",
  overviewOperationsLabel: "Operation history",
  overviewRunning: "Running",
  overviewWarnings: "Warnings or failures",
  viewDetails: "View details",
  statModesReady: "Modes ready",
  statPluginsInstalled: "Bundled plugins",
  statUpdates: "Updates",
  statRunning: "Running",
  batchInstallMissing: "Install missing",
  batchDeployModesAll: "Deploy all modes",
  batchUpdateAll: "Update all",
  batchUninstallAll: "Uninstall all",
  batchUninstallModesAll: "Uninstall all modes",
  busyHint: "An operation is running. Other actions are disabled.",
  restartHint: "Host-plane plugins and manager updates take effect after restarting dsh web; refresh the page to update copied-mode status.",
  modesTitle: "Security modes",
  modesEmpty: "No modes reported by the host.",
  modeStateOk: "ok",
  modeStateMissing: "missing",
  modeStateStale: "stale",
  modeStateError: "error",
  modeLinkPath: "Link path",
  modeDeploy: "Deploy",
  modeRepair: "Repair",
  modeNoPath: "No link path reported",
  pluginsTitle: "Runtime plugins",
  pluginsEmpty: "No plugins reported by the host.",
  pluginStateNotInstalled: "not installed",
  pluginStateInstalled: "bundled",
  pluginStateUpdateAvailable: "update available",
  pluginStateBroken: "broken",
  pluginInstall: "Install",
  pluginUpdate: "Update",
  pluginRepair: "Repair",
  pluginUninstall: "Uninstall",
  pluginEnabledInProfile: "Enabled in current profile",
  pluginEnabledRestartHint: "Restart dsh web to apply",
  pluginShowConversationView: "Show conversation tab",
  pluginViewSettingsTitle: "Conversation tabs",
  pluginViewLiveHint: "Applies immediately",
  pluginViewScopeHint: "Saved for this DSH_HOME; tools and data remain active",
  pluginViewSettingsScope: "Conversation tab visibility is saved DSH_HOME-wide and applies live. Hiding a tab does not disable its tools or data.",
  pluginViewSettingsUnavailable: "Conversation tab preferences are unavailable or read-only in this browser.",
  pluginViewSettingsSaveFailed: "The conversation tab preference was not saved. The previous value has been restored.",
  pluginVersion: "Version",
  pluginLatest: "latest",
  pluginNotInstalled: "not installed",
  pluginHostPlane: "host",
  pluginPresetPlane: "preset",
  versionUnknown: "\u2014",
  versionSeparator: "\u2192",
  operationsTitle: "Operations",
  opQueued: "Queued",
  opRunning: "Running",
  opDone: "Done",
  opWarned: "Finished with warnings",
  opFailed: "Failed",
  opEmpty: "No operations yet.",
  opProgress: "Progress",
  opClear: "Clear finished",
  opCancel: "Cancel",
  opDetail: "Detail",
  opError: "Error",
  opCancelled: "Cancelled",
  opKindDeployModes: "Deploy modes",
  opKindInstall: "Install",
  opKindUpdate: "Update",
  opKindUninstall: "Uninstall",
  opKindRemoveModes: "Uninstall modes",
  opKindRepair: "Repair",
  confirmUninstallTitle: "Uninstall plugin",
  confirmUninstallAllTitle: "Uninstall plugins",
  confirmUninstallDesc: "This removes the plugin from the current profile after confirmation. Its tools and UI will be unavailable after restart; plugin data is kept.",
  confirmUninstallModesTitle: "Uninstall modes",
  confirmUninstallModesDesc: "This removes the security modes this manager deployed from the DSH_HOME-wide .agent-presets after confirmation. Only entries it owns or links are removed; presets it does not own and the packaged source tree are untouched.",
  confirmTargets: "Targets",
  confirmCancel: "Cancel",
  confirmConfirm: "Confirm"
};
var zh = {
  healthSubtitle: "\u68C0\u67E5\u63D2\u4EF6\u5305\u5B8C\u6574\u6027\u548C\u5BBF\u4E3B\u8FD0\u884C\u72B6\u6001\u3002",
  healthOverallReady: "\u68C0\u67E5\u901A\u8FC7",
  healthOverallError: "\u9700\u8981\u5904\u7406",
  healthUnknown: "\u672A\u77E5",
  healthChecks: "\u5065\u5EB7\u68C0\u67E5",
  healthHostVersion: "\u5F53\u524D DSH \u7248\u672C",
  healthBundle: "\u63D2\u4EF6\u5305\u5B8C\u6574\u6027",
  healthBundleComplete: "\u5B8C\u6574",
  healthBundleIncomplete: "\u7F3A\u5931\u6216\u5DF2\u4FEE\u6539",
  healthRuntime: "\u8FD0\u884C\u7EC4\u4EF6",
  healthRuntimeReady: "\u5DF2\u6FC0\u6D3B",
  healthRuntimeError: "\u5F02\u5E38",
  healthLimit: "\u8FD0\u884C\u72B6\u6001\u68C0\u67E5\u7EC4\u4EF6\u3001\u9884\u8BBE\u3001\u63D0\u793A\u8BCD\u4E0E\u5DE5\u4F5C\u6D41\u6280\u80FD\uFF1B\u4E0D\u4EE3\u8868\u6A21\u578B\u3001\u51ED\u636E\u3001\u5916\u90E8\u5DE5\u5177\u6216 API \u8C03\u7528\u5DF2\u9A8C\u8BC1\u3002",
  healthDetails: "\u68C0\u67E5\u8BE6\u60C5",
  nav: "\u7EA2\u961F\u6A21\u578B\u7BA1\u7406",
  title: "\u7EA2\u961F\u6A21\u578B\u7BA1\u7406\u53F0",
  subtitle: "\u67E5\u770B\u7EDF\u4E00\u5B89\u5168\u9884\u8BBE\u548C\u968F\u5305\u63D0\u4F9B\u7684\u8FD0\u884C\u7EC4\u4EF6\u3002",
  refresh: "\u5237\u65B0",
  loading: "\u52A0\u8F7D\u4E2D\u2026",
  errorBannerTitle: "\u65E0\u6CD5\u52A0\u8F7D\u7BA1\u7406\u53F0\u72B6\u6001",
  profileError: "DSH profile \u6E05\u5355\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u8BF7\u5148\u624B\u52A8\u4FEE\u590D\u540E\u518D\u5B89\u88C5\u6216\u5378\u8F7D\u63D2\u4EF6\u3002",
  requestFailed: "\u8BF7\u6C42\u5931\u8D25",
  retry: "\u91CD\u8BD5",
  managerPages: "\u7BA1\u7406\u9875\u9762",
  pageOverview: "\u6982\u89C8",
  pageModes: "\u6A21\u5F0F",
  pagePlugins: "\u63D2\u4EF6",
  pageLogs: "\u65E5\u5FD7",
  overallLabel: "\u603B\u4F53\u72B6\u6001",
  overallHealthy: "\u8FD0\u884C\u6B63\u5E38",
  overallAttention: "\u9700\u8981\u5173\u6CE8",
  overallBusy: "\u64CD\u4F5C\u8FDB\u884C\u4E2D",
  overallError: "Profile \u5F02\u5E38",
  attentionTitle: "\u6CE8\u610F\u9879",
  overviewModesLabel: "\u5B89\u5168\u6A21\u5F0F",
  overviewModesHealthy: "\u6240\u6709\u6A21\u5F0F\u5747\u5DF2\u5C31\u7EEA",
  overviewModesAttention: "\u6709\u6A21\u5F0F\u9700\u8981\u90E8\u7F72\u6216\u4FEE\u590D",
  overviewPluginsLabel: "\u8FD0\u884C\u65F6\u63D2\u4EF6",
  overviewPluginsHealthy: "\u6240\u6709\u7EC4\u4EF6\u5747\u5DF2\u5305\u542B\u5728\u5B89\u88C5\u5305\u4E2D",
  overviewPluginsAttention: "\u6709\u7EC4\u4EF6\u5305\u9700\u8981\u68C0\u67E5",
  overviewOperationsLabel: "\u64CD\u4F5C\u5386\u53F2",
  overviewRunning: "\u8FD0\u884C\u4E2D",
  overviewWarnings: "\u8B66\u544A\u6216\u5931\u8D25",
  viewDetails: "\u67E5\u770B\u8BE6\u60C5",
  statModesReady: "\u6A21\u5F0F\u5C31\u7EEA",
  statPluginsInstalled: "\u5185\u7F6E\u7EC4\u4EF6",
  statUpdates: "\u53EF\u66F4\u65B0",
  statRunning: "\u8FD0\u884C\u4E2D",
  batchInstallMissing: "\u5B89\u88C5\u7F3A\u5931",
  batchDeployModesAll: "\u90E8\u7F72\u5168\u90E8\u6A21\u5F0F",
  batchUpdateAll: "\u5168\u90E8\u66F4\u65B0",
  batchUninstallAll: "\u5168\u90E8\u5378\u8F7D",
  batchUninstallModesAll: "\u5378\u8F7D\u5168\u90E8\u6A21\u5F0F",
  busyHint: "\u6709\u64CD\u4F5C\u6B63\u5728\u8FD0\u884C\uFF0C\u5176\u4ED6\u64CD\u4F5C\u5DF2\u7981\u7528\u3002",
  restartHint: "\u5BBF\u4E3B\u5E73\u9762\u63D2\u4EF6\u53CA\u7BA1\u7406\u5668\u81EA\u8EAB\u66F4\u65B0\u9700\u8981\u91CD\u542F dsh web \u540E\u751F\u6548\uFF1B\u6A21\u5F0F\u590D\u5236\u72B6\u6001\u5237\u65B0\u9875\u9762\u5373\u53EF\u66F4\u65B0\u3002",
  modesTitle: "\u5B89\u5168\u6A21\u5F0F",
  modesEmpty: "\u5BBF\u4E3B\u672A\u4E0A\u62A5\u4EFB\u4F55\u6A21\u5F0F\u3002",
  modeStateOk: "\u6B63\u5E38",
  modeStateMissing: "\u7F3A\u5931",
  modeStateStale: "\u8FC7\u671F",
  modeStateError: "\u5F02\u5E38",
  modeLinkPath: "\u94FE\u63A5\u8DEF\u5F84",
  modeDeploy: "\u90E8\u7F72",
  modeRepair: "\u4FEE\u590D",
  modeNoPath: "\u672A\u4E0A\u62A5\u94FE\u63A5\u8DEF\u5F84",
  pluginsTitle: "\u8FD0\u884C\u65F6\u63D2\u4EF6",
  pluginsEmpty: "\u5BBF\u4E3B\u672A\u4E0A\u62A5\u4EFB\u4F55\u63D2\u4EF6\u3002",
  pluginStateNotInstalled: "\u672A\u5B89\u88C5",
  pluginStateInstalled: "\u968F\u5305\u63D0\u4F9B",
  pluginStateUpdateAvailable: "\u53EF\u66F4\u65B0",
  pluginStateBroken: "\u5F02\u5E38",
  pluginInstall: "\u5B89\u88C5",
  pluginUpdate: "\u66F4\u65B0",
  pluginRepair: "\u4FEE\u590D",
  pluginUninstall: "\u5378\u8F7D",
  pluginEnabledInProfile: "\u5728\u5F53\u524D profile \u542F\u7528",
  pluginEnabledRestartHint: "\u91CD\u542F dsh web \u540E\u751F\u6548",
  pluginShowConversationView: "\u663E\u793A\u5BF9\u8BDD\u6807\u7B7E",
  pluginViewSettingsTitle: "\u5BF9\u8BDD\u6807\u7B7E",
  pluginViewLiveHint: "\u7ACB\u5373\u751F\u6548",
  pluginViewScopeHint: "\u4FDD\u5B58\u5230\u5F53\u524D DSH_HOME\uFF1B\u5DE5\u5177\u548C\u6570\u636E\u4ECD\u4FDD\u6301\u8FD0\u884C",
  pluginViewSettingsScope: "\u5BF9\u8BDD\u6807\u7B7E\u53EF\u89C1\u6027\u6309 DSH_HOME \u6301\u4E45\u5316\u5E76\u5B9E\u65F6\u751F\u6548\uFF1B\u9690\u85CF\u6807\u7B7E\u4E0D\u4F1A\u505C\u7528\u5176\u5DE5\u5177\u6216\u6570\u636E\u3002",
  pluginViewSettingsUnavailable: "\u5F53\u524D\u6D4F\u89C8\u5668\u65E0\u6CD5\u4FEE\u6539\u5BF9\u8BDD\u6807\u7B7E\u504F\u597D\uFF0C\u6216\u8BE5\u8BBE\u7F6E\u4E3A\u53EA\u8BFB\u72B6\u6001\u3002",
  pluginViewSettingsSaveFailed: "\u5BF9\u8BDD\u6807\u7B7E\u504F\u597D\u672A\u80FD\u4FDD\u5B58\uFF0C\u5DF2\u6062\u590D\u4E3A\u539F\u503C\u3002",
  pluginVersion: "\u7248\u672C",
  pluginLatest: "\u6700\u65B0",
  pluginNotInstalled: "\u672A\u5B89\u88C5",
  pluginHostPlane: "\u5BBF\u4E3B",
  pluginPresetPlane: "\u9884\u8BBE",
  versionUnknown: "\u2014",
  versionSeparator: "\u2192",
  operationsTitle: "\u64CD\u4F5C\u65E5\u5FD7",
  opQueued: "\u6392\u961F\u4E2D",
  opRunning: "\u8FD0\u884C\u4E2D",
  opDone: "\u5DF2\u5B8C\u6210",
  opWarned: "\u5DF2\u5B8C\u6210\uFF08\u6709\u8B66\u544A\uFF09",
  opFailed: "\u5931\u8D25",
  opEmpty: "\u6682\u65E0\u64CD\u4F5C\u3002",
  opProgress: "\u8FDB\u5EA6",
  opClear: "\u6E05\u9664\u5DF2\u5B8C\u6210",
  opCancel: "\u53D6\u6D88",
  opDetail: "\u8BE6\u60C5",
  opError: "\u9519\u8BEF",
  opCancelled: "\u5DF2\u53D6\u6D88",
  opKindDeployModes: "\u90E8\u7F72\u6A21\u5F0F",
  opKindInstall: "\u5B89\u88C5",
  opKindUpdate: "\u66F4\u65B0",
  opKindUninstall: "\u5378\u8F7D",
  opKindRemoveModes: "\u5378\u8F7D\u6A21\u5F0F",
  opKindRepair: "\u4FEE\u590D",
  confirmUninstallTitle: "\u5378\u8F7D\u63D2\u4EF6",
  confirmUninstallAllTitle: "\u5378\u8F7D\u63D2\u4EF6",
  confirmUninstallDesc: "\u786E\u8BA4\u540E\u4F1A\u4ECE\u5F53\u524D profile \u79FB\u9664\u8BE5\u63D2\u4EF6\uFF1B\u91CD\u542F\u540E\u5176\u5DE5\u5177\u548C\u754C\u9762\u5C06\u4E0D\u53EF\u7528\uFF0C\u63D2\u4EF6\u6570\u636E\u4F1A\u4FDD\u7559\u3002",
  confirmUninstallModesTitle: "\u5378\u8F7D\u6A21\u5F0F",
  confirmUninstallModesDesc: "\u786E\u8BA4\u540E\u4F1A\u4ECE\u5F53\u524D DSH_HOME \u7684\u5168\u5C40 .agent-presets \u79FB\u9664\u672C\u7BA1\u7406\u53F0\u90E8\u7F72\u7684\u5B89\u5168\u6A21\u5F0F\uFF1A\u53EA\u79FB\u9664\u7BA1\u7406\u53F0\u6301\u6709\u6216\u6574\u4F53\u94FE\u63A5\u7684\u6761\u76EE\uFF0C\u4E0D\u5C5E\u4E8E\u8BE5\u7BA1\u7406\u53F0\u7684\u9884\u8BBE\u4E0E\u6E90\u7801\u6811\u4E0D\u53D7\u5F71\u54CD\u3002",
  confirmTargets: "\u76EE\u6807",
  confirmCancel: "\u53D6\u6D88",
  confirmConfirm: "\u786E\u8BA4"
};

// src/client/styles.ts
var STYLE_ID = "dsh-redteam-model-styles";
var CSS_TEXT = String.raw`
.dsh-rtm,.dsh-rtm *{box-sizing:border-box}
.dsh-rtm{display:flex;min-height:100%;flex-direction:column;gap:16px;padding:20px clamp(16px,3vw,40px) 44px;color:var(--dsw-alias-label-primary,#1f2329);font-family:var(--dsw-font-family,system-ui);font-size:12px;line-height:18px}

/* ---- header ---- */
.dsh-rtm-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap}
.dsh-rtm-title{margin:0;font-size:17px;line-height:26px;font-weight:700;letter-spacing:-.01em}
.dsh-rtm-sub{margin:3px 0 0;color:var(--dsw-alias-label-secondary,#57606a);font-size:11.5px;line-height:18px;max-width:680px}
.dsh-rtm-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}

.dsh-rtm-page-nav{display:flex;min-width:0;overflow-x:auto;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e6eb);scrollbar-width:thin}
.dsh-rtm-page-button{position:relative;flex:none;min-width:84px;padding:8px 14px;border:0;border-radius:8px 8px 0 0;background:transparent;color:var(--dsw-alias-label-secondary,#57606a);font:650 11.5px/18px var(--dsw-font-family,system-ui);cursor:pointer}
.dsh-rtm-page-button::after{content:"";position:absolute;right:10px;bottom:-1px;left:10px;height:2px;border-radius:2px 2px 0 0;background:transparent}
.dsh-rtm-page-button:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,var(--dsw-alias-label-primary,#1f2329) 6%,transparent));color:var(--dsw-alias-label-primary,#1f2329)}
.dsh-rtm-page-button.is-active{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-state-business-primary,#2563eb);font-weight:750}
.dsh-rtm-page-button.is-active::after{background:var(--dsw-alias-state-business-primary,#2563eb)}
.dsh-rtm-page-content,.dsh-rtm-overview{display:flex;min-width:0;flex-direction:column;gap:16px}

.dsh-rtm-error{border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 55%,var(--dsw-alias-border-l2,#e5e6eb));background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 7%,transparent);border-radius:10px;padding:9px 12px;color:var(--dsw-alias-state-error-primary,#d92d20);font-size:11.5px;line-height:17px}
.dsh-rtm-error-title{display:block;font-weight:700}
.dsh-rtm-error-message{margin-top:2px;color:var(--dsw-alias-label-secondary,#57606a)}

.dsh-rtm-loading{display:flex;align-items:center;gap:8px;padding:32px 4px;color:var(--dsw-alias-label-secondary,#57606a)}
.dsh-rtm-spin{display:inline-block;width:12px;height:12px;border:2px solid var(--dsw-alias-border-l2,#e5e6eb);border-top-color:var(--dsw-alias-state-business-primary,#2563eb);border-radius:50%;animation:dsh-rtm-spin .7s linear infinite;flex:none}
@keyframes dsh-rtm-spin{to{transform:rotate(360deg)}}

/* ---- stats strip ---- */
.dsh-rtm-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.dsh-rtm-stat{position:relative;overflow:hidden;padding:11px 14px;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#fff)}
.dsh-rtm-stat>span{display:block;color:var(--dsw-alias-label-tertiary,#8a919f);font-size:10px;font-weight:650;line-height:15px;text-transform:uppercase;letter-spacing:.07em}
.dsh-rtm-stat>strong{display:block;margin-top:3px;font-size:22px;line-height:30px;font-weight:700;letter-spacing:-.02em;color:var(--dsw-alias-label-primary,#1f2329);font-variant-numeric:tabular-nums}
.dsh-rtm-stat::after{content:"";position:absolute;top:0;left:0;width:100%;height:2px;background:transparent}
.dsh-rtm-stat--ok>strong{color:var(--dsw-alias-state-success-primary,#16a34a)}
.dsh-rtm-stat--ok::after{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#16a34a) 55%,transparent)}
.dsh-rtm-stat--warn>strong{color:var(--dsw-alias-state-warn-primary,#d97706)}
.dsh-rtm-stat--warn::after{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d97706) 55%,transparent)}
.dsh-rtm-stat--business>strong{color:var(--dsw-alias-state-business-primary,#2563eb)}
.dsh-rtm-stat--business::after{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#2563eb) 55%,transparent)}
.dsh-rtm-stat--error>strong{color:var(--dsw-alias-state-error-primary,#d92d20)}
.dsh-rtm-stat--error::after{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 55%,transparent)}

/* ---- overview ---- */
.dsh-rtm-overall{display:flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-secondary,#57606a)}
.dsh-rtm-overall>strong{color:var(--dsw-alias-label-primary,#1f2329)}
.dsh-rtm-overall--healthy>strong{color:var(--dsw-alias-state-success-primary,#16a34a)}
.dsh-rtm-overall--attention>strong,.dsh-rtm-overall--busy>strong{color:var(--dsw-alias-state-warn-primary,#d97706)}
.dsh-rtm-overall--error>strong{color:var(--dsw-alias-state-error-primary,#d92d20)}
.dsh-rtm-attention-list{display:flex;flex-direction:column}
.dsh-rtm-attention-row{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l2,#e5e6eb) 55%,transparent)}
.dsh-rtm-attention-row:last-child{border-bottom:0}
.dsh-rtm-attention-main{display:flex;min-width:0;flex:1;flex-direction:column}
.dsh-rtm-attention-main>strong{font-size:12px;line-height:18px}
.dsh-rtm-attention-main>span{color:var(--dsw-alias-label-tertiary,#8a919f);font-size:10.5px;line-height:16px}
.dsh-rtm-attention-count{min-width:28px;padding:1px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#e9eaee);color:var(--dsw-alias-label-secondary,#57606a);font-weight:700;text-align:center;font-variant-numeric:tabular-nums}
.dsh-rtm-attention-count.is-attention{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d97706) 12%,transparent);color:var(--dsw-alias-state-warn-primary,#d97706)}

/* ---- cards / sections ---- */
.dsh-rtm-card{border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#fff);overflow:hidden}
.dsh-rtm-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l2,#e5e6eb) 55%,transparent)}
.dsh-rtm-section-title{margin:0;font-size:11px;font-weight:700;line-height:17px;color:var(--dsw-alias-label-secondary,#57606a);text-transform:uppercase;letter-spacing:.06em}

.dsh-rtm-batchbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#fff)}
.dsh-rtm-restart-hint{margin:0;padding:8px 12px;border:1px dashed color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d97706) 45%,var(--dsw-alias-border-l2,#e5e6eb));border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d97706) 6%,transparent);color:var(--dsw-alias-label-secondary,#57606a);font-size:11px;line-height:17px}
.dsh-rtm-batchbar-hint{margin-left:auto;color:var(--dsw-alias-label-tertiary,#8a919f);font-size:10.5px;line-height:16px}

/* ---- modes ---- */
.dsh-rtm-modes{display:flex;flex-direction:column;gap:8px}
.dsh-rtm-disclosure{padding:6px 14px}
.dsh-rtm-mode-actions{display:inline-flex;align-items:center;gap:8px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
.dsh-rtm-mode-actions .dsh-rtm-mode-state{margin-left:0}
.dsh-rtm-mode-state{display:inline-flex;align-items:center;gap:6px;margin-left:auto;color:var(--dsw-alias-label-secondary,#57606a);font-size:10.5px;font-weight:650;line-height:16px;white-space:nowrap}
.dsh-rtm-mode-body{display:flex;flex-direction:column;gap:10px;padding:4px 0 14px}
.dsh-rtm-mode-summary{display:flex;align-items:baseline;gap:8px;color:var(--dsw-alias-label-secondary,#57606a)}
.dsh-rtm-mode-summary .dsh-rtm-mode-state{margin-left:0}
.dsh-rtm-path{display:flex;align-items:baseline;gap:8px;min-width:0;color:var(--dsw-alias-label-tertiary,#8a919f);font-size:11px}
.dsh-rtm-path code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-state-business-primary,#2563eb);font:11px/17px ui-monospace,SFMono-Regular,Menlo,monospace;direction:ltr}
.dsh-rtm-actions{display:flex;gap:8px;flex-wrap:wrap}
.dsh-rtm-muted{color:var(--dsw-alias-label-tertiary,#8a919f);font-size:10.5px;line-height:16px}
.dsh-rtm-empty{padding:16px;color:var(--dsw-alias-label-tertiary,#8a919f);font-size:11.5px;text-align:center}

/* ---- plugins ---- */
.dsh-rtm-plugins{display:flex;flex-direction:column}
.dsh-rtm-plugin-row{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l2,#e5e6eb) 55%,transparent)}
.dsh-rtm-plugin-row:last-child{border-bottom:0}
.dsh-rtm-plugin-main{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}
.dsh-rtm-plugin-title-row{display:flex;align-items:baseline;gap:8px;min-width:0}
.dsh-rtm-plugin-name{font-size:12.5px;font-weight:700;line-height:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-rtm-plugin-plane{flex:none;padding:0 7px;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:999px;color:var(--dsw-alias-label-tertiary,#8a919f);font-size:9px;font-weight:700;line-height:15px;text-transform:uppercase;letter-spacing:.06em}
.dsh-rtm-plugin-desc{margin:0;color:var(--dsw-alias-label-tertiary,#8a919f);font-size:10.5px;line-height:15px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dsh-rtm-plugin-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary,#8a919f);font-size:10.5px;line-height:16px}
.dsh-rtm-plugin-state{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#57606a);font-size:10.5px;font-weight:650;line-height:16px;white-space:nowrap}
.dsh-rtm-plugin-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:none}
.dsh-rtm-version{font-variant-numeric:tabular-nums;white-space:nowrap}
.dsh-rtm-view-settings-summary{padding:9px 14px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l2,#e5e6eb) 55%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#2563eb) 3%,transparent)}
.dsh-rtm-view-settings-note,.dsh-rtm-view-settings-unavailable{margin:0;color:var(--dsw-alias-label-secondary,#57606a);font-size:10.5px;line-height:16px}
.dsh-rtm-view-settings-unavailable{margin-top:3px;color:var(--dsw-alias-state-warn-primary,#d97706)}
.dsh-rtm-view-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px 14px}
.dsh-rtm-view-setting{min-width:0;justify-content:space-between;padding:8px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-border-l2,#e5e6eb) 70%,transparent);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#f7f8fa)}
.dsh-rtm-view-setting .dsh-rtm-switch-copy{align-items:flex-start}
.dsh-rtm-plugin-switches{display:flex;min-width:205px;flex-direction:column;align-items:stretch;gap:7px;margin-right:4px}
.dsh-rtm-switch-row{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:176px;color:var(--dsw-alias-label-secondary,#57606a);font-size:11px;cursor:pointer}
.dsh-rtm-switch-copy{display:flex;min-width:0;flex:1;flex-direction:column;align-items:flex-end;line-height:1.25}
.dsh-rtm-switch-copy small{color:var(--dsw-alias-label-tertiary,#8a919f);font-size:9.5px}
.dsh-rtm-switch{position:relative;display:inline-block;flex:none;width:34px;height:19px}
.dsh-rtm-switch input{position:absolute;inset:0;z-index:1;margin:0;opacity:0;cursor:pointer}
.dsh-rtm-switch i{position:absolute;inset:0;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:999px;background:var(--dsw-alias-bg-layer-2,#e9eaee);transition:background .15s,border-color .15s}
.dsh-rtm-switch i::after{content:"";position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:left .15s}
.dsh-rtm-switch input:checked+i{border-color:transparent;background:var(--dsw-alias-state-business-primary,#2563eb)}
.dsh-rtm-switch input:checked+i::after{left:17px}
.dsh-rtm-switch input:focus-visible+i{outline:2px solid color-mix(in srgb,var(--dsw-alias-state-business-primary,#2563eb) 55%,transparent);outline-offset:2px}
.dsh-rtm-switch input:disabled{cursor:not-allowed}
.dsh-rtm-switch input:disabled+i{opacity:.5}
.dsh-rtm-switch-row:has(input:disabled){cursor:not-allowed}

/* ---- operations ---- */
.dsh-rtm-ops{display:flex;flex-direction:column}
.dsh-rtm-op{display:flex;flex-direction:column;gap:6px;padding:9px 14px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l2,#e5e6eb) 55%,transparent)}
.dsh-rtm-op:last-child{border-bottom:0}
.dsh-rtm-op-head{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.dsh-rtm-op-state{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:650;line-height:16px;white-space:nowrap}
.dsh-rtm-op-target{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,#1f2329);font-weight:650}
.dsh-rtm-op-kind{color:var(--dsw-alias-label-tertiary,#8a919f);font-size:10.5px;line-height:16px}
.dsh-rtm-op-detail{color:var(--dsw-alias-label-secondary,#57606a);font-size:10.5px;line-height:15px;word-break:break-word}
.dsh-rtm-op-error{color:var(--dsw-alias-state-error-primary,#d92d20);font-size:10.5px;line-height:15px;word-break:break-word}
.dsh-rtm-op-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap}

.dsh-rtm-progress{display:flex;align-items:center;gap:8px;min-width:0}
.dsh-rtm-progress-track{position:relative;flex:1;min-width:120px;height:6px;overflow:hidden;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#e9eaee)}
.dsh-rtm-progress-fill{height:100%;border-radius:inherit;background:var(--dsw-alias-state-business-primary,#2563eb);transition:width .2s ease}
.dsh-rtm-progress--indeterminate .dsh-rtm-progress-fill{width:35%;animation:dsh-rtm-indeterminate 1.1s ease-in-out infinite}
@keyframes dsh-rtm-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(290%)}}
.dsh-rtm-progress-value{flex:none;min-width:34px;color:var(--dsw-alias-label-tertiary,#8a919f);font-size:10px;line-height:15px;font-variant-numeric:tabular-nums;text-align:right}

/* ---- confirm dialog ---- */
.dsh-rtm-confirm-list{margin:0;padding-left:18px;color:var(--dsw-alias-label-primary,#1f2329);font-size:12px;line-height:20px}

/* ---- danger button (primitives have no danger variant) ---- */
.dsh-rtm-btn--danger{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 45%,var(--dsw-alias-border-l2,#e5e6eb));color:var(--dsw-alias-state-error-primary,#d92d20)}
.dsh-rtm-btn--danger:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary,#d92d20);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 10%,transparent)}

/* ---- focus / polish ---- */
.dsh-rtm .dsh-rtm-btn:focus-visible,
.dsh-rtm button:focus-visible{outline:2px solid color-mix(in srgb,var(--dsw-alias-state-business-primary,#2563eb) 55%,transparent);outline-offset:1px}

/* ---- responsive: two-column stats, wrapping plugin rows below 720px ---- */
@media (max-width:719px){
  .dsh-rtm{padding-inline:14px}
  .dsh-rtm-page-nav{margin-inline:-2px}
  .dsh-rtm-page-button{min-width:76px;padding-inline:12px}
  .dsh-rtm-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .dsh-rtm-stat{padding:9px 12px;border-radius:10px}
  .dsh-rtm-stat>strong{font-size:18px;line-height:24px}
  .dsh-rtm-attention-row{align-items:flex-start;flex-wrap:wrap}
  .dsh-rtm-attention-main{flex-basis:calc(100% - 24px)}
  .dsh-rtm-plugin-row{align-items:flex-start;flex-wrap:wrap;gap:8px 12px}
  .dsh-rtm-plugin-actions{flex:1 1 100%;justify-content:flex-end;padding-top:2px}
  .dsh-rtm-view-settings-grid{grid-template-columns:1fr}
  .dsh-rtm-plugin-switches{flex:1 1 100%;width:100%;margin:0 0 2px}
  .dsh-rtm-switch-row{width:100%;justify-content:space-between}
  .dsh-rtm-switch-copy{align-items:flex-start}
  .dsh-rtm-batchbar-hint{margin-left:0;flex-basis:100%}
}

/* The Host settings shell is two-column by default; stack its navigation only
   while this page is selected on phone-sized viewports. */
@media (max-width:559px){
  [role="dialog"]:has(.dsh-rtm){flex-direction:column}
  [role="dialog"]:has(.dsh-rtm)>nav{width:100%;padding:10px 12px 0}
  [role="dialog"]:has(.dsh-rtm)>nav>:first-child{display:none}
  [role="dialog"]:has(.dsh-rtm)>nav>:last-child{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;padding-bottom:8px}
  [role="dialog"]:has(.dsh-rtm)>nav>:last-child>button{width:100%!important;min-width:0;padding:7px 10px;white-space:normal}
  [role="dialog"]:has(.dsh-rtm)>:not(nav){width:100%;min-height:0}
  .dsh-rtm{padding-inline:10px}
  .dsh-rtm-stats{grid-template-columns:1fr}
}

/* ---- reduced motion ---- */
@media (prefers-reduced-motion: reduce){
  .dsh-rtm-spin,.dsh-rtm-progress--indeterminate .dsh-rtm-progress-fill{animation:none}
  .dsh-rtm-progress-fill,.dsh-rtm-switch i,.dsh-rtm-switch i::after{transition:none}
}
`;
function installStyles() {
  const existing = document.getElementById(STYLE_ID);
  if (existing !== null) return () => void 0;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS_TEXT;
  document.head.append(style);
  return () => {
    style.remove();
  };
}

// src/client/index.ts
var name = "dsh-redteam-model-client";
var inject = ["slots", "locale", "connection"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-redteam-model: locale");
  ctx.effect(() => installStyles(), "dsh-redteam-model: styles");
  const settingsScope = typeof ctx.provide === "function" ? createSettingsScopeService() : ctx.settingsScope;
  if (typeof ctx.provide === "function") {
    try {
      ctx.provide("settingsScope", settingsScope);
    } catch {
    }
  }
  const controller = new AdminController(ctx.connection);
  const face = controller.inject();
  const t = ctx.locale.bind(NS);
  const visibilityScope = settingsScope.bind({
    namespace: CONVERSATION_VIEW_SETTINGS_NAMESPACE,
    decode: decodeConversationViewSettings
  });
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "redteam-manager",
    order: 120,
    label: () => t("nav")
  }, createAdminPage(face, t, visibilityScope)));
}
return module.exports; } });
//# sourceMappingURL=client.js.map
