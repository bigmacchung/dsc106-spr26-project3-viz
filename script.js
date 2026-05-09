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
    filtered: [],          // records visible to slider after season+year
    mode: "single",        // single | compare | grid
    season: "all",
    year: "all",
    region: "all",
    measure: "greenness",
    idx: 0,
    idxB: 0,
    brushRange: null,      // [Date, Date] or null
    overlay: false,
    rects: false,
    lens: true,
  };

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
    // pre-decode images for the lens
    state.records.forEach(r => preloadImage(r.file));
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

    el("date-slider").addEventListener("input", () => {
      state.idx = +el("date-slider").value;
      renderAll(); drawChart();
    });

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
    if (img.dataset.src === rec.file) return;
    img.style.opacity = "0";
    const tmp = new Image();
    tmp.onload = () => {
      img.src = rec.file;
      img.alt = alt;
      img.dataset.src = rec.file;
      requestAnimationFrame(() => {
        img.style.opacity = "1";
        renderOverlay(slot);
        renderRects(slot);
      });
    };
    tmp.onerror = () => { img.alt = `Image not found: ${rec.file}`; img.style.opacity = "1"; };
    tmp.src = rec.file;
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
    el("caption").textContent = CAPTIONS[`${a.year}-${a.season}`] || "";
  }

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
      const bm = imageBitmaps.get(rec.file); if (!bm) return;
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
          renderAll(); drawChart();
        }
      });
      host.appendChild(cell);
    });
  }

  // ---------------------------------------------------------------- D3 chart
  function drawChart() {
    const svg = d3.select("#d3-chart");
    svg.selectAll("*").remove();

    const W = 960, H = 320, M = { top: 30, right: 120, bottom: 36, left: 56 };
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

    // annotations behind grid
    ANNOTATIONS.forEach(a => {
      const x0 = x(new Date(a.start)), x1 = x(new Date(a.end));
      g.append("rect").attr("class","annot-band")
        .attr("x", Math.min(x0, x1)).attr("y", 0)
        .attr("width", Math.abs(x1 - x0)).attr("height", ih);
      g.append("text").attr("class","annot-label")
        .attr("x", (x0 + x1) / 2).attr("y", 12)
        .attr("text-anchor","middle")
        .text(a.label);
    });

    // gridlines
    g.append("g").attr("class","grid")
      .call(d3.axisLeft(y).tickSize(-iw).tickFormat("").ticks(5))
      .selectAll("path").remove();

    // axes
    g.append("g").attr("class","axis")
      .attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d3.timeFormat("%b %Y")));
    const yFormat = measure === "brightness" ? d3.format(".0f") : d3.format("+.3f");
    g.append("g").attr("class","axis")
      .call(d3.axisLeft(y).ticks(5).tickFormat(yFormat));

    // axis labels
    g.append("text").attr("class","axis-title")
      .attr("x", 0).attr("y", -16)
      .text(MEASURE_LABEL[measure]);
    if (measure !== "brightness") {
      g.append("text").attr("class","axis-sub")
        .attr("x", 0).attr("y", -2)
        .text("Image-derived proxy, not official NDVI");
    }

    // Lines per region (only those visible per region filter)
    const visibleRegions = state.region === "all"
      ? REGIONS                       // when "Statewide" is selected, show all 4 lines
      : ["all", state.region];        // else show statewide + the focal region

    const line = d3.line()
      .x(d => x(new Date(d.date)))
      .y(d => y(valueOf(d, d._region)))
      .defined(d => valueOf(d, d._region) != null);

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
        .attr("stroke-width", isFocus ? 2.6 : (isStatewide ? 1.4 : 2));

      // end-of-line label
      const last = data[data.length - 1];
      if (valueOf(last, reg) != null) {
        g.append("text").attr("class","end-label")
          .attr("x", x(new Date(last.date)) + 6)
          .attr("y", y(valueOf(last, reg)) + 3)
          .attr("fill", isDimmed ? "#9A9890" : REGION_COLOR[reg])
          .text(REGION_LABEL[reg])
          .on("click", () => {
            state.region = reg;
            document.querySelectorAll("#region-chips .chip").forEach(c =>
              c.classList.toggle("active", c.dataset.region === reg));
            drawChart(); updateDetails();
          });
      }
    });

    // dots — every (record × region) pair
    const tip = d3.select("#tt");
    const activeFile = state.filtered[state.idx]?.file;
    visibleRegions.forEach(reg => {
      g.selectAll(`.dot-${reg}`).data(state.records).enter().append("circle")
        .attr("class", d => "dot dot-" + reg + (d.file === activeFile && reg === (state.region === "all" ? "all" : state.region) ? " active" : ""))
        .attr("cx", d => x(new Date(d.date)))
        .attr("cy", d => {
          const v = valueOf(d, reg);
          return v == null ? -100 : y(v);
        })
        .attr("r", 5)
        .attr("fill", REGION_COLOR[reg])
        .attr("stroke", "white")
        .attr("stroke-width", 1)
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

    // scrub line at active date
    if (activeFile) {
      const cur = state.records.find(r => r.file === activeFile);
      if (cur) {
        g.append("line").attr("class","scrub-line")
          .attr("x1", x(new Date(cur.date))).attr("x2", x(new Date(cur.date)))
          .attr("y1", 0).attr("y2", ih);
      }
    }

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
