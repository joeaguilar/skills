"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { retireInstalled } = require("./retire-archived-primitives.js");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lean-fleet-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const codexRoot = path.join(root, "codex");
  const home = path.join(root, "home");
  const entries = ["copied", "linked", "modified", "foreign"].map(name => ({ root: "skills", name, replacement: "mission" }));
  for (const { name } of entries) {
    const dir = path.join(codexRoot, "archived/skills", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), `original ${name}\n`);
  }
  fs.writeFileSync(path.join(codexRoot, "archived/manifest.json"), JSON.stringify({ entries }));
  fs.mkdirSync(path.join(home, "skills"), { recursive: true });
  return { root, codexRoot, home };
}

test("dry run preserves everything; apply retires only verified copies and stale links", t => {
  const f = fixture(t);
  const installed = name => path.join(f.home, "skills", name);
  fs.cpSync(path.join(f.codexRoot, "archived/skills/copied"), installed("copied"), { recursive: true });
  fs.cpSync(path.join(f.codexRoot, "archived/skills/modified"), installed("modified"), { recursive: true });
  fs.appendFileSync(path.join(installed("modified"), "SKILL.md"), "user changes\n");
  fs.mkdirSync(path.join(f.codexRoot, "skills/linked"), { recursive: true });
  fs.symlinkSync(path.join(f.codexRoot, "skills/linked"), installed("linked"), "junction");
  fs.rmdirSync(path.join(f.codexRoot, "skills/linked"));
  fs.symlinkSync(path.join(f.codexRoot, "archived/skills/copied"), installed("foreign"), "junction");
  const before = fs.readdirSync(path.join(f.home, "skills"));
  const dry = retireInstalled(f);
  assert.equal(dry.retired.length, 2);
  assert.equal(dry.preserved.length, 2);
  assert.deepEqual(fs.readdirSync(path.join(f.home, "skills")), before);
  assert.equal(fs.existsSync(path.join(f.home, "primitive-backups")), false);
  const applied = retireInstalled({ ...f, apply: true });
  assert.deepEqual(fs.readdirSync(path.join(f.home, "skills")).sort(), ["foreign", "modified"]);
  assert.equal(fs.readFileSync(path.join(applied.backup, "skills/copied/SKILL.md"), "utf8"), "original copied\n");
  assert.equal(fs.lstatSync(path.join(applied.backup, "skills/linked")).isSymbolicLink(), true);
  assert.equal(retireInstalled({ ...f, apply: true }).retired.length, 0);
});

test("never traverses a linked installed root or accepts an escaping archive name", t => {
  const f = fixture(t);
  fs.rmdirSync(path.join(f.home, "skills"));
  fs.symlinkSync(path.join(f.codexRoot, "archived/skills"), path.join(f.home, "skills"), "junction");
  const result = retireInstalled({ ...f, apply: true });
  assert.equal(result.retired.length, 0);
  assert.equal(result.preserved.length, 4);
  assert.equal(fs.existsSync(path.join(f.codexRoot, "archived/skills/copied/SKILL.md")), true);
  fs.writeFileSync(path.join(f.codexRoot, "archived/manifest.json"), JSON.stringify({ entries: [{ root: "skills", name: "../outside" }] }));
  assert.throws(() => retireInstalled(f), /Invalid archived primitive/);
});
