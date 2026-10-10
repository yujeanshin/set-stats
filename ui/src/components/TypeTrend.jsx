// The Set types trend (brief-v3 item 8): the 4 n_diff groups over the
// page's games, in buckets of equal numbers of games, oldest to newest.
// The toggle switches the y axis between the Ratio (log scale, with its 95%
// interval as a band and a line at 1.0) and the median find time. Points
// are evenly spaced; each line is labelled at its end and has its own
// marker shape, so the lines don't depend on color. The chart is one tab
// stop: the arrow keys step through the points, showing the tooltip and
// reading it out.
import {
  Alert,
  Box,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import { useApi } from "../api.js";
import { nDiffLabel } from "../cardFace.js";
import "../chart.js";
import { countText, intervalText, ratioText, secs } from "../format.js";
import theme, { colors } from "../theme.js";

// Short names for the line ends; the legend and tooltip use nDiffLabel.
const END_LABELS = ["1 differs", "2 differ", "3 differ", "All 4"];

// A marker shape per line, so the lines differ without color.
const SHAPES = ["circle", "triangle", "rect", "rectRot"];

// Room on the right for the end labels.
const END_PAD = 64;

/** "#2a78d6" at 12% opacity, for the interval bands. */
const tint = (hex, alpha = 0.12) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/** A point's x label: its last game's day, with the year over long spans. */
function dayLabel(ms, withYear) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: withYear ? undefined : "numeric",
    year: withYear ? "numeric" : undefined,
  });
}

/** "Mar 3 to Apr 9, 2025", a bucket's first and last game's days. */
function spanLabel({ from, to }) {
  const day = (ms) =>
    new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });
  return day(from) === day(to) ? day(from) : `${day(from)} to ${day(to)}`;
}

/**
 * One group's tooltip lines at one point, for the selected view: the name
 * and the headline number, then the counts behind it, so a line fits in
 * the tooltip at phone width.
 */
function rowLines(row, view) {
  const name = END_LABELS[row.key - 1];
  if (view === "time")
    return row.medianMs == null
      ? [`${name}: no finds`]
      : [
          `${name}: median ${secs(row.medianMs)} s`,
          `  n ${countText(row.medianN)}`,
        ];
  if (row.ratio == null) return [`${name}: never on the board`];
  return [
    `${name}: ratio ${ratioText(row.ratio)}`,
    `  95% ${intervalText(row.low, row.high)}`,
    `  picked ${countText(row.picks)}, expected ${countText(row.expected)}`,
  ];
}

/** The whole point as one sentence for the live region. */
function pointText(point, view) {
  const rows = point.nDiff.map((r) =>
    rowLines(r, view)
      .map((l) => l.trim())
      .join(", "),
  );
  return [spanTitle(point), ...rows].join(". ");
}

/** The tooltip title: the bucket's days and size. */
const spanTitle = (point) =>
  `${spanLabel(point)} · ${countText(point.games)} games`;

/** The value a group's line plots at one point. */
const yOf = (row, view) =>
  view === "time"
    ? row.medianMs == null
      ? null
      : row.medianMs / 1000
    : row.ratio || null; // a ratio of 0 has no place on a log scale

// Ratio ticks to choose from: symmetric around 1 on the log scale.
const RATIO_TICKS = [
  0.25,
  1 / 3,
  0.5,
  2 / 3,
  0.8,
  0.9,
  1,
  1.1,
  1.25,
  1.5,
  2,
  3,
  4,
];

/**
 * Datasets: per group, its band's top and bottom (Ratio only; the top
 * fills down to the bottom) and its line, then the dashed line at 1.0.
 * `line` marks the datasets that answer the tooltip.
 */
function chartData(points, view) {
  const datasets = [];
  for (let i = 0; i < 4; i++) {
    const color = colors.nDiff[i];
    const rows = points.map((p) => p.nDiff[i]);
    if (view === "ratio") {
      const edge = { borderWidth: 0, pointRadius: 0, pointHitRadius: 0 };
      datasets.push(
        {
          ...edge,
          data: rows.map((r) => (r.ratio == null ? null : r.high)),
          fill: "+1",
          backgroundColor: tint(color),
        },
        {
          ...edge,
          data: rows.map((r) => (r.ratio == null ? null : r.low || null)),
        },
      );
    }
    datasets.push({
      line: i,
      label: END_LABELS[i],
      data: rows.map((r) => yOf(r, view)),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointStyle: SHAPES[i],
      pointRadius: 3.5,
      pointHoverRadius: 5,
      pointHitRadius: 8,
    });
  }
  if (view === "ratio")
    datasets.push({
      data: points.map(() => 1),
      borderColor: colors.muted,
      borderWidth: 1,
      borderDash: [4, 4],
      pointRadius: 0,
      pointHitRadius: 0,
    });
  return { labels: points.map((p) => p.to), datasets };
}

/** Log-scale bounds covering every line and band, padded a little. */
function ratioBounds(points) {
  const ys = points.flatMap((p) =>
    p.nDiff.flatMap((r) => (r.ratio ? [r.low || r.ratio, r.high] : [])),
  );
  const lo = Math.min(1, ...ys) / 1.05;
  const hi = Math.max(1, ...ys) * 1.05;
  return { min: lo, max: hi };
}

/**
 * Draws each line's name just right of its last point, nudged apart so
 * the names never overlap.
 */
const endLabels = {
  id: "endLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const labels = [];
    chart.data.datasets.forEach((d, i) => {
      if (d.line == null) return;
      const meta = chart.getDatasetMeta(i);
      const last = meta.data.findLast((pt, j) => d.data[j] != null);
      if (last) labels.push({ y: last.y, x: last.x, d });
    });
    labels.sort((a, b) => a.y - b.y);
    const gap = 15;
    for (let i = 1; i < labels.length; i++)
      labels[i].y = Math.max(labels[i].y, labels[i - 1].y + gap);
    // Shift the stack up if it runs off the bottom.
    const over = (labels.at(-1)?.y ?? 0) - (chart.chartArea.bottom - 4);
    if (over > 0) labels.forEach((l) => (l.y -= over));
    ctx.save();
    ctx.font = `600 12px ${theme.typography.fontFamily}`;
    ctx.textBaseline = "middle";
    for (const { x, y, d } of labels) {
      ctx.fillStyle = colors.text;
      ctx.fillText(d.label, x + 9, y);
    }
    ctx.restore();
  },
};

function LegendSwatch({ i }) {
  const color = colors.nDiff[i];
  const shape = {
    circle: <circle cx="11" cy="6" r="3.5" fill={color} />,
    triangle: <path d="M11 2 L15 9.5 L7 9.5 Z" fill={color} />,
    rect: <rect x="7.5" y="2.5" width="7" height="7" fill={color} />,
    rectRot: <path d="M11 1.5 L15.5 6 L11 10.5 L6.5 6 Z" fill={color} />,
  }[SHAPES[i]];
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
      <line x1="0" x2="22" y1="6" y2="6" stroke={color} strokeWidth="2" />
      {shape}
    </svg>
  );
}

/**
 * The chart itself: a focusable figure. Left and right step through the
 * points, Home and End jump to the ends; the tooltip shows the point and
 * a live region reads it.
 */
function TrendChart({ points, view }) {
  const chartRef = useRef(null);
  const [active, setActive] = useState(null);
  const withYear = points.at(-1).to - points[0].from > 300 * 86_400_000;
  const data = chartData(points, view);

  function show(index) {
    setActive(index);
    const chart = chartRef.current;
    if (!chart) return;
    const els =
      index == null
        ? []
        : chart.data.datasets.flatMap((d, i) =>
            d.line != null && d.data[index] != null
              ? [{ datasetIndex: i, index }]
              : [],
          );
    chart.setActiveElements(els);
    const pt = els[0] && chart.getDatasetMeta(els[0].datasetIndex).data[index];
    chart.tooltip.setActiveElements(els, pt ? { x: pt.x, y: pt.y } : undefined);
    chart.update();
  }

  function onKeyDown(e) {
    const last = points.length - 1;
    const next = {
      ArrowRight: Math.min(last, (active ?? -1) + 1),
      ArrowLeft: Math.max(0, (active ?? last + 1) - 1),
      Home: 0,
      End: last,
    }[e.key];
    if (next == null) return;
    e.preventDefault();
    show(next);
  }

  const options = {
    layout: { padding: { right: END_PAD, top: 6 } },
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          maxRotation: 0,
          autoSkipPadding: 12,
          callback: (v, i) => dayLabel(points[i].to, withYear),
        },
      },
      y:
        view === "ratio"
          ? {
              type: "logarithmic",
              ...ratioBounds(points),
              border: { display: false },
              grid: { drawTicks: false },
              afterBuildTicks(scale) {
                const ticks = RATIO_TICKS.filter(
                  (t) => t >= scale.min && t <= scale.max,
                );
                scale.ticks = (
                  ticks.length >= 2 ? ticks : [scale.min, 1, scale.max]
                ).map((value) => ({ value }));
              },
              ticks: { callback: (v) => ratioText(v) },
            }
          : {
              beginAtZero: true,
              border: { display: false },
              grid: { drawTicks: false },
              ticks: { callback: (v) => `${v}s` },
            },
    },
    plugins: {
      tooltip: {
        filter: (item) => item.dataset.line != null,
        itemSort: (a, b) => a.dataset.line - b.dataset.line,
        displayColors: true,
        usePointStyle: true,
        boxPadding: 4,
        callbacks: {
          title: (items) => spanTitle(points[items[0].dataIndex]),
          label: (item) =>
            rowLines(points[item.dataIndex].nDiff[item.dataset.line], view),
          labelColor: (item) => ({
            borderColor: item.dataset.borderColor,
            backgroundColor: item.dataset.borderColor,
          }),
          labelPointStyle: (item) => ({
            pointStyle: item.dataset.pointStyle,
            rotation: 0,
          }),
        },
      },
    },
  };

  const summary =
    view === "ratio"
      ? "Ratio to chance over time for each group of how many features differ"
      : "Median find time over time for each group of how many features differ";
  return (
    <Box component="figure" sx={{ m: 0, position: "relative" }}>
      <Box
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={`${summary}, ${points.length} points from oldest to newest. Use the left and right arrow keys to read each point.`}
        onKeyDown={onKeyDown}
        onBlur={() => show(null)}
        sx={{
          position: "relative",
          height: 300,
          borderRadius: "6px",
          "&:focus-visible": {
            outline: `2px solid ${colors.accent}`,
            outlineOffset: 2,
          },
        }}
      >
        <Line
          ref={chartRef}
          data={data}
          options={options}
          plugins={[endLabels]}
          fallbackContent={summary}
        />
      </Box>
      <Box aria-live="polite" sx={visuallyHidden}>
        {active == null ? "" : pointText(points[active], view)}
      </Box>
      <Box
        component="figcaption"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2.5,
          mt: 1.25,
          fontSize: 13,
          color: "text.secondary",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            component="span"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
          >
            <LegendSwatch i={i} />
            {nDiffLabel(i + 1)}
          </Box>
        ))}
        {view === "ratio" ? (
          <Box
            component="span"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
          >
            <Box
              aria-hidden="true"
              sx={{ width: 18, height: 10, bgcolor: tint(colors.muted, 0.2) }}
            />
            95% interval
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

// Read by screen readers, not shown. Sizes are strings: in sx, a number up
// to 1 is a fraction of the parent.
const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

/** params: the Set types page's filters and Range, as /types takes them. */
export default function TypeTrend({ params, dropBreaks }) {
  const [view, setView] = useState("ratio"); // "ratio" | "time"
  const res = useApi("/types/trend", params);
  const data = res.data?.needsRebuild ? null : res.data;
  const points = data?.points ?? [];
  return (
    <Paper
      component="section"
      aria-labelledby="type-trend-title"
      sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.5 }}
    >
      <Stack
        direction="row"
        useFlexGap
        spacing={2}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <Typography id="type-trend-title" variant="h2" component="h2">
          Trend
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={view}
          onChange={(e, v) => v && setView(v)}
          aria-label="Measure"
        >
          <ToggleButton value="ratio">Ratio</ToggleButton>
          <ToggleButton value="time">Find time</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Typography variant="caption" component="p">
        {view === "ratio"
          ? "Ratio to chance for each group of how many features differ, on a log scale so 0.5 and 2 are as far from 1.0 (dashed). Bands are 95% intervals."
          : `Median find time of the finds where I took that kind of set${dropBreaks ? ", without breaks" : ""}.`}
      </Typography>
      {res.error ? <Alert severity="error">{res.error.message}</Alert> : null}
      {!data ? (
        <Box sx={{ height: 300 }} aria-busy={res.loading} />
      ) : points.length ? (
        <>
          {/* Keyed by view, so a tooltip left open by the keyboard can't
              show the other view's numbers. */}
          <TrendChart key={view} points={points} view={view} />
          <Typography variant="caption" component="p">
            Each point is {countText(data.size)} games, oldest to newest
            {data.dropped
              ? `; the oldest ${countText(data.dropped)} ${data.dropped === 1 ? "game is" : "games are"} left out, too few for a point.`
              : "."}
          </Typography>
        </>
      ) : (
        <Typography variant="body2">
          A trend needs at least {countText(data.minGames)} games, two points of{" "}
          {countText(data.size)}. This range has {countText(data.games)}.
        </Typography>
      )}
    </Paper>
  );
}
