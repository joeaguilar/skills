#!/usr/bin/env node
"use strict";

// Retire only verified links or byte-identical copies. Default: report, no writes.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { hashPayload } = require("../../scripts/primitives.js");

function contained(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function stat(file) {
  try { return fs.lstatSync(file); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

function retireInstalled({ codexRoot = path.resolve(__dirname, ".."), home, roots = ["skills", "agents", "commands"], apply = false }) {
  codexRoot = path.resolve(codexRoot);
  home = path.resolve(home);
  if (home === codexRoot || contained(codexRoot, home)) throw new Error("Installed home must be outside the canonical Codex tree");
  const manifestFile = path.join(codexRoot, "archived", "manifest.json");
  if (!fs.existsSync(manifestFile)) return { retired: [], preserved: [], backup: null };
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const planned = [];
  const preserved = [];
  for (const entry of manifest.entries) {
    if (!["skills", "agents", "commands"].includes(entry.root) || path.basename(entry.name) !== entry.name || entry.name.startsWith(".")) {
      throw new Error("Invalid archived primitive path");
    }
    if (!roots.includes(entry.root)) continue;
    const source = path.join(codexRoot, entry.root, entry.name);
    const archived = path.join(codexRoot, "archived", entry.root, entry.name);
    const installedRoot = path.join(home, entry.root);
    const installed = path.join(installedRoot, entry.name);
    if (!contained(home, installed) || !contained(codexRoot, archived)) throw new Error("Retirement path escaped its root");
    if (stat(source)) throw new Error(`Archived primitive is also active: ${source}`);
    if (!stat(archived)) throw new Error(`Missing archived payload: ${archived}`);
    // Never mutate a canonical or third-party tree through a linked root.
    if (stat(installedRoot)?.isSymbolicLink()) {
      if (stat(installed)) preserved.push({ path: installed, reason: "linked primitive root; inspect separately" });
      continue;
    }
    const current = stat(installed);
    if (!current) continue;
    let managed = false;
    if (current.isSymbolicLink()) {
      const target = path.resolve(path.dirname(installed), fs.readlinkSync(installed));
      managed = target === source || target === archived;
    } else {
      managed = hashPayload(installed) === hashPayload(archived);
    }
    if (managed) planned.push({ ...entry, path: installed });
    else preserved.push({ path: installed, reason: "custom content or unrelated link" });
  }
  let backup = null;
  if (apply && planned.length) {
    const parent = path.join(home, "primitive-backups");
    if (stat(parent)?.isSymbolicLink()) throw new Error("Backup root must not be a link");
    fs.mkdirSync(parent, { recursive: true });
    backup = fs.mkdtempSync(path.join(parent, "lean-fleet-"));
    for (const item of planned) {
      const destination = path.join(backup, item.root, item.name);
      if (!contained(home, item.path) || !contained(backup, destination)) throw new Error("Move escaped installed home or backup root");
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.renameSync(item.path, destination);
    }
  }
  return { retired: planned, preserved, backup };
}

function main(args) {
  const options = { home: process.env.CODEX_HOME || path.join(os.homedir(), ".codex") };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") options.apply = true;
    else if (args[i] === "--home") options.home = args[++i];
    else if (args[i] === "--codex-root") options.codexRoot = args[++i];
    else if (args[i] === "--root") options.roots = [args[++i]];
    else throw new Error(`Unknown option: ${args[i]}`);
  }
  if (!options.home || options.roots?.some(root => !["skills", "agents", "commands"].includes(root))) throw new Error("Invalid home or primitive root");
  const result = retireInstalled(options);
  for (const item of result.retired) console.log(`${options.apply ? "RETIRED" : "WOULD RETIRE"} ${item.path} -> ${item.replacement}`);
  for (const item of result.preserved) console.log(`PRESERVE ${item.path}: ${item.reason}`);
  console.log(`${options.apply ? "Applied" : "Dry run"}: ${result.retired.length} retirement(s), ${result.preserved.length} preserved override(s).${result.backup ? ` Backup: ${result.backup}` : ""}`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { retireInstalled };
