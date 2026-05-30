const STORAGE_KEY = "codex.skill-tree.enabled.v1";
const ZOOM_KEY = "codex.skill-tree.zoom.v1";
const REGISTRY_URL = "../registry/skill-tree.json";
const TREE_WIDTH = 1180;
const TREE_HEIGHT = 760;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;

const els = {
  field: document.getElementById("field"),
  unlockLayer: document.getElementById("unlockLayer"),
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
  providesList: document.getElementById("providesList"),
  requiresList: document.getElementById("requiresList"),
  recommendsList: document.getElementById("recommendsList"),
  toggleSkill: document.getElementById("toggleSkill"),
  manifestPreview: document.getElementById("manifestPreview"),
  manifestState: document.getElementById("manifestState"),
  selectProject: document.getElementById("selectProject"),
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
let enabled = new Set(loadEnabled());
let selectedId = null;
let treeZoom = loadZoom();
let projectHandle = null;
let projectName = "local";

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

function loadEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEnabled() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(enabled).sort()));
  if (projectHandle) void persistProjectManifest();
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
  return registry.capabilities[capability]?.label || capability;
}

function skillEntries() {
  return Object.entries(registry.skills);
}

function themeFor(skill) {
  return THEMES[skill.theme] || THEMES.aether;
}

function providers() {
  const provided = {};
  for (const id of enabled) {
    const skill = registry.skills[id];
    if (!skill) continue;
    for (const capability of skill.provides || []) {
      if (!provided[capability]) provided[capability] = id;
    }
  }
  return provided;
}

function missingRequired(skill, provided = providers()) {
  return (skill.requires || []).filter((capability) => !provided[capability]);
}

function missingRecommended(skill, provided = providers()) {
  return (skill.recommends || []).filter((capability) => !provided[capability]);
}

function stateFor(id, provided = providers()) {
  const skill = registry.skills[id];
  if (enabled.has(id)) return "enabled";
  if (missingRequired(skill, provided).length) return "locked";
  return "available";
}

function manifest() {
  return {
    version: 1,
    project: projectHandle ? projectName : undefined,
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

function updateProjectLabel() {
  if (projectHandle) {
    els.projectPath.textContent = `Project: ${projectName}/.codex/project-skills.json`;
    els.selectProject.classList.remove("unsupported");
    els.selectProject.querySelector("small").textContent = "Selected";
    els.selectProject.title = `Selected project: ${projectName}`;
  } else {
    els.projectPath.textContent = `Project manifest: ${registry?.manifestPath || ".codex/project-skills.json"}`;
    els.selectProject.querySelector("small").textContent = "Project";
    els.selectProject.title = supportsFolderPicker()
      ? "Select project folder"
      : "Folder picker unavailable in this browser";
  }
}

function supportsFolderPicker() {
  return typeof window.showDirectoryPicker === "function";
}

async function readProjectManifest(handle) {
  try {
    const codexDir = await handle.getDirectoryHandle(".codex", { create: false });
    const fileHandle = await codexDir.getFileHandle("project-skills.json", { create: false });
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text());
  } catch (error) {
    if (error && (error.name === "NotFoundError" || error.name === "TypeMismatchError")) {
      return { version: 1, enabled: [], providers: {} };
    }
    throw error;
  }
}

async function persistProjectManifest() {
  if (!projectHandle) return;
  try {
    setProjectStatus("saving");
    const codexDir = await projectHandle.getDirectoryHandle(".codex", { create: true });
    const fileHandle = await codexDir.getFileHandle("project-skills.json", { create: true });
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
      id: "codex-skill-tree-project",
      mode: "readwrite"
    });
    if (typeof handle.requestPermission === "function") {
      const permission = await handle.requestPermission({ mode: "readwrite" });
      if (permission !== "granted") {
        setProjectStatus("permission denied");
        return;
      }
    }

    const projectManifest = await readProjectManifest(handle);
    projectHandle = handle;
    projectName = handle.name || "selected project";
    enabled = new Set((projectManifest.enabled || []).filter((id) => registry.skills[id]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(enabled).sort()));
    updateProjectLabel();
    setProjectStatus(`loaded: ${projectName}`);
    render();
  } catch (error) {
    if (error && error.name === "AbortError") {
      setProjectStatus("selection cancelled");
      return;
    }
    setProjectStatus("project load failed");
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

function renderLinks() {
  const provided = providers();
  els.linkLayer.innerHTML = "";
  for (const [id, skill] of skillEntries()) {
    const childState = stateFor(id, provided);
    for (const parentId of skill.unlockedBy || []) {
      const parent = registry.skills[parentId];
      if (!parent) continue;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", parent.position.x);
      line.setAttribute("y1", parent.position.y);
      line.setAttribute("x2", skill.position.x);
      line.setAttribute("y2", skill.position.y);
      if (enabled.has(parentId) && childState !== "locked") line.classList.add("hot");
      els.linkLayer.appendChild(line);
    }
  }
}

function renderTree() {
  const provided = providers();
  els.treeMap.innerHTML = "";
  const rows = skillEntries().map(([id, skill]) => ({ id, skill, state: stateFor(id, provided) }));
  const visible = rows.map((row) => row.id);
  const availableCount = rows.filter((row) => row.state === "available").length;

  if (!selectedId || !visible.includes(selectedId)) {
    selectedId =
      visible.find((id) => enabled.has(id)) ||
      visible.find((id) => stateFor(id, provided) === "available") ||
      visible[0] ||
      null;
  }

  for (const { id, skill, state } of rows) {
    const group = registry.groups[skill.group];
    const theme = themeFor(skill);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `skill-node ${state} theme-${skill.theme || "aether"}${selectedId === id ? " selected" : ""}`;
    button.style.setProperty("--x", `${skill.position.x}%`);
    button.style.setProperty("--y", `${skill.position.y}%`);
    button.style.setProperty("--accent", group?.accent || "#f0c866");
    button.style.setProperty("--theme-a", theme.a);
    button.style.setProperty("--theme-b", theme.b);
    button.style.setProperty("--theme-c", theme.c);
    button.setAttribute("aria-label", `${skill.title} ${state}`);
    button.dataset.skill = id;
    button.dataset.theme = skill.theme || "aether";
    button.innerHTML = `
      <span class="node-core"><span class="node-icon">${escapeHtml(skill.icon || id.slice(0, 3).toUpperCase())}</span></span>
      <span class="node-title">${escapeHtml(skill.title || id)}</span>
    `;
    button.addEventListener("click", () => {
      selectedId = id;
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
  const skill = selectedId ? registry.skills[selectedId] : null;
  if (!skill) return;

  const state = stateFor(selectedId, provided);
  const group = registry.groups[skill.group];
  const theme = themeFor(skill);
  els.selectedIcon.textContent = skill.icon || selectedId.slice(0, 3).toUpperCase();
  els.selectedIcon.style.setProperty("--cold", group?.accent || "#6ad7d2");
  els.selectedIcon.style.setProperty("--theme-a", theme.a);
  els.selectedIcon.style.setProperty("--theme-b", theme.b);
  els.selectedState.textContent = state;
  els.selectedTitle.textContent = skill.title || selectedId;
  els.selectedSummary.textContent = skill.summary || "";
  els.selectedPath.textContent = skill.path || "";
  renderChips(els.providesList, skill.provides || [], provided, "provided");
  renderChips(els.requiresList, skill.requires || [], provided, "required");
  renderChips(els.recommendsList, skill.recommends || [], provided, "recommended");

  els.toggleSkill.classList.toggle("disable", state === "enabled");
  if (state === "enabled") {
    els.toggleSkill.textContent = "Disable Skill";
    els.toggleSkill.disabled = false;
  } else if (state === "available") {
    els.toggleSkill.textContent = `Awaken ${theme.label}`;
    els.toggleSkill.disabled = false;
  } else if (state === "locked") {
    els.toggleSkill.textContent = "Locked";
    els.toggleSkill.disabled = true;
  } else {
    els.toggleSkill.textContent = "Hidden";
    els.toggleSkill.disabled = true;
  }

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
    if (mode === "required" && !satisfied) chip.classList.add("missing");
    if (mode === "recommended" && !satisfied) chip.classList.add("recommended");
    chip.textContent = capabilityLabel(capability);
    if (satisfied) chip.title = `Provided by ${provided[capability]}`;
    container.appendChild(chip);
  }
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
  const skill = registry.skills[id];
  if (!skill) return;
  const node = document.querySelector(`button[data-skill="${id}"]`);
  const rect = node?.getBoundingClientRect();
  const themeName = skill.theme || "aether";
  const theme = themeFor(skill);
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
    <div class="burst-core">${escapeHtml(skill.icon || id.slice(0, 3).toUpperCase())}</div>
    <div class="burst-title">${escapeHtml(skill.title || id)} awakened</div>
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
    els.manifestState.textContent = "local";
  }, 1200);
}

function resetTree() {
  enabled = new Set();
  saveEnabled();
  render();
}

function render() {
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
  registry = await response.json();
  updateProjectLabel();
  if (!supportsFolderPicker()) els.selectProject.classList.add("unsupported");
  enabled = new Set(Array.from(enabled).filter((id) => registry.skills[id]));
  setZoom(treeZoom, { skipPersist: true });
  renderGroups();
  render();
  els.toggleSkill.addEventListener("click", toggleSelected);
  els.selectProject.addEventListener("click", selectProjectFolder);
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
