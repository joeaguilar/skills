#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOTS = Object.freeze({
  skills: { kind: "directory", extension: null },
  agents: { kind: "file", extension: ".md" },
  commands: { kind: "file", extension: ".md" },
  workflows: { kind: "file", extension: ".js" }
});
const PLATFORMS = new Set(["claude", "codex"]);
const SCOPES = new Set(["global", "local"]);
const repoRoot = path.resolve(__dirname, "..");

function usage(stream = process.stdout) {
  stream.write(`Usage:
  primitives.js manifest [--project PATH | --global] [--platform claude|codex]
                         [--library PATH] [--manifest PATH] [--write] [--json]
  primitives.js status   [--project PATH | --global] [--platform claude|codex]
                         [--library PATH] [--manifest PATH] [--json]

Fixture overrides:
  --claude-home PATH   Override the Claude home (implies --global).
  --codex-home PATH    Override the Codex home (implies --global).

Manifest generation prints v2 JSON by default. --write writes the canonical manifest
artifact (or --manifest PATH) and also prints its path. Status is always read-only.
`);
}

function parseArgs(argv) {
  const result = { _: [] };
  const valueOptions = new Set([
    "--project",
    "--platform",
    "--scope",
    "--library",
    "--manifest",
    "--claude-home",
    "--codex-home"
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (valueOptions.has(argument)) {
      if (index + 1 >= argv.length) throw new Error(`${argument} requires a value`);
      const key = argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      result[key] = argv[++index];
    } else if (argument === "--global") {
      result.global = true;
    } else if (argument === "--write") {
      result.write = true;
    } else if (argument === "--json") {
      result.json = true;
    } else if (argument === "--help" || argument === "-h") {
      result.help = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      result._.push(argument);
    }
  }

  return result;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function emptyManaged() {
  return Object.fromEntries(Object.keys(ROOTS).map((root) => [root, {}]));
}

function normalizeProviders(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, primitive]) => primitive !== null && primitive !== undefined && primitive !== "")
      .map(([capability, primitive]) => [String(capability), String(primitive)])
  );
}

function normalizeManaged(value) {
  const managed = emptyManaged();
  if (!value || typeof value !== "object" || Array.isArray(value)) return managed;

  for (const root of Object.keys(ROOTS)) {
    const entries = value[root];
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) continue;
    for (const [id, rawEntry] of Object.entries(entries)) {
      if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) continue;
      const entry = { ...rawEntry };
      entry.mode = entry.mode || "copy";
      if (hasOwn(entry, "localOverride")) entry.localOverride = Boolean(entry.localOverride);
      managed[root][id] = entry;
    }
  }

  return managed;
}

function normalizeManifest(rawValue, options = {}) {
  const raw = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
    ? rawValue
    : {};
  const platform = options.platform || raw.platform || "claude";
  const scope = options.scope || raw.scope || "local";
  const library = path.resolve(options.library || raw.library || repoRoot);

  if (!PLATFORMS.has(platform)) throw new Error(`Unsupported platform: ${platform}`);
  if (!SCOPES.has(scope)) throw new Error(`Unsupported scope: ${scope}`);

  const preserved = { ...raw };
  delete preserved.version;
  delete preserved.platform;
  delete preserved.scope;
  delete preserved.library;
  delete preserved.managed;
  delete preserved.providers;
  delete preserved.enabled;

  const manifest = {
    version: 2,
    platform,
    scope,
    library,
    managed: normalizeManaged(raw.managed)
  };

  // A v1 local manifest's enabled set is intent, not proof of materialization.
  // Preserve it, but never manufacture managed ownership from it.
  if (hasOwn(raw, "enabled") || scope === "local") {
    manifest.enabled = Array.from(
      new Set(Array.isArray(raw.enabled) ? raw.enabled.map(String) : [])
    ).sort();
  }
  manifest.providers = normalizeProviders(raw.providers);

  return { ...preserved, ...manifest };
}

function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["manifest must be an object"];
  }
  if (manifest.version !== 2) errors.push("version must be 2");
  if (!PLATFORMS.has(manifest.platform)) errors.push("platform must be claude or codex");
  if (!SCOPES.has(manifest.scope)) errors.push("scope must be global or local");
  if (typeof manifest.library !== "string" || !path.isAbsolute(manifest.library)) {
    errors.push("library must be an absolute path");
  }
  if (!manifest.managed || typeof manifest.managed !== "object" || Array.isArray(manifest.managed)) {
    errors.push("managed must be an object keyed by primitive root");
    return errors;
  }

  for (const root of Object.keys(ROOTS)) {
    const entries = manifest.managed[root];
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
      errors.push(`managed.${root} must be an object`);
      continue;
    }
    for (const [id, entry] of Object.entries(entries)) {
      if (!isSafeRelativePath(id)) errors.push(`managed.${root}.${id}: id must be a safe relative path`);
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(`managed.${root}.${id}: entry must be an object`);
        continue;
      }
      if (entry.mode !== "copy" && entry.mode !== "link") {
        errors.push(`managed.${root}.${id}: mode must be copy or link`);
      }
      if (!/^sha256:[0-9a-f]{64}$/.test(entry.baseline || "")) {
        errors.push(`managed.${root}.${id}: baseline must be a sha256 hash`);
      }
      if (typeof entry.installedAt !== "string" || entry.installedAt.length === 0) {
        errors.push(`managed.${root}.${id}: installedAt must be a non-empty string`);
      }
    }
  }
  return errors;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readManifest(file, options = {}) {
  if (!fs.existsSync(file)) {
    return {
      found: false,
      sourceVersion: null,
      manifest: normalizeManifest({}, options),
      file
    };
  }
  const raw = readJson(file);
  return {
    found: true,
    sourceVersion: raw.version || 1,
    manifest: normalizeManifest(raw, options),
    file
  };
}

function writeManifest(file, manifest) {
  const normalized = normalizeManifest(manifest, manifest);
  const errors = validateManifest(normalized);
  if (errors.length > 0) throw new Error(`Invalid manifest:\n${errors.join("\n")}`);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return normalized;
}

function hashPayload(payloadPath) {
  const rootStat = fs.lstatSync(payloadPath);
  const hash = crypto.createHash("sha256");

  function add(value) {
    hash.update(value);
    hash.update("\0");
  }

  function visit(currentPath, relativePath, stat) {
    if (stat.isSymbolicLink()) {
      add("link");
      add(relativePath);
      add(fs.readlinkSync(currentPath));
      return;
    }
    if (stat.isDirectory()) {
      add("directory");
      add(relativePath);
      const names = fs.readdirSync(currentPath).sort((left, right) => left.localeCompare(right));
      for (const name of names) {
        const childPath = path.join(currentPath, name);
        const childRelative = relativePath ? path.posix.join(relativePath, name) : name;
        visit(childPath, childRelative, fs.lstatSync(childPath));
      }
      return;
    }
    if (stat.isFile()) {
      add("file");
      add(relativePath);
      hash.update(fs.readFileSync(currentPath));
      hash.update("\0");
      return;
    }
    add("other");
    add(relativePath);
    add(String(stat.mode));
  }

  // The root name is intentionally excluded so library and installed copies hash equally.
  visit(payloadPath, "", rootStat);
  return `sha256:${hash.digest("hex")}`;
}

function homeFor(platform, options = {}) {
  const explicit = platform === "claude" ? options.claudeHome : options.codexHome;
  if (explicit) return path.resolve(explicit);
  const environment = platform === "claude" ? process.env.CLAUDE_HOME : process.env.CODEX_HOME;
  if (environment) return path.resolve(environment);
  return path.join(os.homedir(), `.${platform}`);
}

function resolveContext(options = {}) {
  const platform = options.platform || "claude";
  if (!PLATFORMS.has(platform)) throw new Error("--platform must be claude or codex");
  if (options.project && options.global) throw new Error("--project and --global are mutually exclusive");
  if (options.scope && !SCOPES.has(options.scope)) throw new Error("--scope must be global or local");

  const homeOverride = platform === "claude" ? options.claudeHome : options.codexHome;
  const scope = options.scope || (options.global || homeOverride ? "global" : "local");
  const project = path.resolve(options.project || process.cwd());
  const installHome = scope === "global"
    ? homeFor(platform, options)
    : path.join(project, `.${platform}`);
  const manifestFile = options.manifest
    ? path.resolve(options.manifest)
    : scope === "global"
      ? path.join(installHome, "primitives.json")
      : path.join(installHome, "project-primitives.json");
  const legacyManifestFile = scope === "local"
    ? path.join(installHome, "project-skills.json")
    : null;

  return { platform, scope, project, installHome, manifestFile, legacyManifestFile };
}

function loadContextManifest(context, options = {}) {
  let readFile = context.manifestFile;
  if (
    !options.manifest
    && context.scope === "local"
    && !fs.existsSync(readFile)
    && context.legacyManifestFile
    && fs.existsSync(context.legacyManifestFile)
  ) {
    readFile = context.legacyManifestFile;
  }
  return readManifest(readFile, {
    platform: context.platform,
    scope: context.scope,
    library: options.library
  });
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value)) return false;
  const normalized = value.replaceAll("\\", "/");
  return normalized !== ".."
    && !normalized.startsWith("../")
    && !normalized.includes("/../")
    && !normalized.endsWith("/..")
    && normalized !== "."
    && !normalized.startsWith("./");
}

function pathHasSymlink(base, relative) {
  if (isDanglingSymlink(base) || (fs.existsSync(base) && fs.lstatSync(base).isSymbolicLink())) {
    return true;
  }
  let current = base;
  for (const segment of relative.split(/[\\/]/).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current) && !isDanglingSymlink(current)) return false;
    if (fs.lstatSync(current).isSymbolicLink()) return true;
  }
  return false;
}

function isDanglingSymlink(file) {
  try {
    return fs.lstatSync(file).isSymbolicLink();
  } catch {
    return false;
  }
}

function installedEntries(rootPath, root) {
  if (!fs.existsSync(rootPath) || !fs.lstatSync(rootPath).isDirectory()) return [];
  const spec = ROOTS[root];
  if (spec.kind === "directory") {
    const entries = [];
    for (const name of fs.readdirSync(rootPath).sort((a, b) => a.localeCompare(b))) {
      if (name === ".DS_Store") continue;
      const candidate = path.join(rootPath, name);
      const stat = fs.lstatSync(candidate);
      if (name === ".system" && stat.isDirectory() && !stat.isSymbolicLink()) {
        for (const systemName of fs.readdirSync(candidate).sort((a, b) => a.localeCompare(b))) {
          const systemCandidate = path.join(candidate, systemName);
          const systemStat = fs.lstatSync(systemCandidate);
          if (systemStat.isDirectory() || systemStat.isSymbolicLink()) {
            entries.push(path.posix.join(".system", systemName));
          }
        }
      } else if (stat.isDirectory() || stat.isSymbolicLink()) {
        entries.push(name);
      }
    }
    return entries;
  }

  const entries = [];
  function walk(directory, relativeDirectory) {
    for (const name of fs.readdirSync(directory).sort((a, b) => a.localeCompare(b))) {
      if (name === ".DS_Store") continue;
      const candidate = path.join(directory, name);
      const relative = relativeDirectory ? path.posix.join(relativeDirectory, name) : name;
      const stat = fs.lstatSync(candidate);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        walk(candidate, relative);
      } else if ((stat.isFile() || stat.isSymbolicLink()) && name.endsWith(spec.extension)) {
        entries.push(relative);
      }
    }
  }
  walk(rootPath, "");
  return entries;
}

function primitiveTypeForRoot(root) {
  return root === "skills" ? "skill" : root.slice(0, -1);
}

function registryLibraryPath(library, platform, root, id) {
  const registryFile = path.join(library, "codex", "registry", "skill-tree.json");
  if (!fs.existsSync(registryFile)) return null;
  let registry;
  try {
    registry = readJson(registryFile);
  } catch {
    return null;
  }
  const collection = registry.primitives || registry.skills || {};
  const entries = Array.isArray(collection)
    ? collection.map((item) => [item.id || item.name, item])
    : Object.entries(collection);
  const primitive = entries.find(([primitiveId, value]) =>
    primitiveId === id && (value.type || "skill") === primitiveTypeForRoot(root)
  )?.[1];
  if (!primitive) return null;

  const platformConfig = primitive.platforms?.[platform];
  const configuredPath = platformConfig && typeof platformConfig === "object"
    ? platformConfig.path
    : null;
  const primitivePath = configuredPath || (platform === "codex" ? primitive.path : null);
  if (!primitivePath) return null;
  return path.isAbsolute(primitivePath)
    ? primitivePath
    : path.join(library, platform, primitivePath);
}

function libraryEntryPath(library, platform, root, id) {
  const direct = path.join(library, platform, root, ...id.split("/"));
  if (fs.existsSync(direct) || isDanglingSymlink(direct)) return direct;
  return registryLibraryPath(library, platform, root, id) || direct;
}

function classifyManagedEntry({ baseline, installedPath, libraryPath, installRoot, id, libraryFound }) {
  if (!libraryFound) return { state: "library-missing", installedHash: null, libraryHash: null };
  if (!fs.existsSync(libraryPath) && !isDanglingSymlink(libraryPath)) {
    return { state: "orphaned", installedHash: null, libraryHash: null };
  }
  if (!fs.existsSync(installedPath) && !isDanglingSymlink(installedPath)) {
    return { state: "missing", installedHash: null, libraryHash: hashPayload(libraryPath) };
  }
  if (pathHasSymlink(installRoot, id)) {
    return { state: "symlink", installedHash: null, libraryHash: hashPayload(libraryPath) };
  }
  if (!baseline || !/^sha256:[0-9a-f]{64}$/.test(baseline)) {
    return {
      state: "unbaselined",
      installedHash: hashPayload(installedPath),
      libraryHash: hashPayload(libraryPath)
    };
  }

  const installedHash = hashPayload(installedPath);
  const libraryHash = hashPayload(libraryPath);
  const installedChanged = installedHash !== baseline;
  const libraryChanged = libraryHash !== baseline;
  let state = "up-to-date";
  if (libraryChanged && !installedChanged) state = "behind";
  else if (!libraryChanged && installedChanged) state = "locally-edited";
  else if (libraryChanged && installedChanged) state = "conflict";
  return { state, installedHash, libraryHash };
}

function statusCensus(options = {}) {
  const context = resolveContext(options);
  const loaded = loadContextManifest(context, options);
  const manifest = loaded.manifest;
  const library = path.resolve(options.library || manifest.library || repoRoot);
  const platformLibrary = path.join(library, context.platform);
  const libraryFound = fs.existsSync(platformLibrary) && fs.lstatSync(platformLibrary).isDirectory();
  const diagnostics = [];
  if (!loaded.found) diagnostics.push(`manifest not found at ${context.manifestFile}; all installed primitives are unmanaged`);
  if (!libraryFound) diagnostics.push(`library not found at ${library}`);

  const roots = {};
  const totals = {
    managed: 0,
    unmanaged: 0,
    upToDate: 0,
    behind: 0,
    locallyEdited: 0,
    conflict: 0,
    orphaned: 0,
    missing: 0,
    symlink: 0,
    unbaselined: 0,
    libraryMissing: 0,
    drifted: 0
  };

  for (const root of Object.keys(ROOTS)) {
    const installRoot = path.join(context.installHome, root);
    const managed = manifest.managed[root] || {};
    const installed = installedEntries(installRoot, root);
    const unmanaged = installed.filter((id) => !hasOwn(managed, id));
    const entries = [];
    const counts = {
      managed: Object.keys(managed).length,
      unmanaged: unmanaged.length,
      upToDate: 0,
      behind: 0,
      locallyEdited: 0,
      conflict: 0,
      orphaned: 0,
      missing: 0,
      symlink: 0,
      unbaselined: 0,
      libraryMissing: 0,
      drifted: 0
    };

    for (const [id, entry] of Object.entries(managed).sort(([a], [b]) => a.localeCompare(b))) {
      if (!isSafeRelativePath(id)) {
        entries.push({ id, state: "invalid", mode: entry.mode || "copy", baseline: entry.baseline || null });
        continue;
      }
      const installedPath = path.join(installRoot, ...id.split("/"));
      const libraryPath = libraryEntryPath(library, context.platform, root, id);
      const result = classifyManagedEntry({
        baseline: entry.baseline,
        installedPath,
        libraryPath,
        installRoot,
        id,
        libraryFound
      });
      const countKey = result.state.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (hasOwn(counts, countKey)) counts[countKey] += 1;
      if (result.state === "locally-edited" || result.state === "conflict") counts.drifted += 1;
      entries.push({
        id,
        state: result.state,
        mode: entry.mode || "copy",
        baseline: entry.baseline || null,
        installedHash: result.installedHash,
        libraryHash: result.libraryHash,
        localOverride: Boolean(entry.localOverride)
      });
    }

    for (const key of Object.keys(totals)) totals[key] += counts[key] || 0;
    roots[root] = {
      path: installRoot,
      counts,
      managed: entries,
      unmanaged
    };
  }

  return {
    version: 2,
    platform: context.platform,
    scope: context.scope,
    manifest: context.manifestFile,
    manifestSource: loaded.file,
    manifestFound: loaded.found,
    manifestVersion: loaded.sourceVersion,
    library,
    libraryFound,
    diagnostics,
    totals,
    roots
  };
}

function printStatus(census, stream = process.stdout) {
  stream.write(`Manifest: ${census.manifest}${census.manifestFound ? "" : " (missing)"}\n`);
  stream.write(`Library: ${census.library}${census.libraryFound ? "" : " (missing)"}\n`);
  for (const diagnostic of census.diagnostics) stream.write(`Warning: ${diagnostic}\n`);
  for (const [root, data] of Object.entries(census.roots)) {
    const counts = data.counts;
    stream.write(
      `${root}: managed=${counts.managed} unmanaged=${counts.unmanaged}`
      + ` behind=${counts.behind} locally-edited=${counts.locallyEdited}`
      + ` conflict=${counts.conflict} orphaned=${counts.orphaned}`
      + ` missing=${counts.missing} symlink=${counts.symlink}`
      + ` up-to-date=${counts.upToDate}\n`
    );
    for (const entry of data.managed) stream.write(`  ${entry.state.padEnd(14)} ${entry.id}\n`);
    for (const id of data.unmanaged) stream.write(`  unmanaged      ${id}\n`);
  }
}

function generateManifest(options = {}) {
  const context = resolveContext(options);
  const loaded = loadContextManifest(context, options);
  return {
    context,
    source: loaded.file,
    sourceVersion: loaded.sourceVersion,
    manifest: normalizeManifest(loaded.manifest, {
      platform: context.platform,
      scope: context.scope,
      library: options.library || loaded.manifest.library || repoRoot
    })
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help || args._.length === 0) {
    usage(args.help ? process.stdout : process.stderr);
    return args.help ? 0 : 2;
  }
  if (args._.length > 1) throw new Error(`Unexpected argument: ${args._[1]}`);
  const command = args._[0];

  if (command === "manifest" || command === "generate") {
    const generated = generateManifest(args);
    if (args.write) {
      writeManifest(generated.context.manifestFile, generated.manifest);
      if (args.json) {
        process.stdout.write(`${JSON.stringify(generated.manifest, null, 2)}\n`);
      } else {
        process.stdout.write(`Wrote manifest v2: ${generated.context.manifestFile}\n`);
      }
    } else {
      process.stdout.write(`${JSON.stringify(generated.manifest, null, 2)}\n`);
    }
    return 0;
  }

  if (command === "status") {
    const census = statusCensus(args);
    if (args.json) process.stdout.write(`${JSON.stringify(census, null, 2)}\n`);
    else printStatus(census);
    return 0;
  }

  usage(process.stderr);
  return 2;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  ROOTS,
  classifyManagedEntry,
  emptyManaged,
  generateManifest,
  hashPayload,
  normalizeManaged,
  normalizeManifest,
  readManifest,
  resolveContext,
  statusCensus,
  validateManifest,
  writeManifest
};
