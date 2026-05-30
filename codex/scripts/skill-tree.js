#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const scriptDir = __dirname;
const codexRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(codexRoot, "..");

function usage() {
  console.log(`Usage:
  skill-tree.js list [--project PATH] [--json]
  skill-tree.js status [--project PATH] [--json]
  skill-tree.js enable <id> [--project PATH] [--scope local|global]
  skill-tree.js disable <id> [--project PATH] [--scope local|global]
  skill-tree.js provider <capability> [<primitive>|auto] [--project PATH] [--scope local|global]
  skill-tree.js manifest [--project PATH] [--scope local|global]
  skill-tree.js validate [--json]

Options:
  --project PATH   Project root that owns the local primitive manifest.
  --platform NAME  Manifest platform for path selection: codex or claude (default: codex).
  --scope SCOPE    Manifest scope: local or global (default: local).
  --registry PATH  Override registry JSON path.
  --json           Emit JSON for list/status/validate.`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project") {
      out.project = argv[++i];
    } else if (arg === "--platform") {
      out.platform = argv[++i];
    } else if (arg === "--scope") {
      out.scope = argv[++i];
    } else if (arg === "--registry") {
      out.registry = argv[++i];
    } else if (arg === "--json") {
      out.json = true;
    } else if (arg === "-h" || arg === "--help") {
      out.help = true;
    } else {
      out._.push(arg);
    }
  }
  return out;
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function expandHome(file) {
  if (file === "~") return process.env.HOME || file;
  if (file.startsWith("~/")) return path.join(process.env.HOME || "~", file.slice(2));
  return file;
}

function loadRegistry(registryPath) {
  const file = registryPath
    ? path.resolve(registryPath)
    : path.join(codexRoot, "registry", "skill-tree.json");
  const registry = readJson(file);
  normalizeRegistry(registry, file);
  registry.__file = file;
  return registry;
}

function objectHas(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeStringArray(value) {
  return asArray(value)
    .filter((item) => item !== undefined && item !== null)
    .map((item) => String(item));
}

function normalizePlatforms(value) {
  if (value === undefined || value === null) return {};
  if (typeof value === "string") return { [value]: {} };
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .filter((item) => item !== undefined && item !== null)
        .map((item) => [String(item), {}])
    );
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([platform, config]) => [
        platform,
        config && typeof config === "object" && !Array.isArray(config)
          ? config
          : { path: String(config) }
      ])
    );
  }
  return { [String(value)]: {} };
}

function primitiveEntries(collection, fallbackType, sourceKind) {
  const entries = [];
  const errors = [];
  const seen = new Set();

  if (!collection || typeof collection !== "object") {
    return { entries, errors };
  }

  if (Array.isArray(collection)) {
    collection.forEach((primitive, index) => {
      if (!primitive || typeof primitive !== "object" || Array.isArray(primitive)) {
        const id = `#${index}`;
        errors.push(`${id}: primitive entry must be an object`);
        return;
      }

      const id = primitive.id || primitive.name;
      if (!id) {
        const syntheticId = `#${index}`;
        errors.push(`${syntheticId}: missing id`);
        entries.push([syntheticId, primitive, { missingId: true, sourceKind }]);
        return;
      }
      if (seen.has(id)) errors.push(`${id}: duplicate primitive id`);
      seen.add(id);
      entries.push([id, primitive, { sourceKind }]);
    });
  } else {
    for (const [id, primitive] of Object.entries(collection)) {
      if (!primitive || typeof primitive !== "object" || Array.isArray(primitive)) {
        errors.push(`${id}: primitive entry must be an object`);
        continue;
      }
      entries.push([id, primitive, { sourceKind }]);
    }
  }

  return {
    entries: entries.map(([id, primitive, meta]) => [
      id,
      normalizePrimitive(id, primitive, {
        fallbackType,
        missingId: Boolean(meta.missingId),
        sourceKind: meta.sourceKind
      })
    ]),
    errors
  };
}

function normalizePrimitive(id, primitive, options) {
  const hasType = objectHas(primitive, "type");
  const hasPlatform = objectHas(primitive, "platform");
  const hasPlatforms = objectHas(primitive, "platforms");
  const hasScopes = objectHas(primitive, "scopes");
  const hasScope = objectHas(primitive, "scope");
  const unlockedBy = primitive.unlockedBy !== undefined ? primitive.unlockedBy : primitive.unlocked_by;
  const type = hasType ? primitive.type : options.fallbackType;
  const scopes = hasScopes ? primitive.scopes : hasScope ? primitive.scope : undefined;
  const platforms = hasPlatforms ? primitive.platforms : hasPlatform ? primitive.platform : undefined;

  return {
    ...primitive,
    id,
    type,
    platforms: normalizePlatforms(platforms),
    provides: normalizeStringArray(primitive.provides),
    requires: normalizeStringArray(primitive.requires),
    recommends: normalizeStringArray(primitive.recommends),
    unlockedBy: normalizeStringArray(unlockedBy),
    scopes: scopes === undefined ? ["global", "local"] : normalizeStringArray(scopes),
    __hasType: hasType,
    __hasPlatform: hasPlatform || hasPlatforms,
    __hasScopes: hasScopes || hasScope,
    __legacySkill: options.sourceKind === "skills",
    __missingId: Boolean(options.missingId)
  };
}

function normalizeRegistry(registry, file) {
  const usesPrimitives = objectHas(registry, "primitives");
  const skillResult = primitiveEntries(registry.skills || {}, "skill", "skills");
  const primitiveResult = primitiveEntries(registry.primitives || {}, undefined, "primitives");
  const primitives = {};
  const errors = [...skillResult.errors, ...primitiveResult.errors];

  for (const [id, primitive] of [...skillResult.entries, ...primitiveResult.entries]) {
    if (primitives[id]) {
      errors.push(`${id}: duplicate primitive id`);
      continue;
    }
    primitives[id] = primitive;
  }

  registry.__file = file;
  registry.__usesPrimitives = usesPrimitives;
  registry.__normalizationErrors = errors;
  registry.__pathRoot = registry.pathRoot || registry.rootPath || registry.basePath
    ? path.resolve(path.dirname(file), registry.pathRoot || registry.rootPath || registry.basePath)
    : codexRoot;
  registry.primitives = primitives;
  registry.skills = Object.fromEntries(
    Object.entries(primitives).filter(([, primitive]) => primitive.type === "skill")
  );
}

function manifestFile(registry, projectRoot) {
  const platform = registry.__platform || "codex";
  const scope = registry.__scope || "local";
  const manifestPaths = registry.manifestPaths || registry.manifest_paths || {};
  const scopedPath = manifestPaths[platform]?.[scope];
  if (scopedPath) {
    const expanded = expandHome(scopedPath);
    return path.isAbsolute(expanded) ? expanded : path.join(projectRoot, expanded);
  }
  return path.join(projectRoot, registry.manifestPath || registry.manifest_path || ".codex/project-skills.json");
}

function loadManifest(registry, projectRoot) {
  const file = manifestFile(registry, projectRoot);
  const legacyFile = path.join(projectRoot, registry.manifestPath || registry.manifest_path || ".codex/project-skills.json");
  const allowLegacy = (registry.__scope || "local") === "local";
  const readFile = fs.existsSync(file) || file === legacyFile || !allowLegacy || !fs.existsSync(legacyFile)
    ? file
    : legacyFile;
  const manifest = readJson(readFile, {
    version: 1,
    platform: registry.__platform || "codex",
    scope: registry.__scope || "local",
    enabled: [],
    providers: {},
    updatedAt: null
  });
  manifest.enabled = Array.from(new Set(manifest.enabled || []));
  manifest.providers = normalizeProviderSelections(manifest.providers);
  manifest.__file = readFile;
  return manifest;
}

function enabledSet(manifest) {
  return new Set(manifest.enabled || []);
}

function normalizeProviderSelections(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, primitiveId]) => primitiveId !== undefined && primitiveId !== null && primitiveId !== "")
      .map(([capability, primitiveId]) => [String(capability), String(primitiveId)])
  );
}

function capabilityIsProvidedBy(registry, capability, primitiveId) {
  const primitive = registry.primitives[primitiveId];
  return Boolean(primitive && (primitive.provides || []).includes(capability));
}

function providerCandidateIds(registry) {
  const providers = {};
  for (const [id, primitive] of Object.entries(registry.primitives || {})) {
    for (const capability of primitive.provides || []) {
      if (!providers[capability]) providers[capability] = [];
      providers[capability].push(id);
    }
  }
  return providers;
}

function providerSelectionError(registry, enabled, capability, primitiveId) {
  if (!registry.primitives[primitiveId]) return "unknown primitive";
  if (!capabilityIsProvidedBy(registry, capability, primitiveId)) return "does not provide capability";
  if (!enabled.has(primitiveId)) return "not enabled";
  return null;
}

function resolveProviders(registry, enabledInput, explicitProvidersInput) {
  const enabledOrder = Array.from(enabledInput || []);
  const enabled = new Set(enabledOrder);
  const explicitProviders = normalizeProviderSelections(explicitProvidersInput);
  const candidatesById = providerCandidateIds(registry);
  const capabilities = new Set([
    ...Object.keys(registry.capabilities || {}),
    ...Object.keys(candidatesById),
    ...Object.keys(explicitProviders)
  ]);
  const providers = {};
  const providerCandidates = {};
  const invalidProviderSelections = [];

  for (const capability of Array.from(capabilities).sort()) {
    const candidateIds = candidatesById[capability] || [];
    const candidates = candidateIds.map((id) => {
      const primitive = registry.primitives[id];
      return {
        id,
        type: primitive.type,
        title: primitive.title || id,
        enabled: enabled.has(id)
      };
    });
    const enabledCandidates = enabledOrder.filter((id) => candidateIds.includes(id));
    const explicit = objectHas(explicitProviders, capability)
      ? explicitProviders[capability]
      : null;
    let selectedProvider = null;
    let selectedSource = null;
    let invalidSelection = null;

    if (explicit) {
      const reason = providerSelectionError(registry, enabled, capability, explicit);
      if (reason) {
        invalidSelection = { capability, primitive: explicit, reason };
        invalidProviderSelections.push(invalidSelection);
      } else {
        selectedProvider = explicit;
        selectedSource = "manifest";
      }
    }

    if (!selectedProvider && enabledCandidates.length > 0) {
      selectedProvider = enabledCandidates[0];
      selectedSource = "auto";
    }

    if (selectedProvider) providers[capability] = selectedProvider;
    providerCandidates[capability] = {
      capability,
      label: (registry.capabilities || {})[capability]?.label || capability,
      selectedProvider,
      selectedSource,
      manifestProvider: explicit,
      invalidSelection,
      candidates
    };
  }

  return { providers, providerCandidates, invalidProviderSelections };
}

function providersFor(registry, enabled, explicitProviders) {
  return resolveProviders(registry, enabled, explicitProviders).providers;
}

function providerPreferencesForRefresh(registry, enabled, explicitProvidersInput) {
  const explicitProviders = normalizeProviderSelections(explicitProvidersInput);
  const preferences = {};
  const enabledSetForRefresh = new Set(enabled);
  for (const [capability, primitiveId] of Object.entries(explicitProviders)) {
    if (!providerSelectionError(registry, enabledSetForRefresh, capability, primitiveId)) {
      preferences[capability] = primitiveId;
    }
  }
  return preferences;
}

function isRevealed(primitive, enabled) {
  const parents = primitive.unlockedBy || [];
  return parents.length === 0 || parents.every((id) => enabled.has(id));
}

function missingCapabilities(primitive, providers) {
  return (primitive.requires || []).filter((capability) => !providers[capability]);
}

function recommendedMissing(primitive, providers) {
  return (primitive.recommends || []).filter((capability) => !providers[capability]);
}

function describeState(registry, manifest) {
  const enabled = enabledSet(manifest);
  const providerState = resolveProviders(registry, manifest.enabled || [], manifest.providers || {});
  const providers = providerState.providers;
  const rows = Object.entries(registry.primitives).map(([id, primitive]) => {
    const revealed = isRevealed(primitive, enabled);
    const missing = missingCapabilities(primitive, providers);
    const state = enabled.has(id)
      ? "enabled"
      : !revealed
        ? "hidden"
        : missing.length
          ? "locked"
          : "available";
    return {
      id,
      type: primitive.type,
      title: primitive.title || id,
      group: primitive.group,
      tier: primitive.tier || 0,
      state,
      platforms: Object.keys(primitive.platforms || {}),
      scopes: primitive.scopes || [],
      provides: primitive.provides || [],
      requires: primitive.requires || [],
      recommends: primitive.recommends || [],
      missing,
      recommendedMissing: recommendedMissing(primitive, providers),
      unlockedBy: primitive.unlockedBy || []
    };
  });
  const sortedRows = rows.sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  return {
    manifest: manifest.__file,
    enabled: Array.from(enabled).sort(),
    providers,
    providerPreferences: normalizeProviderSelections(manifest.providers),
    providerCandidates: providerState.providerCandidates,
    invalidProviderSelections: providerState.invalidProviderSelections,
    primitives: sortedRows,
    skills: sortedRows.filter((row) => row.type === "skill")
  };
}

function refreshManifest(registry, manifest) {
  const enabled = Array.from(enabledSet(manifest)).filter((id) => registry.primitives[id]);
  const providers = providerPreferencesForRefresh(registry, enabled, manifest.providers || {});
  return {
    version: 1,
    platform: registry.__platform || manifest.platform || "codex",
    scope: registry.__scope || manifest.scope || "local",
    enabled: enabled.sort(),
    providers,
    updatedAt: new Date().toISOString()
  };
}

function printRows(rows) {
  const width = rows.reduce((max, row) => Math.max(max, row.id.length), 5);
  for (const row of rows) {
    const suffix = row.missing.length ? ` missing: ${row.missing.join(",")}` : "";
    const type = row.type ? `${row.type.padEnd(7)} ` : "";
    console.log(`${row.state.padEnd(9)} ${type}${row.id.padEnd(width)}  ${row.title}${suffix}`);
  }
}

function countByType(primitives) {
  const counts = {};
  for (const primitive of Object.values(primitives || {})) {
    const type = primitive.type || "(missing)";
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

function formatTypeCounts(counts) {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${type}=${count}`)
    .join(", ");
}

function resolveRegistryPath(registry, primitivePath) {
  if (!primitivePath || typeof primitivePath !== "string") return null;
  if (path.isAbsolute(primitivePath)) return primitivePath;
  return path.resolve(registry.__pathRoot || codexRoot, primitivePath);
}

function resolvePlatformPath(platform, primitivePath) {
  if (!primitivePath || typeof primitivePath !== "string") return null;
  if (path.isAbsolute(primitivePath)) return primitivePath;
  return path.resolve(repoRoot, platform, primitivePath);
}

function displayPath(file) {
  return path.relative(process.cwd(), file) || ".";
}

function pathExists(file) {
  return Boolean(file) && fs.existsSync(file);
}

function validatePrimitivePath(registry, id, primitive, errors) {
  const platformEntries = Object.entries(primitive.platforms || {}).filter(([, config]) => config?.path);
  if (!primitive.path && platformEntries.length === 0) {
    errors.push(`${id}: missing path`);
    return;
  }

  if (primitive.path) {
    const primitivePath = resolveRegistryPath(registry, primitive.path);
    if (primitive.type === "skill") {
      const skillPath = path.basename(primitivePath) === "SKILL.md"
        ? primitivePath
        : path.join(primitivePath, "SKILL.md");
      if (!pathExists(skillPath)) errors.push(`${id}: missing ${displayPath(skillPath)}`);
    } else if (!pathExists(primitivePath)) {
      errors.push(`${id}: missing ${displayPath(primitivePath)}`);
    }
  }

  for (const [platform, config] of platformEntries) {
    const primitivePath = resolvePlatformPath(platform, config.path);
    if (primitive.type === "skill") {
      const skillPath = path.basename(primitivePath) === "SKILL.md"
        ? primitivePath
        : path.join(primitivePath, "SKILL.md");
      if (!pathExists(skillPath)) errors.push(`${id}: missing ${displayPath(skillPath)}`);
    } else if (!pathExists(primitivePath)) {
      errors.push(`${id}: missing ${displayPath(primitivePath)}`);
    }
  }
}

function providersByCapability(registry) {
  const providers = new Map();
  for (const [id, primitive] of Object.entries(registry.primitives || {})) {
    for (const capability of primitive.provides || []) {
      if (!providers.has(capability)) providers.set(capability, []);
      providers.get(capability).push(id);
    }
  }
  return providers;
}

function isExternalCapability(capability) {
  if (!capability || typeof capability !== "object" || Array.isArray(capability)) return false;
  if (capability.external === true) return true;
  if (capability.externalProvider === true) return true;
  if (capability.source === "external") return true;
  if (capability.provider === "external") return true;
  if (capability.type === "external") return true;
  if (capability.providers === "external") return true;
  if (Array.isArray(capability.providers) && capability.providers.includes("external")) return true;
  return false;
}

function findDependencyCycles(registry) {
  const capabilityProviders = providersByCapability(registry);
  const graph = new Map();

  for (const [id, primitive] of Object.entries(registry.primitives || {})) {
    const dependencies = new Set();
    for (const capability of primitive.requires || []) {
      const providers = Array.from(new Set(capabilityProviders.get(capability) || []));
      for (const provider of providers) {
        if (provider !== id) dependencies.add(provider);
      }
    }
    graph.set(id, dependencies);
  }

  const visited = new Set();
  const active = new Set();
  const stack = [];
  const cycles = [];
  const cycleKeys = new Set();

  function addCycle(nextId) {
    const start = stack.indexOf(nextId);
    if (start === -1) return;
    const cycle = stack.slice(start).concat(nextId);
    const nodes = cycle.slice(0, -1);
    const key = nodes.slice().sort().join("\0");
    if (cycleKeys.has(key)) return;
    cycleKeys.add(key);
    cycles.push(cycle);
  }

  function visit(id) {
    if (active.has(id)) {
      addCycle(id);
      return;
    }
    if (visited.has(id)) return;

    visited.add(id);
    active.add(id);
    stack.push(id);

    for (const dependency of graph.get(id) || []) {
      visit(dependency);
    }

    stack.pop();
    active.delete(id);
  }

  for (const id of graph.keys()) {
    visit(id);
  }

  return cycles;
}

function validateRegistry(registry) {
  const errors = [];
  const validScopes = new Set(["global", "local"]);
  const capabilities = registry.capabilities || {};
  const capabilityProviders = providersByCapability(registry);

  for (const error of registry.__normalizationErrors || []) {
    errors.push(error);
  }

  for (const [id, primitive] of Object.entries(registry.primitives || {})) {
    if (!primitive.type || typeof primitive.type !== "string") errors.push(`${id}: missing type`);
    if (primitive.group && !(registry.groups || {})[primitive.group]) errors.push(`${id}: unknown group ${primitive.group}`);
    validatePrimitivePath(registry, id, primitive, errors);

    if (!primitive.__legacySkill) {
      if (!primitive.__hasScopes || !primitive.scopes || primitive.scopes.length === 0) {
        errors.push(`${id}: missing scopes`);
      } else {
        for (const scope of primitive.scopes) {
          if (!validScopes.has(scope)) errors.push(`${id}: invalid scope ${scope}`);
        }
      }
    } else if (primitive.__hasScopes) {
      for (const scope of primitive.scopes || []) {
        if (!validScopes.has(scope)) errors.push(`${id}: invalid scope ${scope}`);
      }
    }

    for (const parent of primitive.unlockedBy || []) {
      if (!registry.primitives[parent]) errors.push(`${id}: unknown unlockedBy id ${parent}`);
    }
    for (const capability of [...(primitive.provides || []), ...(primitive.requires || []), ...(primitive.recommends || [])]) {
      if (!capabilities[capability]) errors.push(`${id}: unknown capability ${capability}`);
    }

    for (const capability of primitive.requires || []) {
      if (!capabilities[capability]) continue;
      if ((capabilityProviders.get(capability) || []).length > 0) continue;
      if (isExternalCapability(capabilities[capability])) continue;
      errors.push(`${id}: requires capability ${capability}, but no primitive provides it`);
    }
  }

  for (const cycle of findDependencyCycles(registry)) {
    errors.push(`dependency cycle: ${cycle.join(" -> ")}`);
  }

  const countsByType = countByType(registry.primitives || {});
  return {
    ok: errors.length === 0,
    errors,
    primitives: Object.keys(registry.primitives || {}).length,
    skills: countsByType.skill || 0,
    countsByType,
    groups: Object.keys(registry.groups || {}).length
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length === 0) {
    usage();
    process.exit(args.help ? 0 : 2);
  }

  const command = args._[0];
  const platform = args.platform || "codex";
  const scope = args.scope || "local";
  if (!["claude", "codex"].includes(platform)) throw new Error("--platform must be claude or codex");
  if (!["global", "local"].includes(scope)) throw new Error("--scope must be global or local");
  const projectRoot = path.resolve(args.project || process.cwd());
  const registry = loadRegistry(args.registry);
  registry.__platform = platform;
  registry.__scope = scope;
  const manifest = loadManifest(registry, projectRoot);

  if (command === "validate") {
    const result = validateRegistry(registry);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.ok) {
      console.log(`Primitive registry OK: ${result.primitives} primitives (${formatTypeCounts(result.countsByType)}), ${result.groups} groups`);
    } else {
      console.error(result.errors.join("\n"));
    }
    process.exit(result.ok ? 0 : 1);
  }

  if (command === "list" || command === "status") {
    const state = describeState(registry, manifest);
    if (args.json) {
      console.log(JSON.stringify(state, null, 2));
    } else {
      console.log(`Manifest: ${state.manifest}`);
      console.log(`Enabled: ${state.enabled.length ? state.enabled.join(", ") : "none"}`);
      printRows(state.primitives.filter((row) => command === "list" || row.state !== "hidden"));
    }
    return;
  }

  if (command === "manifest") {
    console.log(JSON.stringify(refreshManifest(registry, manifest), null, 2));
    return;
  }

  if (command === "enable") {
    const id = args._[1];
    const primitive = registry.primitives[id];
    if (!primitive) throw new Error(`Unknown primitive: ${id}`);
    const state = describeState(registry, manifest).primitives.find((row) => row.id === id);
    if (state.state === "hidden") {
      throw new Error(`${id} is hidden until: ${(primitive.unlockedBy || []).join(", ") || "root"}`);
    }
    if (state.state === "locked") {
      throw new Error(`${id} is locked. Missing capabilities: ${state.missing.join(", ")}`);
    }
    const enabled = enabledSet(manifest);
    enabled.add(id);
    const next = refreshManifest(registry, { enabled: Array.from(enabled), providers: manifest.providers });
    writeJson(manifest.__file, next);
    console.log(`Enabled ${id} in ${manifest.__file}`);
    return;
  }

  if (command === "disable") {
    const id = args._[1];
    if (!registry.primitives[id]) throw new Error(`Unknown primitive: ${id}`);
    const enabled = enabledSet(manifest);
    enabled.delete(id);
    const next = refreshManifest(registry, { enabled: Array.from(enabled), providers: manifest.providers });
    writeJson(manifest.__file, next);
    console.log(`Disabled ${id} in ${manifest.__file}`);
    return;
  }

  if (command === "provider") {
    const capability = args._[1];
    const primitiveId = args._[2];
    if (!capability) throw new Error("Usage: skill-tree.js provider <capability> [<primitive>|auto]");

    if (!(registry.capabilities || {})[capability]) {
      throw new Error(`Unknown capability: ${capability}`);
    }

    const enabled = enabledSet(manifest);
    const currentProviders = normalizeProviderSelections(manifest.providers);
    const candidates = (providerCandidateIds(registry)[capability] || []).map((id) => ({
      id,
      title: registry.primitives[id]?.title || id,
      enabled: enabled.has(id)
    }));

    if (!primitiveId) {
      const state = describeState(registry, manifest);
      const route = state.providerCandidates[capability] || {
        capability,
        label: (registry.capabilities || {})[capability]?.label || capability,
        selectedProvider: null,
        selectedSource: null,
        candidates
      };
      if (args.json) {
        console.log(JSON.stringify(route, null, 2));
      } else {
        console.log(`${route.label}: ${route.selectedProvider || "unselected"}${route.selectedSource ? ` (${route.selectedSource})` : ""}`);
        for (const candidate of route.candidates || candidates) {
          console.log(`  ${candidate.enabled ? "*" : "-"} ${candidate.id}  ${candidate.title}`);
        }
      }
      return;
    }

    if (primitiveId === "auto") {
      delete currentProviders[capability];
    } else {
      const reason = providerSelectionError(registry, enabled, capability, primitiveId);
      if (reason) throw new Error(`Cannot use ${primitiveId} for ${capability}: ${reason}`);
      currentProviders[capability] = primitiveId;
    }

    const next = refreshManifest(registry, {
      enabled: Array.from(enabled),
      providers: currentProviders,
      platform: manifest.platform,
      scope: manifest.scope
    });
    writeJson(manifest.__file, next);
    console.log(`Updated provider for ${capability} in ${manifest.__file}`);
    return;
  }

  usage();
  process.exit(2);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
