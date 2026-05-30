const STORAGE_KEY = "codex.skill-tree.enabled.v1";
const GLOBAL_STORAGE_KEY = "codex.primitive-tree.enabled.global.v1";
const PROVIDERS_STORAGE_KEY = "codex.primitive-tree.providers.local.v1";
const GLOBAL_PROVIDERS_STORAGE_KEY = "codex.primitive-tree.providers.global.v1";
const PLATFORM_KEY = "codex.primitive-tree.platform.v1";
const SCOPE_KEY = "codex.primitive-tree.scope.v1";
const TYPE_FILTER_KEY = "codex.primitive-tree.type-filter.v1";
const ZOOM_KEY = "codex.skill-tree.zoom.v1";
const REGISTRY_URL = "../registry/skill-tree.json";
const TREE_WIDTH = 1180;
const TREE_HEIGHT = 760;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;
const DETECTION_LIMIT = 700;
const DETECTION_DEPTH = 5;

const els = {
  field: document.getElementById("field"),
  unlockLayer: document.getElementById("unlockLayer"),
  typeTabs: document.getElementById("typeTabs"),
  groupRail: document.getElementById("groupRail"),
  treeViewport: document.querySelector(".tree-viewport"),
  treeSpace: document.getElementById("treeSpace"),
  treeStage: document.getElementById("treeStage"),
  treeMap: document.getElementById("treeMap"),
  linkLayer: document.getElementById("linkLayer"),
  enabledCount: document.getElementById("enabledCount"),
  availableCount: document.getElementById("availableCount"),
  capabilityCount: document.getElementById("capabilityCount"),
  projectPath: document.getElementById("projectPath"),
  selectedIcon: document.getElementById("selectedIcon"),
  selectedState: document.getElementById("selectedState"),
  selectedTitle: document.getElementById("selectedTitle"),
  selectedSummary: document.getElementById("selectedSummary"),
  selectedPath: document.getElementById("selectedPath"),
  selectedMeta: document.getElementById("selectedMeta"),
  providesList: document.getElementById("providesList"),
  requiresList: document.getElementById("requiresList"),
  recommendsList: document.getElementById("recommendsList"),
  providerSelectionBlock: document.getElementById("providerSelectionBlock"),
  providerChoices: document.getElementById("providerChoices"),
  detectedState: document.getElementById("detectedState"),
  detectedList: document.getElementById("detectedList"),
  markdownTitle: document.getElementById("markdownTitle"),
  markdownState: document.getElementById("markdownState"),
  markdownBody: document.getElementById("markdownBody"),
  togglePrimitive: document.getElementById("togglePrimitive"),
  manifestPreview: document.getElementById("manifestPreview"),
  manifestState: document.getElementById("manifestState"),
  platformButtons: Array.from(document.querySelectorAll("[data-platform]")),
  scopeButtons: Array.from(document.querySelectorAll("[data-scope]")),
  selectProject: document.getElementById("selectProject"),
  detectPrimitives: document.getElementById("detectPrimitives"),
  copyManifest: document.getElementById("copyManifest"),
  resetTree: document.getElementById("resetTree"),
  zoomOut: document.getElementById("zoomOut"),
  zoomIn: document.getElementById("zoomIn"),
  zoomFit: document.getElementById("zoomFit"),
  zoomReset: document.getElementById("zoomReset"),
  zoomRange: document.getElementById("zoomRange"),
  zoomValue: document.getElementById("zoomValue")
};

let registry = null;
let activePlatform = loadPlatform();
let activeScope = loadScope();
let activeType = loadActiveType();
let enabled = new Set(loadEnabledForScope(activeScope));
let selectedProviders = loadProvidersForScope(activeScope);
let selectedId = null;
let treeZoom = loadZoom();
let projectHandle = null;
let projectName = "local";
let detectedPrimitives = [];
let selectedDetectedKey = "";
let markdownLoadToken = 0;
let activeMarkdownKey = "";
const markdownCache = new Map();

const TYPE_ALIASES = {
  skill: "skill",
  skills: "skill",
  agent: "agent",
  agents: "agent",
  command: "command",
  commands: "command",
  slash_command: "command",
  slash_commands: "command",
  "slash-command": "command",
  "slash-commands": "command"
};

const TYPE_LABELS = {
  skill: { singular: "Skill", plural: "Skills" },
  agent: { singular: "Agent", plural: "Agents" },
  command: { singular: "Command", plural: "Commands" }
};

const PLATFORM_LABELS = {
  claude: "Claude",
  codex: "Codex"
};

const THEMES = {
  fire: { a: "#ffcf55", b: "#ff5a1f", c: "#7a1b0c", label: "Roaring Fire" },
  water: { a: "#9ff8ff", b: "#2f9dff", c: "#103f66", label: "Tidal Water" },
  electric: { a: "#f8ff7a", b: "#64ddff", c: "#3520ff", label: "Arc Lightning" },
  prism: { a: "#ff7af6", b: "#70f6ff", c: "#fff06a", label: "Prism Bloom" },
  forge: { a: "#ffd27a", b: "#ff4b35", c: "#2b1510", label: "Forge Sparks" },
  wind: { a: "#e8fff4", b: "#89f7d2", c: "#426a58", label: "Gale Current" },
  aether: { a: "#f5fbff", b: "#a987ff", c: "#3f5bff", label: "Aether Wake" },
  ink: { a: "#e8d6ff", b: "#8d5cff", c: "#171027", label: "Ink Bloom" },
  earth: { a: "#e7d987", b: "#75d16b", c: "#293b1f", label: "Living Earth" },
  plasma: { a: "#ffd1ff", b: "#ff5fef", c: "#6d35ff", label: "Plasma Crown" }
};

function loadPlatform() {
  return localStorage.getItem(PLATFORM_KEY) === "claude" ? "claude" : "codex";
}

function loadScope() {
  return localStorage.getItem(SCOPE_KEY) === "global" ? "global" : "local";
}

function loadActiveType() {
  return localStorage.getItem(TYPE_FILTER_KEY) || "all";
}

function platformLabel(platform = activePlatform) {
  return PLATFORM_LABELS[platform] || platform;
}

function storageKeyForScope(scope, platform = activePlatform) {
  if (platform === "codex") return scope === "global" ? GLOBAL_STORAGE_KEY : STORAGE_KEY;
  return `${platform}.primitive-tree.enabled.${scope}.v1`;
}

function providerStorageKeyForScope(scope, platform = activePlatform) {
  if (platform === "codex") return scope === "global" ? GLOBAL_PROVIDERS_STORAGE_KEY : PROVIDERS_STORAGE_KEY;
  return `${platform}.primitive-tree.providers.${scope}.v1`;
}

function loadEnabledForScope(scope) {
  try {
    const raw = localStorage.getItem(storageKeyForScope(scope));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function normalizeProviderMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry) => entry[1] !== undefined && entry[1] !== null)
      .map(([capability, provider]) => [String(capability), String(provider)])
  );
}

function loadProvidersForScope(scope) {
  try {
    const raw = localStorage.getItem(providerStorageKeyForScope(scope));
    return raw ? normalizeProviderMap(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function saveEnabled() {
  const effectiveProviders = providers();
  localStorage.setItem(storageKeyForScope(activeScope), JSON.stringify(Array.from(enabled).sort()));
  localStorage.setItem(providerStorageKeyForScope(activeScope), JSON.stringify(effectiveProviders));
  localStorage.setItem(PLATFORM_KEY, activePlatform);
  localStorage.setItem(SCOPE_KEY, activeScope);
  selectedProviders = effectiveProviders;
  if (projectHandle && activeScope === "local") void persistProjectManifest();
}

function loadZoom() {
  const raw = Number(localStorage.getItem(ZOOM_KEY));
  return Number.isFinite(raw) && raw >= MIN_ZOOM && raw <= MAX_ZOOM ? raw : 0.86;
}

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function setZoom(value, options = {}) {
  treeZoom = clampZoom(value);
  if (!options.skipPersist) localStorage.setItem(ZOOM_KEY, String(treeZoom));
  const scaledWidth = Math.ceil(TREE_WIDTH * treeZoom);
  const scaledHeight = Math.ceil(TREE_HEIGHT * treeZoom);
  els.treeSpace.style.width = `${scaledWidth}px`;
  els.treeSpace.style.height = `${scaledHeight}px`;
  els.treeStage.style.transform = `scale(${treeZoom})`;
  els.zoomRange.value = String(Math.round(treeZoom * 100));
  els.zoomValue.textContent = `${Math.round(treeZoom * 100)}%`;
}

function fitZoom() {
  const rect = els.treeViewport.getBoundingClientRect();
  const xFit = Math.max(MIN_ZOOM, (rect.width - 24) / TREE_WIDTH);
  const yFit = Math.max(MIN_ZOOM, (rect.height - 24) / TREE_HEIGHT);
  return clampZoom(Math.min(xFit, yFit, 1));
}

function zoomToFit() {
  setZoom(fitZoom());
}

function capabilityLabel(capability) {
  return registry.capabilities?.[capability]?.label || capability;
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function stringArray(value) {
  return asArray(value).filter((item) => item !== undefined && item !== null).map((item) => String(item));
}

function normalizeType(type) {
  const key = String(type || "skill").trim().replace(/\s+/g, "-").toLowerCase();
  return TYPE_ALIASES[key] || key || "skill";
}

function typeLabel(type, plural = false) {
  const normalized = normalizeType(type);
  const known = TYPE_LABELS[normalized];
  if (known) return plural ? known.plural : known.singular;
  const title = normalized
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  if (!plural) return title;
  return title.endsWith("s") ? title : `${title}s`;
}

function primitiveTypeConfig(type) {
  const configs = registry?.primitiveTypes || registry?.primitive_types || {};
  return configs[type] || configs[`${type}s`] || {};
}

function primitiveRootForType(type) {
  const config = primitiveTypeConfig(type);
  return config.root || config.path || `${type}s`;
}

function joinPath(...parts) {
  return parts
    .flat()
    .filter((part) => part !== undefined && part !== null && String(part).length)
    .map((part) => String(part).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function normalizePath(value) {
  return joinPath(String(value || "").replace(/\\/g, "/").split("/"));
}

function markdownFileForPrimitivePath(type, primitivePath) {
  const normalized = normalizePath(primitivePath);
  if (!normalized) return "";
  if (normalized.endsWith(".md") || normalized.endsWith("/SKILL.md")) return normalized;
  return type === "skill" ? `${normalized}/SKILL.md` : normalized;
}

function normalizeRegistry(raw) {
  const primitives = {};
  const addPrimitive = (id, value, fallbackType) => {
    if (!id || !value || typeof value !== "object" || Array.isArray(value)) return;
    if (primitives[id]) return;
    const type = normalizeType(value.type || value.kind || value.primitiveType || fallbackType || "skill");
    const unlockedBy = value.unlockedBy !== undefined ? value.unlockedBy : value.unlocked_by;
    primitives[id] = {
      ...value,
      id,
      type,
      provides: stringArray(value.provides),
      requires: stringArray(value.requires),
      recommends: stringArray(value.recommends),
      unlockedBy: stringArray(unlockedBy),
      scopes: value.scopes === undefined && value.scope === undefined
        ? ["global", "local"]
        : stringArray(value.scopes !== undefined ? value.scopes : value.scope)
    };
  };
  const addCollection = (collection, fallbackType) => {
    if (!collection) return;
    if (Array.isArray(collection)) {
      for (const item of collection) {
        addPrimitive(item?.id || item?.name || item?.key, item, fallbackType);
      }
      return;
    }
    if (typeof collection === "object") {
      for (const [id, value] of Object.entries(collection)) addPrimitive(id, value, fallbackType);
    }
  };

  if (raw.primitives) {
    if (Array.isArray(raw.primitives)) {
      addCollection(raw.primitives, "skill");
    } else if (typeof raw.primitives === "object") {
      const entries = Object.entries(raw.primitives);
      const looksFlat = entries.some(([, value]) => isPrimitiveRecord(value));
      if (looksFlat) {
        for (const [id, value] of entries) addPrimitive(id, value, value?.type);
      } else {
        for (const [type, collection] of entries) addCollection(collection, normalizeType(type));
      }
    }
  }

  addCollection(raw.skills, "skill");
  return { ...raw, primitives };
}

function isPrimitiveRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return ["provides", "requires", "recommends", "path", "position", "group", "title", "type", "kind", "primitiveType"].some(
    (key) => Object.prototype.hasOwnProperty.call(value, key)
  );
}

function primitiveEntries() {
  return Object.entries(registry.primitives || {});
}

function visiblePrimitiveEntries() {
  const entries = primitiveEntries();
  return entries.filter(([, primitive]) => {
    if (!supportsScope(primitive)) return false;
    return activeType === "all" || primitive.type === activeType;
  });
}

function primitiveTypes() {
  return new Set(primitiveEntries().map(([, primitive]) => primitive.type));
}

function tabTypes() {
  const types = primitiveTypes();
  for (const required of ["skill", "agent", "command"]) types.add(required);
  const ordered = ["skill", "agent", "command"];
  const dynamic = Array.from(types)
    .filter((type) => !ordered.includes(type))
    .sort((a, b) => typeLabel(a, true).localeCompare(typeLabel(b, true)));
  return ["all", ...ordered, ...dynamic];
}

function themeFor(primitive) {
  return THEMES[primitive.theme] || THEMES.aether;
}

function supportsScope(primitive) {
  const scopes = primitive.scopes || ["global", "local"];
  return scopes.length === 0 || scopes.includes(activeScope);
}

function platformPrimitivePath(primitive, platform = activePlatform) {
  if (!primitive) return "";
  if (primitive.platforms && typeof primitive.platforms === "object" && !Array.isArray(primitive.platforms)) {
    return primitive.platforms[platform]?.path || "";
  }
  if (platform !== "codex" && String(primitive.path || "").startsWith("skills/.system/")) return "";
  return primitive.path || "";
}

function platformSourcePath(filePath, platform = activePlatform) {
  const normalized = normalizePath(filePath);
  if (!normalized) return "";
  return normalized.startsWith(`${platform}/`) ? normalized : `${platform}/${normalized}`;
}

function primitivePathLabel(primitive) {
  const platformPath = platformPrimitivePath(primitive);
  if (platformPath) return platformSourcePath(platformPath);
  if (primitive.platforms && typeof primitive.platforms === "object" && !Array.isArray(primitive.platforms)) {
    return `${platformLabel()}: (no registered path)`;
  }
  return "";
}

function registryMarkdownPath(primitive, platform = activePlatform) {
  if (!primitive) return "";
  const platformPath = platformPrimitivePath(primitive, platform);
  return markdownFileForPrimitivePath(primitive.type, platformPath);
}

function registryMarkdownLabel(primitive, platform = activePlatform) {
  return platformSourcePath(registryMarkdownPath(primitive, platform), platform);
}

function registryPathCandidates(id, primitive) {
  const candidates = new Set();
  const add = (filePath, platform) => {
    const normalized = normalizePath(filePath);
    if (!normalized) return;
    candidates.add(normalized);
    if (platform) {
      candidates.add(normalizePath(`${platform}/${normalized}`));
      candidates.add(normalizePath(`.${platform}/${normalized}`));
    }
  };

  add(registryMarkdownPath(primitive, "codex"), "codex");
  if (primitive.path) {
    add(markdownFileForPrimitivePath(primitive.type, primitive.path), "claude");
  }
  if (primitive.platforms && typeof primitive.platforms === "object" && !Array.isArray(primitive.platforms)) {
    for (const [platform, config] of Object.entries(primitive.platforms)) {
      add(markdownFileForPrimitivePath(primitive.type, config?.path), platform);
    }
  }
  if (primitive.type === "skill") {
    add(`skills/${id}/SKILL.md`, "codex");
    add(`skills/${id}/SKILL.md`, "claude");
  }
  return candidates;
}

function managedIdForDetected(item) {
  const itemPaths = new Set([
    normalizePath(item.sourcePath),
    normalizePath(item.rootRelativePath),
    normalizePath(item.primitivePath),
    normalizePath(item.rootRelativePrimitivePath)
  ]);
  for (const [id, primitive] of primitiveEntries()) {
    if (primitive.type !== item.type) continue;
    if (id === item.id) return id;
    const candidates = registryPathCandidates(id, primitive);
    for (const itemPath of itemPaths) {
      if (itemPath && candidates.has(itemPath)) return id;
    }
  }
  return "";
}

function staleValue(value) {
  if (value === true) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "stale", "true", "yes"].includes(normalized);
}

function portStateFor(primitive) {
  const rawState = primitive.portState !== undefined ? primitive.portState : primitive.port_state;
  if (staleValue(primitive.stale) || staleValue(primitive.stalePort) || staleValue(primitive.stale_port)) return "stale";
  if (staleValue(rawState)) return "stale";
  return rawState === undefined || rawState === null ? "" : String(rawState).trim().toLowerCase();
}

function isStalePort(primitive) {
  return portStateFor(primitive) === "stale";
}

function allProviderCandidates(capability) {
  return primitiveEntries()
    .filter(([, primitive]) => (primitive.provides || []).includes(capability))
    .map(([id, primitive]) => ({ id, primitive }));
}

function enabledProviderCandidates(capability) {
  return allProviderCandidates(capability)
    .filter(({ id, primitive }) => enabled.has(id) && supportsScope(primitive));
}

function hasProviderCandidate(capability) {
  return allProviderCandidates(capability).length > 0;
}

function providerName(id) {
  const primitive = registry.primitives[id];
  return primitive?.title || id;
}

function providers() {
  const provided = {};
  for (const id of enabled) {
    const primitive = registry.primitives[id];
    if (!primitive || !supportsScope(primitive)) continue;
    for (const capability of primitive.provides || []) {
      const selectedProvider = selectedProviders[capability];
      if (selectedProvider === id || !provided[capability]) provided[capability] = id;
    }
  }
  return provided;
}

function missingRequired(primitive, provided = providers()) {
  return (primitive.requires || []).filter((capability) => !provided[capability]);
}

function missingRecommended(primitive, provided = providers()) {
  return (primitive.recommends || []).filter((capability) => !provided[capability]);
}

function stateFor(id, provided = providers()) {
  const primitive = registry.primitives[id];
  if (!primitive) return "hidden";
  if (!supportsScope(primitive)) return "hidden";
  if (enabled.has(id)) return "enabled";
  if ((primitive.unlockedBy || []).some((parentId) => !enabled.has(parentId))) return "locked";
  const missing = missingRequired(primitive, provided);
  if (missing.some((capability) => !hasProviderCandidate(capability))) return "missing-provider";
  if (missing.length) return "locked";
  return "available";
}

function manifest() {
  return {
    version: 1,
    platform: activePlatform,
    scope: activeScope,
    project: activeScope === "local" && projectHandle ? projectName : undefined,
    enabled: Array.from(enabled).sort(),
    providers: providers(),
    updatedAt: new Date().toISOString()
  };
}

function cleanManifest(value) {
  return JSON.parse(JSON.stringify(value, (_key, val) => (val === undefined ? undefined : val)));
}

function setProjectStatus(text) {
  els.manifestState.textContent = text;
}

function manifestStateLabel() {
  return `${activePlatform}/${activeScope}`;
}

function updateProjectLabel() {
  const manifestPath = manifestPathForScope("local");
  if (projectHandle) {
    els.projectPath.textContent = `${platformLabel()} project: ${projectName}/${manifestPath}`;
    els.selectProject.classList.remove("unsupported");
    els.selectProject.querySelector("small").textContent = "Selected";
    els.selectProject.title = `Selected project: ${projectName}`;
  } else {
    const scopePath = activeScope === "global" ? manifestPathForScope("global") : manifestPath;
    els.projectPath.textContent = `${platformLabel()} ${activeScope === "global" ? "global" : "project"} primitives: ${scopePath}`;
    els.selectProject.querySelector("small").textContent = "Project";
    els.selectProject.title = supportsFolderPicker()
      ? "Select project folder"
      : "Folder picker unavailable in this browser";
  }
}

function supportsFolderPicker() {
  return typeof window.showDirectoryPicker === "function";
}

function manifestPathForScope(scope, platform = activePlatform) {
  const paths = registry?.manifestPaths || registry?.manifest_paths || {};
  const platformPaths = paths[platform] || {};
  if (platformPaths[scope]) return platformPaths[scope];
  if (platform === "codex") return registry?.manifestPath || registry?.manifest_path || ".codex/project-skills.json";
  return `.${platform}/project-primitives.json`;
}

function registryMarkdownUrl(primitive, platform = activePlatform) {
  const markdownPath = registryMarkdownPath(primitive, platform);
  if (!markdownPath) return "";
  const normalized = normalizePath(markdownPath);
  const rootRelativePath = platform === "codex" && normalized.startsWith("codex/")
    ? normalized.slice("codex/".length)
    : platform === "codex" ? normalized : platformSourcePath(normalized, platform);
  const prefix = platform === "codex" ? "../" : "../../";
  return `${prefix}${rootRelativePath.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function splitManifestPath(manifestPath) {
  const parts = manifestPath.split("/").filter(Boolean);
  return {
    dirs: parts.slice(0, -1),
    file: parts[parts.length - 1] || "project-primitives.json"
  };
}

async function getManifestFileHandle(handle, manifestPath, options = {}) {
  const { dirs, file } = splitManifestPath(manifestPath);
  let dir = handle;
  for (const part of dirs) {
    dir = await dir.getDirectoryHandle(part, { create: Boolean(options.create) });
  }
  return dir.getFileHandle(file, { create: Boolean(options.create) });
}

function legacyManifestPathForPlatform(platform = activePlatform) {
  if (platform === "codex") return registry?.manifestPath || registry?.manifest_path || ".codex/project-skills.json";
  return `.${platform}/project-skills.json`;
}

async function readProjectManifest(handle, platform = activePlatform) {
  try {
    const fileHandle = await getManifestFileHandle(handle, manifestPathForScope("local", platform), { create: false });
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text());
  } catch (error) {
    if (error && (error.name === "NotFoundError" || error.name === "TypeMismatchError")) {
      try {
        const legacyHandle = await getManifestFileHandle(handle, legacyManifestPathForPlatform(platform), { create: false });
        const legacyFile = await legacyHandle.getFile();
        return JSON.parse(await legacyFile.text());
      } catch (legacyError) {
        if (legacyError && (legacyError.name === "NotFoundError" || legacyError.name === "TypeMismatchError")) {
          return { version: 1, platform, scope: "local", enabled: [], providers: {} };
        }
        throw legacyError;
      }
    }
    throw error;
  }
}

async function persistProjectManifest() {
  if (!projectHandle) return;
  try {
    setProjectStatus("saving");
    const fileHandle = await getManifestFileHandle(projectHandle, manifestPathForScope("local"), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(`${JSON.stringify(cleanManifest(manifest()), null, 2)}\n`);
    await writable.close();
    setProjectStatus(`saved: ${projectName}`);
  } catch (error) {
    setProjectStatus("save failed");
    console.error(error);
  }
}

async function selectProjectFolder() {
  if (!supportsFolderPicker()) {
    els.selectProject.classList.add("unsupported");
    setProjectStatus("folder picker unsupported");
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({
      id: "codex-primitive-tree-project",
      mode: "readwrite"
    });
    if (typeof handle.requestPermission === "function") {
      const permission = await handle.requestPermission({ mode: "readwrite" });
      if (permission !== "granted") {
        setProjectStatus("permission denied");
        return;
      }
    }

    const projectManifest = await readProjectManifest(handle, activePlatform);
    projectHandle = handle;
    projectName = handle.name || "selected project";
    detectedPrimitives = [];
    selectedDetectedKey = "";
    markdownCache.clear();
    activeScope = "local";
    enabled = new Set((projectManifest.enabled || []).filter((id) => registry.primitives[id] && supportsScope(registry.primitives[id])));
    selectedProviders = normalizeProviderMap(projectManifest.providers || {});
    localStorage.setItem(storageKeyForScope(activeScope), JSON.stringify(Array.from(enabled).sort()));
    localStorage.setItem(providerStorageKeyForScope(activeScope), JSON.stringify(selectedProviders));
    localStorage.setItem(PLATFORM_KEY, activePlatform);
    localStorage.setItem(SCOPE_KEY, activeScope);
    updateProjectLabel();
    updateScopeButtons();
    setProjectStatus(`loaded: ${projectName}`);
    render();
    void detectPrimitivesInFolder(handle, projectName);
  } catch (error) {
    if (error && error.name === "AbortError") {
      setProjectStatus("selection cancelled");
      return;
    }
    setProjectStatus("project load failed");
    console.error(error);
  }
}

async function getDirectoryByPath(handle, parts) {
  let dir = handle;
  for (const part of parts) {
    if (!part) continue;
    try {
      dir = await dir.getDirectoryHandle(part, { create: false });
    } catch (error) {
      if (error && (error.name === "NotFoundError" || error.name === "TypeMismatchError")) return null;
      throw error;
    }
  }
  return dir;
}

async function scanSkillRoot(dir, rootPath, limitState, output, relParts = [], depth = 0) {
  if (output.length >= DETECTION_LIMIT || depth > DETECTION_DEPTH) return;
  for await (const entry of dir.values()) {
    if (output.length >= DETECTION_LIMIT) {
      limitState.hit = true;
      return;
    }
    if (entry.kind === "file" && entry.name === "SKILL.md" && relParts.length) {
      const primitiveParts = relParts;
      const id = primitiveParts[primitiveParts.length - 1];
      const sourcePath = joinPath(rootPath, ...primitiveParts, "SKILL.md");
      const item = {
        key: `skill:${sourcePath}`,
        id,
        type: "skill",
        title: id,
        sourcePath,
        primitivePath: joinPath(rootPath, ...primitiveParts),
        rootRelativePath: joinPath("skills", ...primitiveParts, "SKILL.md"),
        rootRelativePrimitivePath: joinPath("skills", ...primitiveParts),
        fileHandle: entry
      };
      item.managedId = managedIdForDetected(item);
      output.push(item);
    } else if (entry.kind === "directory") {
      await scanSkillRoot(entry, rootPath, limitState, output, [...relParts, entry.name], depth + 1);
    }
  }
}

async function scanMarkdownRoot(dir, type, rootPath, limitState, output, relParts = [], depth = 0) {
  if (output.length >= DETECTION_LIMIT || depth > DETECTION_DEPTH) return;
  for await (const entry of dir.values()) {
    if (output.length >= DETECTION_LIMIT) {
      limitState.hit = true;
      return;
    }
    if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".md")) {
      const root = primitiveRootForType(type);
      const fileParts = [...relParts, entry.name];
      const id = entry.name.replace(/\.md$/i, "");
      const sourcePath = joinPath(rootPath, ...fileParts);
      const item = {
        key: `${type}:${sourcePath}`,
        id,
        type,
        title: id,
        sourcePath,
        primitivePath: sourcePath,
        rootRelativePath: joinPath(root, ...fileParts),
        rootRelativePrimitivePath: joinPath(root, ...fileParts),
        fileHandle: entry
      };
      item.managedId = managedIdForDetected(item);
      output.push(item);
    } else if (entry.kind === "directory") {
      await scanMarkdownRoot(entry, type, rootPath, limitState, output, [...relParts, entry.name], depth + 1);
    }
  }
}

function detectionPrefixes() {
  return ["", "codex", "claude", ".codex", ".claude", ".agents"];
}

async function scanPrimitiveRoots(handle) {
  const output = [];
  const limitState = { hit: false };
  const seenRoots = new Set();
  const types = Array.from(primitiveTypes()).sort((a, b) => typeLabel(a, true).localeCompare(typeLabel(b, true)));

  for (const prefix of detectionPrefixes()) {
    for (const type of types) {
      const root = primitiveRootForType(type);
      const rootParts = [prefix, root].filter(Boolean);
      const rootPath = joinPath(rootParts);
      if (!rootPath || seenRoots.has(`${type}:${rootPath}`)) continue;
      seenRoots.add(`${type}:${rootPath}`);
      const dir = await getDirectoryByPath(handle, rootParts);
      if (!dir) continue;
      if (type === "skill") {
        await scanSkillRoot(dir, rootPath, limitState, output);
      } else {
        await scanMarkdownRoot(dir, type, rootPath, limitState, output);
      }
      if (limitState.hit) break;
    }
    if (limitState.hit) break;
  }

  output.sort((a, b) => {
    const managed = Number(Boolean(b.managedId)) - Number(Boolean(a.managedId));
    if (managed) return managed;
    return `${a.type}:${a.sourcePath}`.localeCompare(`${b.type}:${b.sourcePath}`);
  });
  return { items: output, limited: limitState.hit };
}

async function detectPrimitivesInFolder(handle, label) {
  try {
    els.detectedState.textContent = "scanning";
    detectedPrimitives = [];
    selectedDetectedKey = "";
    renderDetectedList();
    const result = await scanPrimitiveRoots(handle);
    detectedPrimitives = result.items;
    const unmanaged = detectedPrimitives.filter((item) => !item.managedId).length;
    els.detectedState.textContent = `${detectedPrimitives.length} found${unmanaged ? `, ${unmanaged} unmanaged` : ""}${result.limited ? " +" : ""}`;
    setProjectStatus(`scanned: ${label}`);
    render();
  } catch (error) {
    els.detectedState.textContent = "scan failed";
    setProjectStatus("scan failed");
    console.error(error);
    renderDetectedList();
  }
}

async function detectPrimitives() {
  if (!supportsFolderPicker()) {
    els.detectedState.textContent = "unsupported";
    setProjectStatus("folder picker unsupported");
    return;
  }

  try {
    let handle = projectHandle;
    let label = projectName;
    if (!handle) {
      handle = await window.showDirectoryPicker({
        id: "codex-primitive-tree-detect",
        mode: "read"
      });
      label = handle.name || "selected folder";
      if (typeof handle.requestPermission === "function") {
        const permission = await handle.requestPermission({ mode: "read" });
        if (permission !== "granted") {
          els.detectedState.textContent = "permission denied";
          return;
        }
      }
    }
    await detectPrimitivesInFolder(handle, label);
  } catch (error) {
    if (error && error.name === "AbortError") {
      els.detectedState.textContent = "scan cancelled";
      return;
    }
    els.detectedState.textContent = "scan failed";
    console.error(error);
  }
}

function renderGroups() {
  els.groupRail.innerHTML = "";
  for (const [id, group] of Object.entries(registry.groups)) {
    const chip = document.createElement("div");
    chip.className = "group-chip";
    chip.style.setProperty("--accent", group.accent);
    chip.textContent = group.label;
    chip.title = group.description || id;
    els.groupRail.appendChild(chip);
  }
}

function renderTypeTabs() {
  els.typeTabs.innerHTML = "";
  const counts = {};
  for (const [, primitive] of primitiveEntries()) {
    if (!supportsScope(primitive)) continue;
    counts[primitive.type] = (counts[primitive.type] || 0) + 1;
  }
  const allCount = Object.values(counts).reduce((total, count) => total + count, 0);

  for (const type of tabTypes()) {
    const count = type === "all" ? allCount : counts[type] || 0;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `type-tab${activeType === type ? " active" : ""}`;
    button.textContent = type === "all" ? `All ${count}` : `${typeLabel(type, true)} ${count}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", activeType === type ? "true" : "false");
    button.disabled = count === 0 && !["skill", "agent", "command"].includes(type);
    button.addEventListener("click", () => {
      activeType = type;
      localStorage.setItem(TYPE_FILTER_KEY, activeType);
      selectedId = null;
      render();
    });
    els.typeTabs.appendChild(button);
  }
}

function updatePlatformButtons() {
  for (const button of els.platformButtons) {
    const platform = button.dataset.platform;
    button.classList.toggle("active", platform === activePlatform);
    button.setAttribute("aria-pressed", platform === activePlatform ? "true" : "false");
  }
}

function updateScopeButtons() {
  for (const button of els.scopeButtons) {
    const scope = button.dataset.scope;
    button.classList.toggle("active", scope === activeScope);
    button.setAttribute("aria-pressed", scope === activeScope ? "true" : "false");
  }
}

function setPlatform(platform) {
  if (!["claude", "codex"].includes(platform) || platform === activePlatform) return;
  activePlatform = platform;
  enabled = new Set(loadEnabledForScope(activeScope).filter((id) => registry.primitives[id] && supportsScope(registry.primitives[id])));
  selectedProviders = loadProvidersForScope(activeScope);
  localStorage.setItem(PLATFORM_KEY, activePlatform);
  selectedId = null;
  selectedDetectedKey = "";
  activeMarkdownKey = "";
  updateProjectLabel();
  updatePlatformButtons();
  render();
}

function setScope(scope) {
  if (!["local", "global"].includes(scope) || scope === activeScope) return;
  activeScope = scope;
  enabled = new Set(loadEnabledForScope(activeScope).filter((id) => registry.primitives[id] && supportsScope(registry.primitives[id])));
  selectedProviders = loadProvidersForScope(activeScope);
  localStorage.setItem(SCOPE_KEY, activeScope);
  selectedId = null;
  updateProjectLabel();
  updateScopeButtons();
  render();
}

function renderLinks() {
  const provided = providers();
  els.linkLayer.innerHTML = "";
  const visible = new Set(visiblePrimitiveEntries().map(([id]) => id));
  for (const [id, primitive] of visiblePrimitiveEntries()) {
    const childState = stateFor(id, provided);
    for (const parentId of primitive.unlockedBy || []) {
      const parent = registry.primitives[parentId];
      if (!parent || !visible.has(parentId) || !parent.position || !primitive.position) continue;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", parent.position.x);
      line.setAttribute("y1", parent.position.y);
      line.setAttribute("x2", primitive.position.x);
      line.setAttribute("y2", primitive.position.y);
      if (enabled.has(parentId) && childState !== "locked") line.classList.add("hot");
      els.linkLayer.appendChild(line);
    }
  }
}

function renderTree() {
  const provided = providers();
  els.treeMap.innerHTML = "";
  const rows = visiblePrimitiveEntries().map(([id, primitive]) => ({ id, primitive, state: stateFor(id, provided) }));
  const visible = rows.map((row) => row.id);
  const availableCount = rows.filter((row) => row.state === "available").length;

  if (!selectedId || !visible.includes(selectedId)) {
    selectedId =
      visible.find((id) => enabled.has(id)) ||
      visible.find((id) => stateFor(id, provided) === "available") ||
      visible[0] ||
      null;
  }

  for (const { id, primitive, state } of rows) {
    const group = registry.groups[primitive.group];
    const theme = themeFor(primitive);
    const position = primitive.position || { x: 50, y: 50 };
    const button = document.createElement("button");
    button.type = "button";
    const staleClass = isStalePort(primitive) ? " stale-port" : "";
    button.className = `skill-node primitive-node ${state} type-${primitive.type}${staleClass} theme-${primitive.theme || "aether"}${selectedId === id ? " selected" : ""}`;
    button.style.setProperty("--x", `${position.x}%`);
    button.style.setProperty("--y", `${position.y}%`);
    button.style.setProperty("--accent", group?.accent || "#f0c866");
    button.style.setProperty("--theme-a", theme.a);
    button.style.setProperty("--theme-b", theme.b);
    button.style.setProperty("--theme-c", theme.c);
    button.setAttribute("aria-label", `${primitive.title || id} ${typeLabel(primitive.type)} ${state}`);
    button.dataset.primitive = id;
    button.dataset.theme = primitive.theme || "aether";
    button.innerHTML = `
      <span class="node-core"><span class="node-icon">${escapeHtml(primitive.icon || id.slice(0, 3).toUpperCase())}</span></span>
      <span class="node-title">${escapeHtml(primitive.title || id)}</span>
    `;
    button.addEventListener("click", () => {
      selectedId = id;
      selectedDetectedKey = "";
      render();
    });
    els.treeMap.appendChild(button);
  }

  els.enabledCount.textContent = enabled.size;
  els.availableCount.textContent = availableCount;
  els.capabilityCount.textContent = Object.keys(provided).length;
}

function renderInspector() {
  const provided = providers();
  const primitive = selectedId ? registry.primitives[selectedId] : null;
  if (!primitive) {
    els.selectedState.textContent = "Empty";
    els.selectedTitle.textContent = "No primitive selected";
    els.selectedSummary.textContent = "";
    els.selectedPath.textContent = "";
    els.selectedMeta.innerHTML = "";
    els.providerChoices.innerHTML = "";
    els.providerSelectionBlock.hidden = true;
    renderDetectedList();
    renderMarkdownExplorer(null);
    els.manifestState.textContent = manifestStateLabel();
    els.manifestPreview.textContent = JSON.stringify(cleanManifest(manifest()), null, 2);
    return;
  }

  const state = stateFor(selectedId, provided);
  const group = registry.groups[primitive.group];
  const theme = themeFor(primitive);
  els.selectedIcon.textContent = primitive.icon || selectedId.slice(0, 3).toUpperCase();
  els.selectedIcon.style.setProperty("--cold", group?.accent || "#6ad7d2");
  els.selectedIcon.style.setProperty("--theme-a", theme.a);
  els.selectedIcon.style.setProperty("--theme-b", theme.b);
  els.selectedState.textContent = state;
  els.selectedTitle.textContent = primitive.title || selectedId;
  els.selectedSummary.textContent = `${typeLabel(primitive.type)} · ${primitive.summary || ""}`;
  els.selectedPath.textContent = primitivePathLabel(primitive);
  renderMeta(primitive);
  renderChips(els.providesList, primitive.provides || [], provided, "provided");
  renderChips(els.requiresList, primitive.requires || [], provided, "required");
  renderChips(els.recommendsList, primitive.recommends || [], provided, "recommended");
  renderProviderChoices();
  renderDetectedList();
  renderMarkdownExplorer(primitive);

  els.togglePrimitive.classList.toggle("disable", state === "enabled");
  if (state === "enabled") {
    els.togglePrimitive.textContent = `Disable ${typeLabel(primitive.type)}`;
    els.togglePrimitive.disabled = false;
  } else if (state === "available") {
    els.togglePrimitive.textContent = `Enable ${typeLabel(primitive.type)}`;
    els.togglePrimitive.disabled = false;
  } else if (state === "locked") {
    els.togglePrimitive.textContent = "Locked";
    els.togglePrimitive.disabled = true;
  } else if (state === "missing-provider") {
    els.togglePrimitive.textContent = "Missing Provider";
    els.togglePrimitive.disabled = true;
  } else {
    els.togglePrimitive.textContent = "Unavailable";
    els.togglePrimitive.disabled = true;
  }

  els.manifestState.textContent = manifestStateLabel();
  els.manifestPreview.textContent = JSON.stringify(cleanManifest(manifest()), null, 2);
}

function renderChips(container, values, provided, mode) {
  container.innerHTML = "";
  if (!values.length) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "none";
    container.appendChild(chip);
    return;
  }
  for (const capability of values) {
    const chip = document.createElement("span");
    const satisfied = Boolean(provided[capability]);
    chip.className = "chip";
    if (mode === "required" && !satisfied) {
      chip.classList.add(hasProviderCandidate(capability) ? "missing" : "missing-provider");
    }
    if (mode === "recommended" && !satisfied) chip.classList.add("recommended");
    chip.textContent = capabilityLabel(capability);
    if (satisfied) {
      chip.title = `Provided by ${providerName(provided[capability])}`;
    } else if (!hasProviderCandidate(capability)) {
      chip.title = "No primitive in the registry provides this capability";
    }
    container.appendChild(chip);
  }
}

function appendMetaChip(text, className = "") {
  const chip = document.createElement("span");
  chip.className = `meta-chip${className ? ` ${className}` : ""}`;
  chip.textContent = text;
  els.selectedMeta.appendChild(chip);
}

function renderMeta(primitive) {
  els.selectedMeta.innerHTML = "";
  appendMetaChip(typeLabel(primitive.type));
  appendMetaChip(activePlatform);
  appendMetaChip(activeScope);
  if ((primitive.scopes || []).length) appendMetaChip(`scopes: ${(primitive.scopes || []).join(", ")}`);
  const platforms = primitive.platforms && typeof primitive.platforms === "object" && !Array.isArray(primitive.platforms)
    ? Object.keys(primitive.platforms)
    : [];
  if (platforms.length) appendMetaChip(`platforms: ${platforms.join(", ")}`);
  const portState = portStateFor(primitive);
  if (portState) appendMetaChip(`port: ${portState}`, portState === "stale" ? "stale" : "");
}

function providerRoutes() {
  const routes = [];
  const capabilities = new Set();
  for (const [, primitive] of primitiveEntries()) {
    for (const capability of primitive.provides || []) capabilities.add(capability);
  }

  for (const capability of Array.from(capabilities).sort()) {
    const candidates = allProviderCandidates(capability).filter(({ primitive }) => supportsScope(primitive));
    const enabledCandidates = candidates.filter(({ id }) => enabled.has(id));
    if (enabledCandidates.length < 2) continue;
    routes.push({
      capability,
      candidates,
      selected: providers()[capability] || enabledCandidates[0]?.id || ""
    });
  }
  return routes;
}

function renderProviderChoices() {
  const routes = providerRoutes();
  els.providerChoices.innerHTML = "";
  els.providerSelectionBlock.hidden = routes.length === 0;
  if (!routes.length) return;

  for (const route of routes) {
    const row = document.createElement("div");
    row.className = "provider-route";
    const label = document.createElement("div");
    label.className = "provider-route-label";
    label.textContent = capabilityLabel(route.capability);
    row.appendChild(label);

    const buttons = document.createElement("div");
    buttons.className = "provider-route-options";
    for (const { id, primitive } of route.candidates) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `provider-option${route.selected === id ? " active" : ""}`;
      button.disabled = !enabled.has(id);
      button.textContent = primitive.title || id;
      button.title = enabled.has(id) ? `Use ${primitive.title || id}` : "Enable this primitive before selecting it";
      button.addEventListener("click", () => {
        selectedProviders = { ...selectedProviders, [route.capability]: id };
        localStorage.setItem(providerStorageKeyForScope(activeScope), JSON.stringify(selectedProviders));
        saveEnabled();
        render();
      });
      buttons.appendChild(button);
    }
    row.appendChild(buttons);
    els.providerChoices.appendChild(row);
  }
}

function detectedForKey(key) {
  return detectedPrimitives.find((item) => item.key === key) || null;
}

function renderDetectedList() {
  els.detectedList.innerHTML = "";
  const items = detectedPrimitives.filter((item) => activeType === "all" || item.type === activeType);

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "detected-empty";
    empty.textContent = detectedPrimitives.length ? "No detected primitives for this tab." : "Select or scan a folder to detect managed and unmanaged primitives.";
    els.detectedList.appendChild(empty);
    return;
  }

  for (const item of items) {
    const managed = Boolean(item.managedId);
    const isEnabled = managed && enabled.has(item.managedId);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `detected-item${managed ? " managed" : " unmanaged"}${isEnabled ? " enabled" : ""}${selectedDetectedKey === item.key ? " active" : ""}`;
    row.title = item.sourcePath;
    row.innerHTML = `
      <span class="detected-main">
        <strong>${escapeHtml(item.title || item.id)}</strong>
        <small>${escapeHtml(item.sourcePath)}</small>
      </span>
      <span class="detected-tags">
        <span>${escapeHtml(typeLabel(item.type))}</span>
        <span>${managed ? "managed" : "unmanaged"}</span>
        ${isEnabled ? "<span>enabled</span>" : ""}
      </span>
    `;
    row.addEventListener("click", () => {
      selectedDetectedKey = item.key;
      if (item.managedId) selectedId = item.managedId;
      render();
    });
    els.detectedList.appendChild(row);
  }
}

function renderMarkdownExplorer(primitive) {
  const detected = selectedDetectedKey ? detectedForKey(selectedDetectedKey) : null;
  if (detected) {
    void loadMarkdown(
      `detected:${detected.key}`,
      `${typeLabel(detected.type)} Markdown`,
      detected.sourcePath,
      async () => {
        const file = await detected.fileHandle.getFile();
        return file.text();
      }
    );
    return;
  }

  if (!primitive || !selectedId) {
    activeMarkdownKey = "";
    els.markdownTitle.textContent = "Markdown Explorer";
    els.markdownState.textContent = "idle";
    els.markdownBody.innerHTML = `<p class="markdown-empty">Select a primitive to inspect its markdown source.</p>`;
    return;
  }

  const url = registryMarkdownUrl(primitive);
  if (!url) {
    activeMarkdownKey = "";
    els.markdownTitle.textContent = `${primitive.title || selectedId} Markdown`;
    els.markdownState.textContent = "missing path";
    els.markdownBody.innerHTML = `<p class="markdown-empty">No markdown source path is registered for this primitive.</p>`;
    return;
  }

  void loadMarkdown(
    `registry:${activePlatform}:${selectedId}:${url}`,
    `${primitive.title || selectedId} Markdown`,
    registryMarkdownLabel(primitive),
    async () => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load ${registryMarkdownLabel(primitive)} (${response.status})`);
      return response.text();
    }
  );
}

async function loadMarkdown(sourceKey, title, state, loader) {
  if (activeMarkdownKey === sourceKey && markdownCache.has(sourceKey)) return;
  activeMarkdownKey = sourceKey;
  const token = ++markdownLoadToken;
  els.markdownTitle.textContent = title;
  els.markdownState.textContent = "loading";
  els.markdownBody.innerHTML = `<p class="markdown-empty">Loading markdown...</p>`;

  try {
    const markdown = markdownCache.has(sourceKey) ? markdownCache.get(sourceKey) : await loader();
    markdownCache.set(sourceKey, markdown);
    if (token !== markdownLoadToken) return;
    els.markdownState.textContent = state;
    els.markdownBody.innerHTML = renderMarkdown(markdown);
  } catch (error) {
    if (token !== markdownLoadToken) return;
    els.markdownState.textContent = "load failed";
    els.markdownBody.innerHTML = `<p class="markdown-empty">${escapeHtml(error.message || "Unable to load markdown source.")}</p>`;
  }
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let listOpen = false;
  let inCode = false;
  let codeLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listOpen) return;
    html.push("</ul>");
    listOpen = false;
  };
  const flushCode = () => {
    html.push(`<pre class="markdown-code"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        closeList();
        inCode = true;
        codeLines = [];
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length + 1;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      closeList();
      html.push("<hr>");
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    if (/^>\s+/.test(trimmed)) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inlineMarkdown(trimmed.replace(/^>\s+/, ""))}</blockquote>`);
      continue;
    }
    paragraph.push(trimmed);
  }

  if (inCode) flushCode();
  flushParagraph();
  closeList();
  return html.join("");
}

function toggleSelected() {
  if (!selectedId) return;
  const state = stateFor(selectedId);
  if (state === "enabled") {
    enabled.delete(selectedId);
  } else if (state === "available") {
    triggerUnlock(selectedId);
    enabled.add(selectedId);
  }
  saveEnabled();
  render();
}

function triggerUnlock(id) {
  const primitive = registry.primitives[id];
  if (!primitive) return;
  const node = document.querySelector(`button[data-primitive="${id}"]`);
  const rect = node?.getBoundingClientRect();
  const themeName = primitive.theme || "aether";
  const theme = themeFor(primitive);
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  const burst = document.createElement("div");
  burst.className = `unlock-burst theme-${themeName}`;
  burst.style.setProperty("--burst-x", `${cx}px`);
  burst.style.setProperty("--burst-y", `${cy}px`);
  burst.style.setProperty("--theme-a", theme.a);
  burst.style.setProperty("--theme-b", theme.b);
  burst.style.setProperty("--theme-c", theme.c);
  burst.innerHTML = `
    <div class="burst-ring"></div>
    <div class="burst-core">${escapeHtml(primitive.icon || id.slice(0, 3).toUpperCase())}</div>
    <div class="burst-title">${escapeHtml(primitive.title || id)} enabled</div>
  `;

  for (let i = 0; i < 42; i += 1) {
    const particle = document.createElement("i");
    particle.style.setProperty("--i", i);
    particle.style.setProperty("--angle", `${(i / 42) * 360 + (i % 5) * 7}deg`);
    particle.style.setProperty("--distance", `${86 + (i % 9) * 16}px`);
    particle.style.setProperty("--delay", `${(i % 7) * 18}ms`);
    particle.style.setProperty("--size", `${4 + (i % 4)}px`);
    burst.appendChild(particle);
  }

  els.unlockLayer.appendChild(burst);
  window.setTimeout(() => burst.remove(), 1700);
}

async function copyManifest() {
  const text = JSON.stringify(manifest(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    els.manifestState.textContent = "copied";
  } catch {
    els.manifestState.textContent = "copy unavailable";
  }
  window.setTimeout(() => {
    els.manifestState.textContent = manifestStateLabel();
  }, 1200);
}

function resetTree() {
  enabled = new Set();
  selectedProviders = {};
  selectedDetectedKey = "";
  saveEnabled();
  render();
}

function render() {
  renderTypeTabs();
  updatePlatformButtons();
  updateScopeButtons();
  updateProjectLabel();
  renderTree();
  renderLinks();
  renderInspector();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function init() {
  const response = await fetch(REGISTRY_URL);
  registry = normalizeRegistry(await response.json());
  updateProjectLabel();
  if (!supportsFolderPicker()) {
    els.selectProject.classList.add("unsupported");
    els.detectPrimitives.classList.add("unsupported");
    els.detectPrimitives.disabled = true;
  }
  enabled = new Set(Array.from(enabled).filter((id) => registry.primitives[id] && supportsScope(registry.primitives[id])));
  setZoom(treeZoom, { skipPersist: true });
  renderGroups();
  render();
  els.togglePrimitive.addEventListener("click", toggleSelected);
  for (const button of els.platformButtons) {
    button.addEventListener("click", () => setPlatform(button.dataset.platform));
  }
  for (const button of els.scopeButtons) {
    button.addEventListener("click", () => setScope(button.dataset.scope));
  }
  els.selectProject.addEventListener("click", selectProjectFolder);
  els.detectPrimitives.addEventListener("click", detectPrimitives);
  els.copyManifest.addEventListener("click", copyManifest);
  els.resetTree.addEventListener("click", resetTree);
  els.zoomOut.addEventListener("click", () => setZoom(treeZoom - ZOOM_STEP));
  els.zoomIn.addEventListener("click", () => setZoom(treeZoom + ZOOM_STEP));
  els.zoomReset.addEventListener("click", () => setZoom(1));
  els.zoomFit.addEventListener("click", zoomToFit);
  els.zoomRange.addEventListener("input", (event) => {
    setZoom(Number(event.target.value) / 100);
  });
  startField();
}

function startField() {
  const canvas = els.field;
  const ctx = canvas.getContext("2d");
  const particles = Array.from({ length: 86 }, (_, i) => ({
    x: (i * 137) % 997,
    y: (i * 251) % 733,
    vx: ((i % 7) - 3) * 0.07,
    vy: ((i % 5) - 2) * 0.06,
    color: i % 3 === 0 ? "#6ad7d2" : i % 3 === 1 ? "#f0c866" : "#ff7f50"
  }));

  function resize() {
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * scale);
    canvas.height = Math.floor(window.innerHeight * scale);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function draw() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(12, 13, 11, 0.44)";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(244, 239, 226, 0.045)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width + 60; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - height * 0.35, height);
      ctx.stroke();
    }

    for (const p of particles) {
      p.x = (p.x + p.vx + width) % width;
      p.y = (p.y + p.vy + height) % height;
    }

    for (let i = 0; i < particles.length; i += 1) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j += 1) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 118) {
          ctx.strokeStyle = `rgba(106, 215, 210, ${0.12 * (1 - dist / 118)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = a.color;
      ctx.fillRect(a.x, a.y, 2, 2);
    }

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
}

init().catch((error) => {
  els.treeMap.innerHTML = `<div class="load-error">${escapeHtml(error.message)}</div>`;
});
