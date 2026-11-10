#!/usr/bin/env node
// tools/measure.mjs — shared pixel-measurement instrument for the Cyberfunk gauntlet loop.
//
// Packages the probes the critics re-derived by hand every round (see
// critiques/street_iter9.json method_note) into one zero-dependency CLI.
// Node >= 18, builtins only. Own PNG decoder (node:zlib inflateSync):
// 8-bit truecolor RGB/RGBA, non-interlaced, all five filter types incl. Paeth
// — exactly what puppeteer emits.
//
// Subcommands: assert | diff | torso-sat | rim-floor | luma-bands
// Every subcommand takes --json for machine output. See --help.

import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import process from 'node:process';

// ---------------------------------------------------------------- PNG decode

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function decodePNG(filePath) {
  let buf;
  try {
    buf = readFileSync(filePath);
  } catch (e) {
    throw new Error(`cannot read file: ${e.message}`);
  }
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error('not a PNG (bad signature)');
  }
  let pos = 8;
  let ihdr = null;
  const idat = [];
  let sawIEND = false;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const dataStart = pos + 8;
    const dataEnd = dataStart + len;
    if (dataEnd + 4 > buf.length) {
      throw new Error(`truncated PNG: chunk ${type} claims ${len} bytes past end of file`);
    }
    if (type === 'IHDR') {
      ihdr = {
        width: buf.readUInt32BE(dataStart),
        height: buf.readUInt32BE(dataStart + 4),
        bitDepth: buf[dataStart + 8],
        colorType: buf[dataStart + 9],
        compression: buf[dataStart + 10],
        filter: buf[dataStart + 11],
        interlace: buf[dataStart + 12],
      };
    } else if (type === 'IDAT') {
      idat.push(buf.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      sawIEND = true;
      break;
    }
    pos = dataEnd + 4; // skip CRC
  }
  if (!ihdr) throw new Error('truncated PNG: no IHDR chunk');
  if (ihdr.bitDepth !== 8) throw new Error(`unsupported bit depth ${ihdr.bitDepth} (only 8)`);
  if (ihdr.colorType !== 2 && ihdr.colorType !== 6) {
    throw new Error(`unsupported color type ${ihdr.colorType} (only 2=RGB, 6=RGBA)`);
  }
  if (ihdr.interlace !== 0) throw new Error('unsupported: interlaced PNG');
  if (idat.length === 0) throw new Error('truncated PNG: no IDAT data');
  if (!sawIEND) {
    // decode may still work; note it only if inflate fails below
  }
  const channels = ihdr.colorType === 2 ? 3 : 4;
  let raw;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch (e) {
    throw new Error(`truncated/corrupt PNG: zlib inflate failed (${e.message})`);
  }
  const { width, height } = ihdr;
  const stride = width * channels;
  const expected = (stride + 1) * height;
  if (raw.length < expected) {
    throw new Error(`truncated PNG: inflated ${raw.length} bytes, expected ${expected}`);
  }
  const out = Buffer.allocUnsafe(stride * height);
  let prevRow = null;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const dst = out.subarray(y * stride, (y + 1) * stride);
    switch (filter) {
      case 0: // None
        src.copy(dst);
        break;
      case 1: // Sub
        for (let i = 0; i < stride; i++) {
          dst[i] = (src[i] + (i >= channels ? dst[i - channels] : 0)) & 0xff;
        }
        break;
      case 2: // Up
        for (let i = 0; i < stride; i++) {
          dst[i] = (src[i] + (prevRow ? prevRow[i] : 0)) & 0xff;
        }
        break;
      case 3: // Average
        for (let i = 0; i < stride; i++) {
          const a = i >= channels ? dst[i - channels] : 0;
          const b = prevRow ? prevRow[i] : 0;
          dst[i] = (src[i] + ((a + b) >> 1)) & 0xff;
        }
        break;
      case 4: // Paeth
        for (let i = 0; i < stride; i++) {
          const a = i >= channels ? dst[i - channels] : 0;
          const b = prevRow ? prevRow[i] : 0;
          const c = i >= channels && prevRow ? prevRow[i - channels] : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          let pred;
          if (pa <= pb && pa <= pc) pred = a;
          else if (pb <= pc) pred = b;
          else pred = c;
          dst[i] = (src[i] + pred) & 0xff;
        }
        break;
      default:
        throw new Error(`invalid filter type ${filter} at row ${y}`);
    }
    prevRow = dst;
  }
  return { width, height, channels, data: out };
}

// ---------------------------------------------------------------- helpers

const LUM = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function loadJSONArg(pathArg, label) {
  let txt;
  try {
    txt = readFileSync(pathArg, 'utf8');
  } catch (e) {
    die(`cannot read ${label} file ${pathArg}: ${e.message}`);
  }
  try {
    return JSON.parse(txt);
  } catch (e) {
    die(`invalid JSON in ${label} file ${pathArg}: ${e.message}`);
  }
}

function normBox(b, idx, label) {
  const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1);
  const y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
  for (const [k, v] of [['x0', x0], ['x1', x1], ['y0', y0], ['y1', y1]]) {
    if (!Number.isFinite(v)) die(`${label}[${idx}] missing/invalid ${k}`);
  }
  return { name: b.name ?? `${label}${idx}`, x0, x1, y0, y1 };
}

function clampBox(b, w, h) {
  const c = {
    ...b,
    x0: Math.max(0, b.x0), y0: Math.max(0, b.y0),
    x1: Math.min(w - 1, b.x1), y1: Math.min(h - 1, b.y1),
  };
  if (c.x0 > c.x1 || c.y0 > c.y1) {
    die(`${c.name}: rect x${b.x0}-${b.x1} y${b.y0}-${b.y1} lies entirely outside the ${w}x${h} image`);
  }
  return c;
}

function die(msg, code = 2) {
  process.stderr.write(`measure: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv, flagsWithValue, boolFlags = ['json']) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (boolFlags.includes(name)) { opts[name] = true; continue; }
      if (flagsWithValue.includes(name)) {
        if (i + 1 >= argv.length) die(`--${name} requires a value`);
        opts[name] = argv[++i];
        continue;
      }
      die(`unknown option --${name} (see --help)`);
    } else {
      opts._.push(a);
    }
  }
  return opts;
}

function emit(jsonMode, obj, textFn) {
  if (jsonMode) process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  else process.stdout.write(textFn(obj));
}

const r3 = (x) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------- assert

function cmdAssert(argv) {
  const opts = parseArgs(argv, ['w', 'h', 'min-std']);
  const files = opts._;
  if (files.length === 0) die('assert: at least one <png> required');
  const expW = opts.w !== undefined ? parseInt(opts.w, 10) : 1280;
  const expH = opts.h !== undefined ? parseInt(opts.h, 10) : 720;
  const minStd = opts['min-std'] !== undefined ? parseFloat(opts['min-std']) : 2.0;

  const results = [];
  let anyFail = false;
  for (const f of files) {
    const res = { file: f, ok: false, reason: null };
    if (!existsSync(f)) {
      res.reason = 'file does not exist';
      anyFail = true; results.push(res); continue;
    }
    let img;
    try {
      img = decodePNG(f);
    } catch (e) {
      res.reason = `decode failed: ${e.message}`;
      anyFail = true; results.push(res); continue;
    }
    res.width = img.width; res.height = img.height;
    res.channels = img.channels;
    if (img.width !== expW || img.height !== expH) {
      res.reason = `dimensions ${img.width}x${img.height}, expected ${expW}x${expH}`;
      anyFail = true; results.push(res); continue;
    }
    // blank/uniform check: sampled luminance stddev
    const { data, channels, width, height } = img;
    let n = 0, sum = 0, sumSq = 0;
    const step = 5; // ~36k samples on 1280x720
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * channels;
        const l = LUM(data[i], data[i + 1], data[i + 2]);
        n++; sum += l; sumSq += l * l;
      }
    }
    const mean = sum / n;
    const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
    res.sampledLumMean = r3(mean);
    res.sampledLumStd = r3(std);
    if (std < minStd) {
      res.reason = `blank/uniform image: sampled luminance stddev ${r3(std)} < ${minStd}`;
      anyFail = true; results.push(res); continue;
    }
    res.ok = true;
    results.push(res);
  }

  emit(opts.json, { command: 'assert', expected: { width: expW, height: expH, minStd }, ok: !anyFail, results },
    (o) => o.results.map((r) =>
      r.ok
        ? `PASS ${r.file} (${r.width}x${r.height}, ${r.channels}ch, lum mean ${r.sampledLumMean} std ${r.sampledLumStd})\n`
        : `FAIL ${r.file}: ${r.reason}\n`
    ).join(''));
  process.exit(anyFail ? 1 : 0);
}

// ---------------------------------------------------------------- diff

function cmdDiff(argv) {
  const opts = parseArgs(argv, ['threshold', 'boxes', 'pad']);
  if (opts._.length !== 2) die('diff: exactly two <png> paths required');
  const [pa, pb] = opts._;
  const threshold = opts.threshold !== undefined ? parseInt(opts.threshold, 10) : 0;
  const pad = opts.pad !== undefined ? parseInt(opts.pad, 10) : 0;

  let a, b;
  try { a = decodePNG(pa); } catch (e) { die(`${pa}: ${e.message}`, 1); }
  try { b = decodePNG(pb); } catch (e) { die(`${pb}: ${e.message}`, 1); }
  if (a.width !== b.width || a.height !== b.height) {
    die(`dimension mismatch: ${pa} is ${a.width}x${a.height}, ${pb} is ${b.width}x${b.height}`, 1);
  }
  const { width, height } = a;

  let boxes = null;
  if (opts.boxes) {
    const rawBoxes = loadJSONArg(opts.boxes, 'boxes');
    if (!Array.isArray(rawBoxes)) die('boxes JSON must be an array of {name,x0,y0,x1,y1}');
    boxes = rawBoxes.map((bx, i) => clampBox(normBox({
      ...bx, x0: bx.x0 - pad, y0: bx.y0 - pad, x1: bx.x1 + pad, y1: bx.y1 + pad,
    }, i, 'box'), width, height));
  }
  // membership mask of the union (only when boxes given)
  let inUnion = null;
  if (boxes) {
    inUnion = new Uint8Array(width * height);
    for (const bx of boxes) {
      for (let y = bx.y0; y <= bx.y1; y++) {
        inUnion.fill(1, y * width + bx.x0, y * width + bx.x1 + 1);
      }
    }
  }

  // compare RGB always; compare alpha only when both images carry it
  const compareAlpha = a.channels === 4 && b.channels === 4;
  let changed = 0, inside = 0, outside = 0;
  let maxDelta = 0;
  const strays = [];
  const da = a.data, db = b.data, ca = a.channels, cb = b.channels;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ia = (y * width + x) * ca;
      const ib = (y * width + x) * cb;
      let d = Math.abs(da[ia] - db[ib]);
      const dg = Math.abs(da[ia + 1] - db[ib + 1]); if (dg > d) d = dg;
      const dbl = Math.abs(da[ia + 2] - db[ib + 2]); if (dbl > d) d = dbl;
      if (compareAlpha) { const dal = Math.abs(da[ia + 3] - db[ib + 3]); if (dal > d) d = dal; }
      if (d > maxDelta) maxDelta = d;
      if (d > threshold) {
        changed++;
        if (inUnion) {
          if (inUnion[y * width + x]) inside++;
          else {
            outside++;
            if (strays.length < 20) strays.push({ x, y, delta: d });
          }
        }
      }
    }
  }

  const out = {
    command: 'diff', a: pa, b: pb, width, height, threshold,
    changed, totalPixels: width * height, maxDelta,
    identical: changed === 0,
  };
  if (boxes) {
    out.pad = pad;
    out.boxes = boxes.map((bx) => ({ name: bx.name, x0: bx.x0, y0: bx.y0, x1: bx.x1, y1: bx.y1 }));
    out.inside = inside;
    out.outside = outside;
    out.strayOutside = strays;
  }
  emit(opts.json, out, (o) => {
    let s = `diff ${o.a} vs ${o.b} (${o.width}x${o.height}, threshold ${o.threshold})\n`;
    s += `changed: ${o.changed} / ${o.totalPixels} px, max delta ${o.maxDelta}${o.identical ? ' — BYTE-IDENTICAL (RGB' + (compareAlpha ? 'A' : '') + ')' : ''}\n`;
    if (boxes) {
      s += `inside union (pad ${o.pad}): ${o.inside}   outside: ${o.outside}\n`;
      if (o.strayOutside.length > 0) {
        s += `strays (first ${o.strayOutside.length}):\n`;
        for (const st of o.strayOutside) s += `  x=${st.x} y=${st.y} delta=${st.delta}\n`;
      }
    }
    return s;
  });
  process.exit(0);
}

// ---------------------------------------------------------------- torso-sat

function cmdTorsoSat(argv) {
  const opts = parseArgs(argv, ['rects']);
  if (opts._.length !== 1) die('torso-sat: exactly one <png> required');
  if (!opts.rects) die('torso-sat: --rects <rects.json> required');
  const rawRects = loadJSONArg(opts.rects, 'rects');
  if (!Array.isArray(rawRects) || rawRects.length === 0) die('rects JSON must be a non-empty array of {name,x0,x1,y0,y1}');

  let img;
  try { img = decodePNG(opts._[0]); } catch (e) { die(`${opts._[0]}: ${e.message}`, 1); }
  const { data, channels, width, height } = img;
  const rects = rawRects.map((r, i) => clampBox(normBox(r, i, 'rect'), width, height));

  const perRect = [];
  for (const r of rects) {
    let sum = 0, mx = 0, n = 0;
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const i = (y * width + x) * channels;
        const R = data[i], G = data[i + 1], B = data[i + 2];
        const hi = Math.max(R, G, B), lo = Math.min(R, G, B);
        const s = hi === 0 ? 0 : (hi - lo) / hi;
        sum += s; if (s > mx) mx = s; n++;
      }
    }
    perRect.push({
      name: r.name, x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1,
      pixels: n, meanSat: r3(sum / n), maxSat: r3(mx),
    });
  }
  const means = perRect.map((r) => r.meanSat);
  const aggregate = {
    // aggregate over the per-rect MEANS — the convention the street critics published
    meanOfRectMeans: r3(means.reduce((s, v) => s + v, 0) / means.length),
    maxOfRectMeans: r3(Math.max(...means)),
    maxPixelSat: r3(Math.max(...perRect.map((r) => r.maxSat))),
  };
  emit(opts.json, { command: 'torso-sat', file: opts._[0], perRect, aggregate }, (o) => {
    let s = `torso-sat ${o.file}\n`;
    for (const r of o.perRect) {
      s += `  ${r.name.padEnd(14)} x${r.x0}-${r.x1} y${r.y0}-${r.y1}  mean ${r.meanSat.toFixed(3)}  max ${r.maxSat.toFixed(3)}\n`;
    }
    s += `aggregate: mean(of rect means) ${o.aggregate.meanOfRectMeans.toFixed(3)}  max(of rect means) ${o.aggregate.maxOfRectMeans.toFixed(3)}  max pixel ${o.aggregate.maxPixelSat.toFixed(3)}\n`;
    return s;
  });
  process.exit(0);
}

// ---------------------------------------------------------------- rim-floor

function cmdRimFloor(argv) {
  const opts = parseArgs(argv, ['boxes', 'ring', 'gap']);
  if (opts._.length !== 1) die('rim-floor: exactly one <png> required');
  if (!opts.boxes) die('rim-floor: --boxes <boxes.json> required');
  const ring = opts.ring !== undefined ? parseInt(opts.ring, 10) : 3;
  const gap = opts.gap !== undefined ? parseInt(opts.gap, 10) : 5;
  const rawBoxes = loadJSONArg(opts.boxes, 'boxes');
  if (!Array.isArray(rawBoxes) || rawBoxes.length === 0) die('boxes JSON must be a non-empty array of {name,x0,y0,x1,y1}');

  let img;
  try { img = decodePNG(opts._[0]); } catch (e) { die(`${opts._[0]}: ${e.message}`, 1); }
  const { data, channels, width, height } = img;
  const boxes = rawBoxes.map((b, i) => clampBox(normBox(b, i, 'box'), width, height));

  const meanLum = (x0, x1, y0, y1) => {
    if (x1 < x0 || y1 < y0) return null;
    let sum = 0, n = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * width + x) * channels;
        sum += LUM(data[i], data[i + 1], data[i + 2]); n++;
      }
    }
    return n ? sum / n : null;
  };

  const perBox = [];
  for (const b of boxes) {
    const w = b.x1 - b.x0 + 1;
    const entry = { name: b.name, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, ring, gap };
    if (w < 2 * gap + 1 || w < 2 * ring) {
      entry.error = `box too narrow (${w} cols) for ring ${ring} / gap ${gap}`;
      perBox.push(entry); continue;
    }
    const ringL = meanLum(b.x0, b.x0 + ring - 1, b.y0, b.y1);
    const ringR = meanLum(b.x1 - ring + 1, b.x1, b.y0, b.y1);
    const interior = meanLum(b.x0 + gap, b.x1 - gap, b.y0, b.y1);
    entry.ringL = r3(ringL);
    entry.ringR = r3(ringR);
    entry.interior = r3(interior);
    entry.ringL_minus_interior = r3(ringL - interior);
    entry.ringR_minus_interior = r3(ringR - interior);
    perBox.push(entry);
  }
  emit(opts.json, { command: 'rim-floor', file: opts._[0], ring, gap, perBox }, (o) => {
    let s = `rim-floor ${o.file} (ring ${o.ring}, gap ${o.gap})\n`;
    for (const b of o.perBox) {
      if (b.error) { s += `  ${b.name.padEnd(14)} ERROR: ${b.error}\n`; continue; }
      s += `  ${b.name.padEnd(14)} ringL ${b.ringL.toFixed(1).padStart(6)}  ringR ${b.ringR.toFixed(1).padStart(6)}  interior ${b.interior.toFixed(1).padStart(6)}  L-int ${b.ringL_minus_interior >= 0 ? '+' : ''}${b.ringL_minus_interior.toFixed(1)}  R-int ${b.ringR_minus_interior >= 0 ? '+' : ''}${b.ringR_minus_interior.toFixed(1)}\n`;
    }
    return s;
  });
  process.exit(0);
}

// ---------------------------------------------------------------- luma-bands

function cmdLumaBands(argv) {
  const opts = parseArgs(argv, ['bands']);
  if (opts._.length !== 1) die('luma-bands: exactly one <png> required');
  if (!opts.bands) die('luma-bands: --bands y0:y1[,y0:y1...] required');

  let img;
  try { img = decodePNG(opts._[0]); } catch (e) { die(`${opts._[0]}: ${e.message}`, 1); }
  const { data, channels, width, height } = img;

  const bands = opts.bands.split(',').map((spec) => {
    const m = spec.trim().match(/^(\d+):(\d+)$/);
    if (!m) die(`invalid band spec '${spec}' (expected y0:y1)`);
    let y0 = parseInt(m[1], 10), y1 = parseInt(m[2], 10);
    if (y0 > y1) [y0, y1] = [y1, y0];
    const cy0 = Math.max(0, y0), cy1 = Math.min(height - 1, y1);
    if (cy0 > cy1) die(`band ${y0}:${y1} lies entirely outside the ${height}-row image`);
    return { y0: cy0, y1: cy1 };
  });

  const perBand = bands.map((b) => {
    let sum = 0, n = 0;
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels;
        sum += LUM(data[i], data[i + 1], data[i + 2]); n++;
      }
    }
    return { band: `${b.y0}:${b.y1}`, y0: b.y0, y1: b.y1, rows: b.y1 - b.y0 + 1, meanLum: r3(sum / n) };
  });
  emit(opts.json, { command: 'luma-bands', file: opts._[0], width, perBand }, (o) => {
    let s = `luma-bands ${o.file} (full width ${o.width})\n`;
    for (const b of o.perBand) s += `  y${b.band.padEnd(9)} (${b.rows} rows)  mean lum ${b.meanLum.toFixed(2)}\n`;
    return s;
  });
  process.exit(0);
}

// ---------------------------------------------------------------- help / main

const HELP = `measure.mjs — pixel-measurement instrument for the Cyberfunk gauntlet loop
Zero dependencies (node builtins). Own PNG decoder: 8-bit RGB/RGBA, non-interlaced,
all five filter types. Inclusive pixel coordinates everywhere. All commands take --json.

USAGE
  node tools/measure.mjs <command> [args] [--json]

COMMANDS
  assert <png...> [--w 1280] [--h 720] [--min-std 2]
      Capture gate: each file must exist, decode, match dimensions, and not be
      blank/uniform (sampled luminance stddev >= --min-std). Exit 1 naming
      file + reason on any failure; exit 0 when all pass.

  diff <a.png> <b.png> [--threshold 0] [--boxes boxes.json] [--pad 0]
      Changed-pixel count where max-channel |delta| > threshold (RGB, plus alpha
      when both images have it). With --boxes ([{name,x0,y0,x1,y1}], inclusive),
      each box grown by --pad: reports changed counts inside vs outside the union
      plus up to 20 stray outside coordinates with deltas. For hold-set proofs
      ("nothing changed outside the character boxes") and byte-identity checks.

  torso-sat <png> --rects rects.json
      Per-rect mean and max HSV saturation (S=(max-min)/max, 0 for black) plus
      aggregate mean/max over the per-rect means (the published convention).
      rects.json: [{name,x0,x1,y0,y1}] inclusive.

  rim-floor <png> --boxes boxes.json [--ring 3] [--gap 5]
      Per box: mean luminance (0.2126R+0.7152G+0.0722B) of the outermost --ring
      columns on each side vs the interior (box minus --gap columns per side).
      Reports ringL, ringR, interior, ringL-interior, ringR-interior.

  luma-bands <png> --bands y0:y1[,y0:y1...]
      Mean luminance per horizontal band (inclusive rows) across full width.

EXIT CODES
  0 success · 1 measurement/decode failure (incl. assert FAIL) · 2 usage error
`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    process.stdout.write(HELP);
    process.exit(argv.length === 0 ? 2 : 0);
  }
  const cmd = argv[0];
  const rest = argv.slice(1);
  if (rest.includes('--help') || rest.includes('-h')) { process.stdout.write(HELP); process.exit(0); }
  switch (cmd) {
    case 'assert': return cmdAssert(rest);
    case 'diff': return cmdDiff(rest);
    case 'torso-sat': return cmdTorsoSat(rest);
    case 'rim-floor': return cmdRimFloor(rest);
    case 'luma-bands': return cmdLumaBands(rest);
    default: die(`unknown command '${cmd}' (see --help)`);
  }
}

main();
