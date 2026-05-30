#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const scriptDir = __dirname;
const codexRoot = path.resolve(scriptDir, "..");

function usage() {
  console.log(`Usage:
  skill-tree.js list [--project PATH] [--json]
  skill-tree.js status [--project PATH] [--json]
  skill-tree.js enable <skill> [--project PATH]
  skill-tree.js disable <skill> [--project PATH]
  skill-tree.js manifest [--project PATH]
  skill-tree.js validate [--json]

Options:
  --project PATH   Project root that owns .codex/project-skills.json.
  --registry PATH  Override registry JSON path.
  --json           Emit JSON for list/status/validate.`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project") {
      out.project = argv[++i];
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

function loadRegistry(registryPath) {
  const file = registryPath
    ? path.resolve(registryPath)
    : path.join(codexRoot, "registry", "skill-tree.json");
  const registry = readJson(file);
  registry.__file = file;
  return registry;
}

function manifestFile(registry, projectRoot) {
  return path.join(projectRoot, registry.manifestPath || ".codex/project-skills.json");
}

function loadManifest(registry, projectRoot) {
  const file = manifestFile(registry, projectRoot);
  const manifest = readJson(file, {
    version: 1,
    enabled: [],
    providers: {},
    updatedAt: null
  });
  manifest.enabled = Array.from(new Set(manifest.enabled || []));
  manifest.providers = manifest.providers || {};
  manifest.__file = file;
  return manifest;
}

function enabledSet(manifest) {
  return new Set(manifest.enabled || []);
}

function providersFor(registry, enabled) {
  const providers = {};
  for (const id of enabled) {
    const skill = registry.skills[id];
    if (!skill) continue;
    for (const capability of skill.provides || []) {
      if (!providers[capability]) providers[capability] = id;
    }
  }
  return providers;
}

function isRevealed(skill, enabled) {
  const parents = skill.unlockedBy || [];
  return parents.length === 0 || parents.every((id) => enabled.has(id));
}

function missingCapabilities(skill, providers) {
  return (skill.requires || []).filter((capability) => !providers[capability]);
}

function recommendedMissing(skill, providers) {
  return (skill.recommends || []).filter((capability) => !providers[capability]);
}

function describeState(registry, manifest) {
  const enabled = enabledSet(manifest);
  const providers = providersFor(registry, enabled);
  const rows = Object.entries(registry.skills).map(([id, skill]) => {
    const revealed = isRevealed(skill, enabled);
    const missing = missingCapabilities(skill, providers);
    const state = enabled.has(id)
      ? "enabled"
      : !revealed
        ? "hidden"
        : missing.length
          ? "locked"
          : "available";
    return {
      id,
      title: skill.title || id,
      group: skill.group,
      tier: skill.tier || 0,
      state,
      provides: skill.provides || [],
      requires: skill.requires || [],
      recommends: skill.recommends || [],
      missing,
      recommendedMissing: recommendedMissing(skill, providers),
      unlockedBy: skill.unlockedBy || []
    };
  });
  return {
    manifest: manifest.__file,
    enabled: Array.from(enabled).sort(),
    providers,
    skills: rows.sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id))
  };
}

function refreshManifest(registry, manifest) {
  const enabled = Array.from(enabledSet(manifest)).filter((id) => registry.skills[id]);
  return {
    version: 1,
    enabled: enabled.sort(),
    providers: providersFor(registry, enabled),
    updatedAt: new Date().toISOString()
  };
}

function printRows(rows) {
  const width = rows.reduce((max, row) => Math.max(max, row.id.length), 5);
  for (const row of rows) {
    const suffix = row.missing.length ? ` missing: ${row.missing.join(",")}` : "";
    console.log(`${row.state.padEnd(9)} ${row.id.padEnd(width)}  ${row.title}${suffix}`);
  }
}

function validateRegistry(registry) {
  const errors = [];
  for (const [id, skill] of Object.entries(registry.skills || {})) {
    if (!skill.path) errors.push(`${id}: missing path`);
    if (!skill.group || !registry.groups[skill.group]) errors.push(`${id}: unknown group ${skill.group}`);
    const skillPath = path.join(codexRoot, skill.path, "SKILL.md");
    if (!fs.existsSync(skillPath)) errors.push(`${id}: missing ${path.relative(process.cwd(), skillPath)}`);
    for (const parent of skill.unlockedBy || []) {
      if (!registry.skills[parent]) errors.push(`${id}: unknown unlockedBy skill ${parent}`);
    }
    for (const capability of [...(skill.provides || []), ...(skill.requires || []), ...(skill.recommends || [])]) {
      if (!registry.capabilities[capability]) errors.push(`${id}: unknown capability ${capability}`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    skills: Object.keys(registry.skills || {}).length,
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
  const projectRoot = path.resolve(args.project || process.cwd());
  const registry = loadRegistry(args.registry);
  const manifest = loadManifest(registry, projectRoot);

  if (command === "validate") {
    const result = validateRegistry(registry);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.ok) {
      console.log(`Skill tree registry OK: ${result.skills} skills, ${result.groups} groups`);
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
      printRows(state.skills.filter((row) => command === "list" || row.state !== "hidden"));
    }
    return;
  }

  if (command === "manifest") {
    console.log(JSON.stringify(refreshManifest(registry, manifest), null, 2));
    return;
  }

  if (command === "enable") {
    const id = args._[1];
    const skill = registry.skills[id];
    if (!skill) throw new Error(`Unknown skill: ${id}`);
    const state = describeState(registry, manifest).skills.find((row) => row.id === id);
    if (state.state === "hidden") {
      throw new Error(`${id} is hidden until: ${(skill.unlockedBy || []).join(", ") || "root"}`);
    }
    if (state.state === "locked") {
      throw new Error(`${id} is locked. Missing capabilities: ${state.missing.join(", ")}`);
    }
    const enabled = enabledSet(manifest);
    enabled.add(id);
    const next = refreshManifest(registry, { enabled: Array.from(enabled) });
    writeJson(manifest.__file, next);
    console.log(`Enabled ${id} in ${manifest.__file}`);
    return;
  }

  if (command === "disable") {
    const id = args._[1];
    if (!registry.skills[id]) throw new Error(`Unknown skill: ${id}`);
    const enabled = enabledSet(manifest);
    enabled.delete(id);
    const next = refreshManifest(registry, { enabled: Array.from(enabled) });
    writeJson(manifest.__file, next);
    console.log(`Disabled ${id} in ${manifest.__file}`);
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
