"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  ROOTS,
  generateManifest,
  hashPayload,
  normalizeManifest,
  readManifest,
  statusCensus,
  writeManifest
} = require("./primitives.js");

function mkdir(file) {
  fs.mkdirSync(file, { recursive: true });
}

function write(file, content) {
  mkdir(path.dirname(file));
  fs.writeFileSync(file, content);
}

function copy(source, destination) {
  mkdir(path.dirname(destination));
  fs.cpSync(source, destination, { recursive: true });
}

function fixtureHash(root) {
  const hash = crypto.createHash("sha256");
  function visit(directory, relative = "") {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name);
      const childRelative = relative ? `${relative}/${name}` : name;
      const stat = fs.lstatSync(file);
      hash.update(`${stat.isDirectory() ? "d" : stat.isSymbolicLink() ? "l" : "f"}:${childRelative}\0`);
      if (stat.isDirectory()) visit(file, childRelative);
      else if (stat.isSymbolicLink()) hash.update(`${fs.readlinkSync(file)}\0`);
      else hash.update(fs.readFileSync(file));
    }
  }
  visit(root);
  return hash.digest("hex");
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "primitives-test-"));
  const library = path.join(root, "library");
  const home = path.join(root, "home");
  mkdir(path.join(library, "claude"));
  mkdir(home);
  return { root, library, home };
}

function payloadPath(base, root, id) {
  return path.join(base, root, ...id.split("/"));
}

function addPayload(base, root, id, content) {
  const target = payloadPath(base, root, id);
  if (ROOTS[root].kind === "directory") write(path.join(target, "SKILL.md"), content);
  else write(target, content);
  return target;
}

function addManaged(manifest, library, home, root, id, content = "base\n") {
  const libraryPayload = addPayload(path.join(library, "claude"), root, id, content);
  const installedPayload = payloadPath(home, root, id);
  copy(libraryPayload, installedPayload);
  manifest.managed[root][id] = {
    mode: "copy",
    baseline: hashPayload(libraryPayload),
    installedAt: "2026-07-25T00:00:00Z",
    localOverride: false
  };
  return { libraryPayload, installedPayload };
}

test("v1 manifests upgrade without inferring ownership or losing selections", () => {
  const v1 = {
    version: 1,
    platform: "claude",
    scope: "local",
    enabled: ["sprint", "itr", "itr"],
    providers: { "issue-tracker": "itr" },
    updatedAt: "kept"
  };
  const result = normalizeManifest(v1, { library: "/tmp/library" });
  assert.equal(result.version, 2);
  assert.deepEqual(result.enabled, ["itr", "sprint"]);
  assert.deepEqual(result.providers, { "issue-tracker": "itr" });
  assert.deepEqual(result.managed, {
    skills: {},
    agents: {},
    commands: {},
    workflows: {}
  });
  assert.equal(result.updatedAt, "kept");
});

test("manifest v2 writes and reads both global and local schema", () => {
  const fixture = makeFixture();
  for (const scope of ["global", "local"]) {
    const file = path.join(fixture.root, `${scope}.json`);
    const manifest = normalizeManifest({}, {
      platform: "claude",
      scope,
      library: fixture.library
    });
    manifest.managed.agents["agent.md"] = {
      mode: "copy",
      baseline: `sha256:${"0".repeat(64)}`,
      installedAt: "2026-07-25T00:00:00Z"
    };
    writeManifest(file, manifest);
    const loaded = readManifest(file);
    assert.equal(loaded.manifest.version, 2);
    assert.equal(loaded.manifest.scope, scope);
    assert.deepEqual(loaded.manifest.managed.agents["agent.md"], manifest.managed.agents["agent.md"]);
  }
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("local generation reads a legacy v1 fallback and writes only the v2 path", () => {
  const fixture = makeFixture();
  const project = path.join(fixture.root, "project");
  const legacyFile = path.join(project, ".claude", "project-skills.json");
  const canonicalFile = path.join(project, ".claude", "project-primitives.json");
  write(legacyFile, `${JSON.stringify({
    version: 1,
    platform: "claude",
    scope: "local",
    enabled: ["itr"],
    providers: { "issue-tracker": "itr" }
  }, null, 2)}\n`);
  const legacyBefore = fs.readFileSync(legacyFile);

  const generated = generateManifest({
    project,
    platform: "claude",
    library: fixture.library
  });
  assert.equal(generated.source, legacyFile);
  assert.equal(generated.sourceVersion, 1);
  assert.equal(generated.context.manifestFile, canonicalFile);
  assert.deepEqual(generated.manifest.managed, {
    skills: {},
    agents: {},
    commands: {},
    workflows: {}
  });
  writeManifest(generated.context.manifestFile, generated.manifest);
  assert.deepEqual(fs.readFileSync(legacyFile), legacyBefore);
  assert.equal(readManifest(canonicalFile).manifest.version, 2);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("one hash function compares directory trees and flat files deterministically", () => {
  const fixture = makeFixture();
  const firstDirectory = addPayload(fixture.root, "skills", "first", "same\n");
  const secondDirectory = addPayload(fixture.root, "skills", "second", "same\n");
  const firstFile = addPayload(fixture.root, "agents", "first.md", "same\n");
  const secondFile = addPayload(fixture.root, "agents", "second.md", "same\n");
  assert.equal(hashPayload(firstDirectory), hashPayload(secondDirectory));
  assert.equal(hashPayload(firstFile), hashPayload(secondFile));
  write(path.join(secondDirectory, "extra.txt"), "changed\n");
  write(secondFile, "changed\n");
  assert.notEqual(hashPayload(firstDirectory), hashPayload(secondDirectory));
  assert.notEqual(hashPayload(firstFile), hashPayload(secondFile));
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("status distinguishes all baseline states across all roots and writes nothing", () => {
  const fixture = makeFixture();
  const manifest = normalizeManifest({}, {
    platform: "claude",
    scope: "global",
    library: fixture.library
  });

  const upToDate = addManaged(manifest, fixture.library, fixture.home, "skills", "up-to-date");
  const behind = addManaged(manifest, fixture.library, fixture.home, "agents", "behind.md");
  const locallyEdited = addManaged(manifest, fixture.library, fixture.home, "commands", "ns/local.md");
  const conflict = addManaged(manifest, fixture.library, fixture.home, "workflows", "conflict.js");
  const orphaned = addManaged(manifest, fixture.library, fixture.home, "skills", "orphaned");

  write(behind.libraryPayload, "library moved\n");
  write(locallyEdited.installedPayload, "installed moved\n");
  write(conflict.libraryPayload, "library moved\n");
  write(conflict.installedPayload, "installed moved\n");
  fs.rmSync(orphaned.libraryPayload, { recursive: true });

  addPayload(fixture.home, "skills", "personal-skill", "mine\n");
  addPayload(fixture.home, "agents", "personal-agent.md", "mine\n");
  addPayload(fixture.home, "commands", "mine/personal.md", "mine\n");
  addPayload(fixture.home, "workflows", "personal.js", "mine\n");

  const manifestFile = path.join(fixture.home, "primitives.json");
  writeManifest(manifestFile, manifest);
  const before = fixtureHash(fixture.root);
  const census = statusCensus({
    global: true,
    platform: "claude",
    claudeHome: fixture.home,
    library: fixture.library
  });
  const after = fixtureHash(fixture.root);

  assert.equal(before, after);
  assert.equal(census.totals.managed, 5);
  assert.equal(census.totals.unmanaged, 4);
  assert.equal(census.totals.upToDate, 1);
  assert.equal(census.totals.behind, 1);
  assert.equal(census.totals.locallyEdited, 1);
  assert.equal(census.totals.conflict, 1);
  assert.equal(census.totals.orphaned, 1);
  assert.equal(census.totals.drifted, 2);
  assert.equal(census.roots.skills.managed.find((entry) => entry.id === "up-to-date").state, "up-to-date");
  assert.equal(hashPayload(upToDate.installedPayload), upToDate.baseline || manifest.managed.skills["up-to-date"].baseline);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test("a missing manifest fails safe and reports every installed primitive as unmanaged", () => {
  const fixture = makeFixture();
  addPayload(fixture.home, "skills", "personal-skill", "mine\n");
  addPayload(fixture.home, "agents", "personal.md", "mine\n");
  const before = fixtureHash(fixture.root);
  const census = statusCensus({
    global: true,
    platform: "claude",
    claudeHome: fixture.home,
    library: fixture.library
  });
  assert.equal(fixtureHash(fixture.root), before);
  assert.equal(census.manifestFound, false);
  assert.equal(census.totals.managed, 0);
  assert.equal(census.totals.unmanaged, 2);
  fs.rmSync(fixture.root, { recursive: true, force: true });
});
