// Over time chart (brief 6.5). One dot per game, the rolling line, a band of
// one standard deviation either side for the mean, and a diamond wherever a
// game set a new best finished time. Importing chart.js registers Chart.js.
import { Box } from "@mui/material";
import { Line } from "react-chartjs-2";
import { useLocation, useNavigate } from "react-router-dom";
import "../chart.js";
import { clock, dateTime, secs } from "../format.js";
import { colors } from "../theme.js";

// Accent #800080 at 12% opacity, as in the mockup.
const BAND = "rgba(128, 0, 128, 0.12)";

// Game dots: lighter than the line so the line still reads with hundreds of
// games on screen.
const DOT = "rgba(192, 138, 192, 0.7)"; // scale[2] #c08ac0

/** Dot radius by how many games are plotted: 5 px for a few, 2.5 for many. */
const dotRadius = (n) => (n <= 150 ? 5 : n <= 600 ? 3.5 : 2.5);

function secsPoint(p, ms) {
  return { x: p.started_at, y: ms == null ? null : ms / 1000 };
}

// One edge of the ± 1 sd band. Clamped at zero: times can't be negative.
const band = (p, sign) =>
  secsPoint(
    p,
    p.rolling?.sd == null
      ? null
      : Math.max(0, p.rolling.avg + sign * p.rolling.sd),
  );

// Tick steps for game time, in seconds, so labels land on whole clock values.
const CLOCK_STEPS = [10, 15, 30, 60, 120, 300, 600];

/**
 * Y range with 8% padding either side, never below zero. For game time,
 * also a clock-friendly tick step giving at most about 7 ticks.
 */
function yBounds(datasets, metric) {
  const ys = datasets.flatMap((d) => d.data.map((pt) => pt.y));
  const defined = ys.filter((y) => y != null);
  if (!defined.length) return {};
  const lo = Math.min(...defined);
  const hi = Math.max(...defined);
  const pad = (hi - lo) * 0.08;
  const bounds = {
    suggestedMin: Math.max(0, lo - pad),
    suggestedMax: hi + pad,
  };
  if (metric !== "time") return { bounds };
  const span = bounds.suggestedMax - bounds.suggestedMin;
  const stepSize = CLOCK_STEPS.find((s) => span / s <= 7) ?? CLOCK_STEPS.at(-1);
  return { bounds, stepSize };
}

/**
 * Datasets for one /series response. Y values are seconds; x is UTC ms.
 * Dataset 0 holds every game and is the only one that answers hover and
 * click. Lower `order` draws on top: band, dots, line, then the record
 * diamonds, which are drawn by their own dataset so the line can't hide them.
 */
function chartData(points, avg) {
  const r = dotRadius(points.length);
  const games = points.map((p) => ({
    ...secsPoint(p, p.value),
    gameId: p.game_id,
    started_at: p.started_at,
    paceMs: p.paceMs,
    durationMs: p.durationMs,
    sets: p.sets,
    record: p.record,
  }));
  const datasets = [
    {
      data: games,
      order: 3,
      showLine: false,
      // Records get no dot here; dataset 1 draws their diamond on top.
      pointRadius: (ctx) => (ctx.raw?.record ? 0 : r),
      pointHoverRadius: (ctx) => (ctx.raw?.record ? 0 : r + 2),
      pointBackgroundColor: DOT,
      pointBorderWidth: 0,
      pointHoverBackgroundColor: colors.accent,
      pointHitRadius: 6,
    },
    {
      data: games.filter((g) => g.record),
      order: 0,
      showLine: false,
      pointStyle: "rectRot",
      pointRadius: 7,
      pointBackgroundColor: colors.surface,
      pointBorderColor: colors.record,
      pointBorderWidth: 2.5,
      pointHitRadius: 0,
      pointHoverRadius: 7,
    },
    {
      data: points.map((p) => secsPoint(p, p.rolling?.avg)),
      order: 1,
      borderColor: colors.accent,
      borderWidth: 2,
      pointRadius: 0,
      pointHitRadius: 0,
    },
  ];
  if (avg === "mean") {
    datasets.push(
      {
        data: points.map((p) => band(p, 1)),
        order: 4,
        borderWidth: 0,
        pointRadius: 0,
        pointHitRadius: 0,
        fill: "+1",
        backgroundColor: BAND,
      },
      {
        data: points.map((p) => band(p, -1)),
        order: 4,
        borderWidth: 0,
        pointRadius: 0,
        pointHitRadius: 0,
      },
    );
  }
  return { datasets };
}

function LegendItem({ swatch, label }) {
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
    >
      {swatch}
      {label}
    </Box>
  );
}

export default function OverTimeChart({ series, metric, avg, windowSize }) {
  const points = series.data?.points ?? [];
  const navigate = useNavigate();
  const location = useLocation();
  const { search } = location;
  const averageLabel =
    avg === "aox"
      ? `ao${windowSize}`
      : `${avg === "median" ? "Median" : "Mean"} of ${windowSize}`;
  const data = chartData(points, avg);
  const y = yBounds(data.datasets, metric);
  const options = {
    interaction: { mode: "point", intersect: true },
    onHover(event, elements, chart) {
      chart.canvas.style.cursor = elements.some((el) => el.datasetIndex === 0)
        ? "pointer"
        : "default";
    },
    onClick(event, elements, chart) {
      const hit = elements.find((el) => el.datasetIndex === 0);
      const gameId = hit && chart.data.datasets[0].data[hit.index]?.gameId;
      // Opens as a dialog over the dashboard (App.jsx).
      if (gameId)
        navigate(
          { pathname: `/games/${gameId}`, search },
          { state: { backgroundLocation: location } },
        );
    },
    scales: {
      x: {
        type: "time",
        time: { displayFormats: { week: "MMM d", month: "MMM" } },
        grid: { display: false },
        border: { display: false },
        ticks: { maxRotation: 0 },
      },
      y: {
        ...y.bounds,
        border: { display: false },
        grid: { drawTicks: false },
        ticks: {
          stepSize: y.stepSize,
          callback: (value) =>
            metric === "pace"
              ? `${value}s`
              : clock(value * 1000, { tenths: false }),
        },
      },
    },
    plugins: {
      tooltip: {
        filter: (item) => item.datasetIndex === 0,
        callbacks: {
          title: (items) => dateTime(items[0].raw.started_at),
          label(item) {
            const p = item.raw;
            const lines = [
              `Pace  ${secs(p.paceMs)} s`,
              `Time  ${p.durationMs == null ? "n/a" : clock(p.durationMs)}`,
              `Sets  ${p.sets}`,
            ];
            if (p.record) lines.push("New best time");
            return lines;
          },
        },
      },
    },
  };
  return (
    <Box component="figure" sx={{ m: 0, flex: "999 1 520px", minWidth: 0 }}>
      <Box sx={{ position: "relative", height: 280 }}>
        <Line
          data={data}
          options={options}
          fallbackContent={
            metric === "time"
              ? "Game time of each finished game"
              : "Pace of each game"
          }
        />
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
        <LegendItem
          label="One game"
          swatch={
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: colors.scale[2],
              }}
            />
          }
        />
        <LegendItem
          label={averageLabel}
          swatch={
            <Box sx={{ width: 18, height: 3, bgcolor: "primary.main" }} />
          }
        />
        {avg === "mean" ? (
          <LegendItem
            label="± 1 std dev"
            swatch={<Box sx={{ width: 18, height: 10, bgcolor: BAND }} />}
          />
        ) : null}
        <LegendItem
          label="New best time"
          swatch={
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M7 1 l6 6 l-6 6 l-6 -6 z"
                fill={colors.surface}
                stroke={colors.record}
                strokeWidth="2"
              />
            </svg>
          }
        />
      </Box>
    </Box>
  );
}
