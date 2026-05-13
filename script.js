/* DSC106 Project 3 — Trends in California Vegetation Over Time
 * Real NASA Terra/MODIS true-color imagery, 8 dates × 4 regions.
 *
 * D3.js v7 is the only plotting library; vanilla DOM for everything else.
 * No data fetched at runtime: data/manifest.json is preprocessed by
 * artifacts/data_explorer.py from real JPGs in data/raw/vegetation/.
 */
(() => {
  // ---------------------------------------------------------------- constants
  const REGIONS = ["all", "sierra", "valley", "socal"];
  const REGION_LABEL = {
    all:    "Statewide",
    sierra: "Sierra Nevada",
    valley: "Central Valley",
    socal:  "Southern California",
  };
  const REGION_COLOR = {
    all:    "#1A1A17",
    sierra: "#2563EB",
    valley: "#0F766E",
    socal:  "#D97706",
  };
  const MEASURES = ["greenness", "brown", "brightness"];
  const MEASURE_LABEL = {
    greenness:  "Greenness proxy (G − R) / (G + R + B)",
    brown:      "Brown proxy (R − G) / (G + R + B)",
    brightness: "Brightness mean(R + G + B)/3",
  };
  // Compact formula labels for the y-axis caption (no redundant "proxy" word —
  // the chart-foot already explains the transformation in plain English).
  const MEASURE_FORMULA = {
    greenness:  "(G − R) / (G + R + B)  · proxy, not NDVI",
    brown:      "(R − G) / (G + R + B)  · proxy",
    brightness: "(R + G + B) / 3",
  };

  // 6-bin diverging palette for greenness overlay
  // (rubric explicitly recommended binned colors)
  const OVERLAY_BINS = [
    { lo: -Infinity, hi: -0.04, color: "#7B3F00" }, // deep brown
    { lo: -0.04, hi: -0.02,    color: "#B45309" }, // amber
    { lo: -0.02, hi:  0.00,    color: "#E5C2A0" }, // pale tan
    { lo:  0.00, hi:  0.02,    color: "#9DC3A4" }, // pale green
    { lo:  0.02, hi:  0.04,    color: "#0F766E" }, // teal-green
    { lo:  0.04, hi:  Infinity, color: "#064E3B" }, // deep green
  ];
  const overlayColorOf = (v) => {
    for (const b of OVERLAY_BINS) if (v >= b.lo && v < b.hi) return b.color;
    return OVERLAY_BINS[OVERLAY_BINS.length - 1].color;
  };

  // narrative captions keyed off (year, season)
  const CAPTIONS = {
    "2023-winter": "January 2023 — atmospheric-river winter ends the 2020–22 drought; Sierra greenness anomalously high (+0.0004), valley a touch wet.",
    "2023-spring": "April 2023 — recovery spring. Statewide greenness barely positive (+0.0002); Central Valley still has farm-block greenness (+0.0022).",
    "2023-summer": "July 2023 — statewide brown-out (−0.0264). Even after a wet winter, summer dries California out fast.",
    "2023-autumn": "October 2023 — pre-rain low. Brown proxy peaks across all regions.",
    "2024-winter": "January 2024 — drier winter; Sierra greenness collapses to −0.0345 (vs +0.0004 the year before). The wet/dry contrast is visible by eye.",
    "2024-spring": "April 2024 — Central Valley peaks (+0.0198), the greenest single region-date in this dataset. Sierra still recovering.",
    "2024-summer": "July 2024 — summer brown-out continues; statewide greenness back to negative.",
    "2024-autumn": "October 2024 — late-season dryness ahead of next winter rains. Most-negative end-of-year greenness across all regions.",
  };

  // narrative annotations on the chart
  const ANNOTATIONS = [
    { start: "2023-01-01", end: "2023-04-15", label: "Atmospheric-river winter" },
    { start: "2024-07-01", end: "2024-10-31", label: "Late-season dryness" },
  ];

  // ---------------------------------------------------------------- state
 const state = {
    records: [],
    filtered: [],
    mode: "compare",
    season: "all",
    year: "all",
    region: "all",
    measure: "greenness",
    layer: "terra-truecolor",
    idx: 0,
    idxB: 4,
    brushRange: null,      // [Date, Date] or null
    overlay: false,
    rects: false,
    lens: true,
  };

  // resolve the file path for a record at the current (or fallback) layer
  function fileFor(rec, slot = null) {
    if (!rec) return null;
    if (rec.layers) {
      const want = (slot === "b") ? state.layerB || state.layer : state.layer;
      const entry = rec.layers[want] || rec.layers[rec.primary_layer] || Object.values(rec.layers)[0];
      return entry?.file || rec.file;
    }
    return rec.file;
  }
  function layerLabelFor(rec) {
    if (!rec?.layers) return "Terra (true color)";
    return rec.layers[state.layer]?.label || rec.layers[rec.primary_layer]?.label || "Terra (true color)";
  }

  // rAF-throttle helper — ensures we don't redraw faster than the screen
  function rafThrottle(fn) {
    let scheduled = false, lastArgs = null;
    return (...args) => {
      lastArgs = args;
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        fn(...lastArgs);
      });
    };
  }

  // AbortController-managed image loader, so rapid scrubs don't pile up
  const imageLoadCtrls = new Map(); // slot -> AbortController

  // image cache for the lens (so we can sample pixels without re-decoding)
  const imageBitmaps = new Map();   // path -> ImageBitmap
  // single OffscreenCanvas (reused) for sampling — avoids GC churn while dragging
  let sampleCanvas = null, sampleCtx = null;

  const el = (id) => document.getElementById(id);

  // ---------------------------------------------------------------- boot
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    if (typeof d3 === "undefined") {
      // d3 still loading (defer race) — wait one tick
      await new Promise(r => setTimeout(r, 0));
    }
    let manifest;
    try {
      const res = await fetch("data/manifest.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(res.statusText);
      manifest = await res.json();
    } catch (err) {
      showError(`Could not load <code>data/manifest.json</code>. Run <code>python3 artifacts/data_explorer.py</code>.`);
      return;
    }

    state.records = manifest.slice().sort((a, b) => a.date.localeCompare(b.date));
    buildYearChips();
    wireControls();
    applyFilters();
    state.idx = 0;
    state.idxB = Math.min(state.filtered.length - 1, 4);
    buildGridView();
    renderLegend();
    renderAll();
    drawChart();
    drawHeatmap();
    // pre-decode images for the lens — every layer file we know about
    state.records.forEach(r => {
      preloadImage(r.file);
      if (r.layers) Object.values(r.layers).forEach(l => preloadImage(l.file));
    });
  }

  // ---------------------------------------------------------------- chips & controls
  function buildYearChips() {
    const years = Array.from(new Set(state.records.map(r => r.year))).sort();
    const host = el("year-chips");
    years.forEach(y => {
      const b = document.createElement("button");
      b.className = "chip";
      b.dataset.year = String(y);
      b.textContent = y;
      host.appendChild(b);
    });
  }

  function wireControls() {
    document.querySelector(".seg").addEventListener("click", e => {
      const b = e.target.closest("button[data-mode]"); if (!b) return;
      document.querySelectorAll(".seg button").forEach(x => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-pressed", x === b);
      });
      state.mode = b.dataset.mode;
      el("stage").dataset.mode = state.mode;
      if (state.mode === "compare") setupCompareDefault();
      renderAll();
    });

    bindChipGroup("region-chips", "region", () => { drawChart(); updateDetails(); });
    bindChipGroup("measure-chips", "measure", () => { drawChart(); updateDetails(); });
    bindChipGroup("season-chips", "season", () => { applyFilters(); renderAll(); drawChart(); });
    bindChipGroup("year-chips",   "year",   () => { applyFilters(); renderAll(); drawChart(); });
    // layer chip group is rebuilt each render — bind via delegation
    el("layer-chips").addEventListener("click", e => {
      const b = e.target.closest("button.chip"); if (!b) return;
      state.layer = b.dataset.layer;
      el("layer-chips").querySelectorAll("button.chip").forEach(x => x.classList.toggle("active", x === b));
      renderAll();
    });

    const onSlide = rafThrottle(() => {
      state.idx = +el("date-slider").value;
      renderAll(); drawChart();
    });
    el("date-slider").addEventListener("input", onSlide, { passive: true });

    document.addEventListener("keydown", e => {
      if (!state.filtered.length) return;
      if (e.target.tagName === "INPUT" && e.target.type === "range") return; // slider has its own
      if (e.key === "ArrowLeft" && state.idx > 0)  { state.idx--; el("date-slider").value = state.idx; renderAll(); drawChart(); }
      if (e.key === "ArrowRight" && state.idx < state.filtered.length - 1) { state.idx++; el("date-slider").value = state.idx; renderAll(); drawChart(); }
    });

    el("pick-a").addEventListener("change", e => { state.idx  = +e.target.value; el("date-slider").value = state.idx; renderAll(); drawChart(); });
    el("pick-b").addEventListener("change", e => { state.idxB = +e.target.value; renderAll(); });

    el("t-overlay").addEventListener("change", e => { state.overlay = e.target.checked; el("overlay-legend").hidden = !state.overlay; renderOverlay("a"); renderOverlay("b"); });
    el("t-rects").addEventListener("change",   e => { state.rects   = e.target.checked; renderRects("a"); renderRects("b"); });
    el("t-lens").addEventListener("change",    e => { state.lens    = e.target.checked; if (!state.lens) { el("lens-a").hidden = true; el("lens-b").hidden = true; } });

    // lens behavior on each frame
    setupLens("a"); setupLens("b");

    el("brush-clear").addEventListener("click", () => { state.brushRange = null; drawChart(); buildGridView(); });
  }

  function bindChipGroup(hostId, key, after) {
    el(hostId).addEventListener("click", e => {
      const b = e.target.closest("button.chip"); if (!b) return;
      const k = `data-${key}`;
      const val = b.getAttribute(k);
      if (val == null) return;
      document.querySelectorAll(`#${hostId} .chip`).forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      state[key] = val;
      if (typeof after === "function") after();
    });
  }

  // ---------------------------------------------------------------- filtering
  function applyFilters() {
    state.filtered = state.records.filter(r =>
      (state.season === "all" || r.season === state.season) &&
      (state.year   === "all" || String(r.year) === state.year)
    );
    if (!state.filtered.length) state.filtered = state.records.slice();
    state.idx  = Math.min(state.idx,  state.filtered.length - 1);
    state.idxB = Math.min(state.idxB, state.filtered.length - 1);
    if (state.idxB === state.idx && state.filtered.length > 1)
      state.idxB = (state.idx + 1) % state.filtered.length;

    const sl = el("date-slider");
    sl.min = 0; sl.max = Math.max(0, state.filtered.length - 1); sl.value = state.idx;
    fillPicker(el("pick-a"), state.idx);
    fillPicker(el("pick-b"), state.idxB);
  }

  function fillPicker(sel, selected) {
    sel.innerHTML = "";
    state.filtered.forEach((r, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `${r.date} · ${cap(r.season)}`;
      if (i === selected) o.selected = true;
      sel.appendChild(o);
    });
  }

  function setupCompareDefault() {
    if (state.filtered.length < 2) return;
    const cur = state.filtered[state.idx];
    const sameSeason = state.filtered.map((r, i) => ({ r, i })).filter(x => x.r.season === cur.season && x.i !== state.idx);
    state.idxB = sameSeason.length
      ? sameSeason[sameSeason.length - 1].i
      : (state.idx + 1) % state.filtered.length;
  }

  // ---------------------------------------------------------------- rendering
  function renderAll() {
    if (!state.filtered.length) return;
    const a = state.filtered[state.idx];
    const b = state.filtered[state.idxB] || a;

    swapImage("a", a, "Left: " + altFor(a));
    if (state.mode === "compare") swapImage("b", b, "Right: " + altFor(b));

    // Refresh the layer chip group based on what's available for the active date
    renderLayerChips(a);

    el("date-readout").textContent = `${cap(a.season)} ${a.year} · ${a.date}`;
    el("tag-a").textContent = `${cap(a.season)} ${a.year}`;
    el("tag-b").textContent = `${cap(b.season)} ${b.year}`;
    el("ovl-date-a").textContent = a.date;
    el("ovl-date-b").textContent = b.date;
    el("pick-a").value = String(state.idx);
    el("pick-b").value = String(state.idxB);

    updateDetails();
    if (state.mode === "grid") buildGridView();
  }

  function altFor(r) { return `MODIS Terra true-color image of California, ${r.date}`; }

  function swapImage(slot, rec, alt) {
    const img = el(`img-${slot}`);
    const target = fileFor(rec, slot);
    if (img.dataset.src === target) return;

    // Cancel any in-flight load on this slot — prevents stale loads
    // from racing the latest one when the user scrubs fast.
    if (imageLoadCtrls.has(slot)) {
      try { imageLoadCtrls.get(slot).abort(); } catch (_) {}
    }
    const ctrl = new AbortController();
    imageLoadCtrls.set(slot, ctrl);

    img.style.opacity = "0";
    const tmp = new Image();
    const onAbort = () => { tmp.src = ""; };
    ctrl.signal.addEventListener("abort", onAbort, { once: true });

    tmp.onload = () => {
      if (ctrl.signal.aborted) return;
      img.src = target;
      img.alt = alt;
      img.dataset.src = target;
      requestAnimationFrame(() => {
        img.style.opacity = "1";
        renderOverlay(slot);
        renderRects(slot);
      });
    };
    tmp.onerror = () => {
      if (ctrl.signal.aborted) return;
      img.alt = `Image not found: ${target}`;
      img.style.opacity = "1";
    };
    tmp.src = target;
  }

  function updateDetails() {
    if (!state.filtered.length) return;
    const a = state.filtered[state.idx];
    const reg = state.region;
    const stats = reg === "all" ? a.all : a.regions[reg];
    if (!stats) return;
    el("d-date").textContent   = a.date;
    el("d-season").textContent = cap(a.season);
    el("d-year").textContent   = a.year;
    el("d-region").textContent = REGION_LABEL[reg];
    el("dt-measure").innerHTML = `${cap(state.measure)} <em>(proxy)</em>`;
    const v = stats[state.measure];
    el("d-measure").textContent = state.measure === "brightness"
      ? v.toFixed(1)
      : ((v >= 0 ? "+" : "") + v.toFixed(4));
    el("d-cloud").textContent = (a.cloud_cover != null) ? (a.cloud_cover * 100).toFixed(1) + "%" : "—";
    el("d-layer").textContent = layerLabelFor(a);
    el("caption").textContent = CAPTIONS[`${a.year}-${a.season}`] || "";
  }

  // ---------------------------------------------------------------- layer chips
  function renderLayerChips(rec) {
    const host = el("layer-chips");
    if (!host || !rec || !rec.layers) return;
    const available = Object.keys(rec.layers);
    // Make sure state.layer is valid for this date
    if (!available.includes(state.layer)) state.layer = rec.primary_layer || available[0];
    // (Re)build the chips to match the active date's available layers
    const existing = Array.from(host.querySelectorAll("button.chip"));
    const wantSet  = new Set(available);
    existing.forEach(b => { if (!wantSet.has(b.dataset.layer)) b.remove(); });
    const have = new Set(existing.map(b => b.dataset.layer));
    available.forEach(lid => {
      if (have.has(lid)) return;
      const b = document.createElement("button");
      b.className = "chip";
      b.dataset.layer = lid;
      b.textContent = SHORT_LAYER_NAME[lid] || lid;
      b.title = rec.layers[lid].label;
      host.appendChild(b);
    });
    // active state
    host.querySelectorAll("button.chip").forEach(b => b.classList.toggle("active", b.dataset.layer === state.layer));
  }
  const SHORT_LAYER_NAME = {
    "terra-truecolor": "Terra true",
    "aqua-truecolor":  "Aqua true",
    "terra-bands721":  "Bands 7-2-1",
  };

  // ---------------------------------------------------------------- legend
  function renderLegend() {
    const bar = el("legend-bar");
    bar.innerHTML = "";
    OVERLAY_BINS.forEach(b => {
      const d = document.createElement("div");
      d.style.background = b.color;
      bar.appendChild(d);
    });
  }

  // ---------------------------------------------------------------- canvas overlay (binned greenness)
  function renderOverlay(slot) {
    const canv = el(`ovl-${slot}`);
    const holder = el(`hold-${slot}`);
    if (!canv || !holder) return;
    const rec = slot === "a" ? state.filtered[state.idx] : state.filtered[state.idxB];
    if (!rec || !rec.greenness_grid) return;
    const w = holder.clientWidth, h = holder.clientHeight;
    if (w === 0 || h === 0) return;
    canv.width = w; canv.height = h;
    const ctx = canv.getContext("2d");
    const gw = rec.grid_w, gh = rec.grid_h;
    const cellW = w / gw, cellH = h / gh;
    ctx.clearRect(0, 0, w, h);
    if (!state.overlay) { canv.classList.remove("show"); return; }
    canv.classList.add("show");
    const grid = rec.greenness_grid;
    for (let j = 0; j < gh; j++) {
      const row = grid[j];
      for (let i = 0; i < gw; i++) {
        ctx.fillStyle = overlayColorOf(row[i]);
        ctx.fillRect(i * cellW, j * cellH, cellW + 0.5, cellH + 0.5);
      }
    }
  }

  // ---------------------------------------------------------------- region rectangles
  function renderRects(slot) {
    const svg = el(`rect-${slot}`);
    svg.innerHTML = "";
    if (!state.rects) { svg.classList.remove("show"); return; }
    svg.classList.add("show");
    const rec = slot === "a" ? state.filtered[state.idx] : state.filtered[state.idxB];
    if (!rec) return;
    // Each region rectangle is in image-pixel space; convert to viewBox %.
    const W = rec.width, H = rec.height;
    Object.entries(rec.regions).forEach(([name, info]) => {
      const [x0, y0, x1, y1] = info.px;
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("class", `region ${name}`);
      r.setAttribute("x", x0 / W * 100);
      r.setAttribute("y", y0 / H * 100);
      r.setAttribute("width",  (x1 - x0) / W * 100);
      r.setAttribute("height", (y1 - y0) / H * 100);
      svg.appendChild(r);
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", (x0 / W * 100) + 0.6);
      t.setAttribute("y", (y0 / H * 100) + 4);
      t.textContent = REGION_LABEL[name];
      svg.appendChild(t);
    });
  }

  // ---------------------------------------------------------------- lens (magnifier)
  function setupLens(slot) {
    const holder = el(`hold-${slot}`);
    const lens = el(`lens-${slot}`);
    const lensCanv = el(`lens-canvas-${slot}`);
    if (!holder || !lens) return;
    const ZOOM = 4;

    holder.addEventListener("mousemove", (ev) => {
      if (!state.lens) return;
      const rec = slot === "a" ? state.filtered[state.idx] : state.filtered[state.idxB];
      if (!rec) return;
      const path = fileFor(rec, slot);
      const bm = imageBitmaps.get(path); if (!bm) return;
      const rect = holder.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      lens.hidden = false;
      const lw = lens.offsetWidth || 140, lh = lens.offsetHeight || 140;
      lens.style.left = (x - lw/2) + "px";
      lens.style.top  = (y - lh/2) + "px";
      // sample from underlying bitmap at (x/rect.w, y/rect.h)
      lensCanv.width = lw; lensCanv.height = lh;
      const ctx = lensCanv.getContext("2d");
      const sx = (x / rect.width)  * bm.width;
      const sy = (y / rect.height) * bm.height;
      const sw = bm.width  / ZOOM;
      const sh = bm.height / ZOOM;
      ctx.clearRect(0, 0, lw, lh);
      ctx.drawImage(bm, sx - sw/2, sy - sh/2, sw, sh, 0, 0, lw, lh);
    });
    holder.addEventListener("mouseleave", () => { lens.hidden = true; });

    holder.addEventListener("click", () => {
      // click → toggle region cycle: cycles through region chip selection
      const order = ["all", "sierra", "valley", "socal"];
      const ix = order.indexOf(state.region);
      state.region = order[(ix + 1) % order.length];
      document.querySelectorAll("#region-chips .chip").forEach(c =>
        c.classList.toggle("active", c.dataset.region === state.region));
      drawChart(); updateDetails();
    });
  }

  function preloadImage(path) {
    if (imageBitmaps.has(path)) return;
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.src = path;
    im.onload = async () => {
      try {
        const bm = await createImageBitmap(im);
        imageBitmaps.set(path, bm);
      } catch (e) { /* ignore — lens just won't show */ }
    };
  }

  // ---------------------------------------------------------------- grid view
  function buildGridView() {
    const host = el("grid-view");
    host.innerHTML = "";
    const inBrush = (r) => {
      if (!state.brushRange) return true;
      const t = +new Date(r.date);
      return t >= +state.brushRange[0] && t <= +state.brushRange[1];
    };
    state.records.forEach((r, i) => {
      const cell = document.createElement("div");
      cell.className = "gv-cell" + (inBrush(r) ? "" : " dim") + (state.filtered[state.idx]?.file === r.file ? " active" : "");
      cell.innerHTML = `
        <img src="${r.file}" alt="${altFor(r)}" loading="lazy">
        <div class="gv-tag">${r.date} · ${cap(r.season)}</div>
      `;
      cell.addEventListener("click", () => {
        // jump slider to this record (after re-applying filters to "all")
        const fIdx = state.filtered.findIndex(x => x.file === r.file);
        if (fIdx >= 0) {
          state.idx = fIdx;
          el("date-slider").value = fIdx;
          state.mode = "single";
          el("stage").dataset.mode = "single";
          document.querySelectorAll(".seg button").forEach(x => x.classList.toggle("active", x.dataset.mode === "single"));
          renderAll(); drawChart(); drawHeatmap();
        }
      });
      host.appendChild(cell);
    });
  }

  // ---------------------------------------------------------------- D3 chart
  // Action-title generator: states the takeaway for the current view (SWD #4).
  function chartHeadline() {
    const m = state.measure, r = state.region;
    if (m === "greenness") {
      if (r === "sierra")  return "Sierra Nevada was visibly greener in Jan 2023 (wet) than Jan 2024 (dry)";
      if (r === "valley")  return "Central Valley peaks at +0.020 in spring 2024 — the greenest single image in the set";
      if (r === "socal")   return "Southern California stays brown year-round; no positive greenness on any date";
      return "California's greenness flips sign by season — positive in winter/spring, negative in summer/autumn";
    }
    if (m === "brown") {
      if (r === "all") return "Brown proxy spikes statewide in summer; Central Valley dries hardest";
      return `${REGION_LABEL[r]} — brown proxy peaks in summer/autumn`;
    }
    return "Image brightness varies with cloud cover and snow more than vegetation";
  }

  function drawChart() {
    const svg = d3.select("#d3-chart");
    svg.selectAll("*").remove();
    // Dynamic action headline (SWD #4)
    const headlineEl = el("chart-headline");
    if (headlineEl) headlineEl.textContent = chartHeadline();

    // Smaller right margin — labels moved to a top legend strip instead
    // of a stacked column in the right margin. Less clutter, more chart.
    const W = 960, H = 380, M = { top: 60, right: 28, bottom: 44, left: 64 };
    const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    // X — date
    const ts = state.records.map(r => +new Date(r.date));
    const x = d3.scaleTime()
      .domain([d3.min(ts) - 1000*60*60*24*5, d3.max(ts) + 1000*60*60*24*5])
      .range([0, iw]);

    // Y — measure-dependent
    const measure = state.measure;
    const valueOf = (r, region) => {
      const stats = region === "all" ? r.all : r.regions[region];
      return stats ? stats[measure] : null;
    };
    const allValues = [];
    state.records.forEach(r => REGIONS.forEach(reg => {
      const v = valueOf(r, reg); if (v != null) allValues.push(v);
    }));
    const yMin = d3.min(allValues), yMax = d3.max(allValues);
    const pad = (yMax - yMin) * 0.18;
    const y = d3.scaleLinear()
      .domain([yMin - pad, yMax + pad])
      .range([ih, 0])
      .nice();

    // Annotations are drawn as MARKER ticks at the top of the chart instead
    // of full-height bands. Labels appear only on hover (in the tooltip).
    // This frees the data area entirely.
    ANNOTATIONS.forEach(a => {
      const x0 = x(new Date(a.start)), x1 = x(new Date(a.end));
      g.append("rect").attr("class","annot-tick")
        .attr("x", Math.min(x0, x1)).attr("y", -8)
        .attr("width", Math.abs(x1 - x0)).attr("height", 4)
        .append("title").text(a.label);
    });

    // gridlines (SWD #2 — light gray y-axis only)
    g.append("g").attr("class","grid")
      .call(d3.axisLeft(y).tickSize(-iw).tickFormat("").ticks(5))
      .selectAll("path").remove();

    // Zero reference line — quiet 0.5px ink at 35% opacity. No caption;
    // the y-axis tick "0.000" is enough to identify it.
    if (measure !== "brightness" && yMin < 0 && yMax > 0) {
      g.append("line").attr("class","zero-line")
        .attr("x1", 0).attr("x2", iw)
        .attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "#1A1A17").attr("stroke-width", 0.5).attr("opacity", 0.35);
    }

    // axes — tickPadding pulls labels off the axis line for breathing room
    g.append("g").attr("class","axis")
      .attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.timeFormat("%b %Y")).tickPadding(8));
    const yFormat = measure === "brightness" ? d3.format(".0f") : d3.format("+.3f");
    g.append("g").attr("class","axis")
      .call(d3.axisLeft(y).ticks(6).tickFormat(yFormat).tickPadding(8));

    // No inline axis caption. The card title and the chart-foot already
    // explain what's on the y-axis; duplicating it here was clutter.

    // Lines per region (only those visible per region filter)
    const visibleRegions = state.region === "all"
      ? REGIONS                       // when "Statewide" is selected, show all 4 lines
      : ["all", state.region];        // else show statewide + the focal region

    const line = d3.line()
      .x(d => x(new Date(d.date)))
      .y(d => y(valueOf(d, d._region)))
      .defined(d => valueOf(d, d._region) != null);

    // Horizontal legend strip ABOVE the chart — replaces the stacked
    // right-margin labels that used to fight with the data lines.
    const legend = g.append("g").attr("class","legend").attr("transform", `translate(0, ${-40})`);
    let cursor = 0;
    visibleRegions.forEach(reg => {
      const isFocus = state.region !== "all" && reg === state.region;
      const isDimmed = state.region !== "all" && reg === "all";
      const color = isDimmed ? "#9A9890" : REGION_COLOR[reg];
      const grp = legend.append("g")
        .attr("class","legend-item")
        .attr("transform", `translate(${cursor},0)`)
        .style("cursor","pointer")
        .on("click", () => {
          state.region = reg;
          document.querySelectorAll("#region-chips .chip").forEach(c =>
            c.classList.toggle("active", c.dataset.region === reg));
          drawChart(); updateDetails();
        });
      grp.append("line")
        .attr("x1", 0).attr("x2", 18)
        .attr("y1", 0).attr("y2", 0)
        .attr("stroke", color)
        .attr("stroke-width", isFocus ? 3.4 : 2.4)
        .attr("stroke-linecap","round");
      grp.append("circle").attr("cx", 9).attr("cy", 0).attr("r", 3.5).attr("fill", color);
      const text = grp.append("text")
        .attr("x", 26).attr("y", 4)
        .attr("class","legend-text")
        .attr("fill", color)
        .attr("font-weight", isFocus ? 700 : 600)
        .text(REGION_LABEL[reg]);
      // approximate width — measured after append
      const bbox = text.node().getBBox();
      cursor += 26 + bbox.width + 22;
    });

    // Draw the lines themselves.
    visibleRegions.forEach(reg => {
      const data = state.records.map(r => ({...r, _region: reg }));
      const isFocus = state.region !== "all" && reg === state.region;
      const isStatewide = reg === "all";
      const isDimmed = state.region !== "all" && reg === "all";
      g.append("path")
        .datum(data)
        .attr("class", "series")
        .attr("d", line)
        .attr("stroke", isDimmed ? "#C7C5BD" : REGION_COLOR[reg])
        .attr("stroke-width", isFocus ? 3.4 : (isStatewide ? 2.0 : 2.6))
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");
    });

    // dots — every (record × region) pair
    const tip = d3.select("#tt");
    const activeFile = state.filtered[state.idx]?.file;
    visibleRegions.forEach(reg => {
      // White halo first — ensures dots remain visible when lines cross them
      g.selectAll(`.halo-${reg}`).data(state.records).enter().append("circle")
        .attr("class", "halo")
        .attr("cx", d => x(new Date(d.date)))
        .attr("cy", d => {
          const v = valueOf(d, reg);
          return v == null ? -100 : y(v);
        })
        .attr("r", 8.5)
        .attr("fill", "#F7F6F2")
        .attr("pointer-events", "none");

      g.selectAll(`.dot-${reg}`).data(state.records).enter().append("circle")
        .attr("class", d => "dot dot-" + reg + (d.file === activeFile && reg === (state.region === "all" ? "all" : state.region) ? " active" : ""))
        .attr("cx", d => x(new Date(d.date)))
        .attr("cy", d => {
          const v = valueOf(d, reg);
          return v == null ? -100 : y(v);
        })
        .attr("r", 6.5)
        .attr("fill", REGION_COLOR[reg])
        .attr("stroke", "white")
        .attr("stroke-width", 1.4)
        .on("mousemove", function(ev, d) {
          const v = valueOf(d, reg);
          tip.style("left", (ev.clientX + 14) + "px")
             .style("top",  (ev.clientY + 14) + "px")
             .html(`
               <div class="tt-row"><strong>${d.date}</strong><span>${cap(d.season)} ${d.year}</span></div>
               <div class="tt-row"><span><span class="swatch" style="background:${REGION_COLOR[reg]}"></span>${REGION_LABEL[reg]}</span><strong>${measure === "brightness" ? v.toFixed(1) : (v >= 0 ? "+" : "") + v.toFixed(4)}</strong></div>
               <div class="tt-row"><em style="color:#6B6962">click to scrub</em><span></span></div>
             `)
             .attr("hidden", null);
        })
        .on("mouseleave", () => tip.attr("hidden", true))
        .on("click", function(_, d) {
          const fIdx = state.filtered.findIndex(x => x.file === d.file);
          if (fIdx >= 0) {
            state.idx = fIdx;
            el("date-slider").value = fIdx;
            renderAll(); drawChart();
          }
        });
    });

    // No vertical scrub line — the active dot's larger radius + ink stroke
    // already marks the current date without adding a vertical band.

    // brush
    const brush = d3.brushX()
      .extent([[0, 0], [iw, ih]])
      .on("end", brushed);
    const brushG = g.append("g").attr("class", "brush").call(brush);
    if (state.brushRange) {
      brushG.call(brush.move, [x(state.brushRange[0]), x(state.brushRange[1])]);
    }
    function brushed(ev) {
      if (!ev.selection) { state.brushRange = null; buildGridView(); return; }
      const [a, b] = ev.selection;
      state.brushRange = [x.invert(a), x.invert(b)];
      buildGridView();
    }
  }
  
  // Heatmap Tooltip Insight Generator — produces the text for the tooltip when 
  // hovering heatmap cells in the grid view. Provides context on how the hovered 
  // cell's value compares to other dates in the same region, and how it has 
  // changed from the previous date.
  function heatmapInsight(cell) {
    const regionRecords = state.records.map(r => {
      const stats = cell.region === "all" ? r.all : r.regions[cell.region];
      return {
        date: r.date,
        value: stats.greenness
      };
    });

    const values = regionRecords.map(d => d.value);
    const avg = d3.mean(values);
    const max = d3.max(values);
    const min = d3.min(values);

    const idx = regionRecords.findIndex(d => d.date === cell.date);
    const prev = idx > 0 ? regionRecords[idx - 1] : null;
    const change = prev ? cell.value - prev.value : null;

    let rankText = "moderate vegetation conditions";

    if (cell.value > avg + 0.01)
      rankText = `relatively green conditions in ${REGION_LABEL[cell.region]}`;

    if (cell.value < avg - 0.01)
      rankText = `relatively dry conditions in ${REGION_LABEL[cell.region]}`;

    if (cell.value === max)
      rankText = `greenest conditions in ${REGION_LABEL[cell.region]}`;

    if (cell.value === min)
      rankText = `driest conditions in ${REGION_LABEL[cell.region]}`;

    
    const avgText = cell.value >= avg
      ? `${(cell.value - avg).toFixed(4)} above this region's average`
      : `${(avg - cell.value).toFixed(4)} below this region's average`;

    const changeText = change == null
      ? "no previous date to compare"
      : `${change >= 0 ? "+" : ""}${change.toFixed(4)} from previous date`;

    return { rankText, avgText, changeText };
}

  // Heatmap rendering function — draws the heatmap in the grid view, 
  // showing the "greenness" measure for each date and region. 
  // Each cell's color is determined by its value relative to the range of 
  // values for that region, with a tooltip providing insights on how that 
  // value compares to other dates in the same region and how it has changed 
  // from the previous date.

  function drawHeatmap() {

    const svg = d3.select("#heatmap");

    if (svg.empty()) return;

    svg.selectAll("*").remove();

    const margin = { top: 40, right: 20, bottom: 70, left: 130 };

    const width = 960 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const regions = REGIONS;

    const dates = state.records.map(d => d.date);

    const x = d3.scaleBand()
      .domain(dates)
      .range([0, width])
      .padding(0.05);

    const y = d3.scaleBand()
      .domain(regions)
      .range([0, height])
      .padding(0.05);

    const values = [];

    state.records.forEach(r => {
      regions.forEach(reg => {                    

        const stats = reg === "all"
          ? r.all
          : r.regions[reg];

        if (stats) {
          values.push(stats.greenness);
        }

      });
    });

    const color = d3.scaleLinear()
      .domain([
        d3.min(values),
        0,
        d3.max(values)
      ])
      .range([
        "#7B3F00",  // brown = dry / negative
        "#F3E8C8",  // neutral = near zero
        "#064E3B"   // dark green = greener / positive
      ]);

    const cells = [];

    state.records.forEach(r => {
      regions.forEach(reg => {

        cells.push({
          date: r.date,
          region: reg,
          value: (
            reg === "all"
              ? r.all.greenness
              : r.regions[reg].greenness
          )
        });

      });
    });

    g.selectAll("rect")
    .data(cells)
    .enter()
    .append("rect")
    .attr("x", d => x(d.date))
    .attr("y", d => y(d.region))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 4)
    .attr("fill", d => color(d.value))
    .style("cursor", "pointer")

    .on("mousemove", function(ev, d) {

      const insight = heatmapInsight(d);

      d3.select(this)
        .attr("stroke", "#1A1A17")
        .attr("stroke-width", 2);

      d3.select("#tt")
        .style("left", (ev.clientX + 14) + "px")
        .style("top", (ev.clientY + 14) + "px")
        .html(`
          <div><strong>${REGION_LABEL[d.region]}</strong></div>

          <div>
            ${d3.timeFormat("%b %Y")(new Date(d.date + "T00:00:00"))}
          </div>

          <hr style="border:0;border-top:1px solid rgba(255,255,255,0.25);margin:6px 0;">

          <div class="tt-row">
            <span>Greenness</span>
            <strong>${d.value >= 0 ? "+" : ""}${d.value.toFixed(4)}</strong>
          </div>

          <div class="tt-row">
            <span>Region rank</span>
            <strong>${insight.rankText}</strong>
          </div>

          <div class="tt-row">
            <span>Vs. region avg</span>
            <strong>${insight.avgText}</strong>
          </div>

          <div class="tt-row">
            <span>Change from previous</span>
            <strong>${insight.changeText}</strong>
          </div>

          <div style="margin-top:6px;opacity:0.8;">
            Click to jump to this image and region.
          </div>
        `)
        .attr("hidden", null);
    })

    .on("mouseleave", function() {

      d3.select(this)
        .attr("stroke", null)
        .attr("stroke-width", null);

      d3.select("#tt")
        .attr("hidden", true);
    })

    .on("click", function(ev, d) {

      const fIdx = state.filtered.findIndex(r => r.date === d.date);

      if (fIdx >= 0) {

        state.idx = fIdx;
        state.region = d.region;

        el("date-slider").value = fIdx;

        document.querySelectorAll("#region-chips .chip").forEach(c =>
          c.classList.toggle("active", c.dataset.region === d.region)
        );

        renderAll();
        drawChart();
        drawHeatmap();
        document.querySelector(".stage-row").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      }
    });

    g.append("g")
      .call(
        d3.axisLeft(y)
          .tickFormat(r => REGION_LABEL[r])
      );

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3.axisBottom(x)
          .tickFormat(d =>
            d3.timeFormat("%b %Y")(new Date(d))
          )
      )
      .selectAll("text")
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end");
  }
  // ---------------------------------------------------------------- helpers
  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

  function showError(html) {
    document.querySelectorAll(".controls, .stage-row, .chart-card").forEach(n => n.remove());
    const main = document.querySelector("main.wrap");
    const box = document.createElement("section");
    box.className = "writeup";
    box.innerHTML = `<h2>Imagery not loaded yet</h2><p>${html}</p>`;
    main.prepend(box);
  }
})();
