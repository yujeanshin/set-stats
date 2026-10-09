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

// const dotFill = (ctx) => (ctx.raw?.record ? colors.surface : colors.scale[2]);
// const dotStroke = (ctx) => (ctx.raw?.record ? colors.record : colors.scale[2]);

function secsPoint(p, ms) {
  return { x: p.started_at, y: ms == null ? null : ms / 1000 };
}

/** Datasets for one /series response. Y values are seconds; x is UTC ms. */
function chartData(points, avg) {
  //   const games = points.map((p) => ({
  //     ...secsPoint(p, p.value),
  //     gameId: p.game_id,
  //     started_at: p.started_at,
  //     paceMs: p.paceMs,
  //     durationMs: p.durationMs,
  //     sets: p.sets,
  //     record: p.record,
  //   }));
  const games = points
    .filter((p) => p.record)
    .map((p) => ({
      ...secsPoint(p, p.value),
      gameId: p.game_id,
      started_at: p.started_at,
      paceMs: p.paceMs,
      durationMs: p.durationMs,
      sets: p.sets,
      record: true,
    }));
  const line = points.map((p) => secsPoint(p, p.rolling?.avg));
  const datasets = [
    // {
    //   data: games,
    //   showLine: false,
    //   pointStyle: (ctx) => (ctx.raw?.record ? "rectRot" : "circle"),
    //   pointRadius: (ctx) => (ctx.raw?.record ? 7 : 5),
    //   pointHoverRadius: (ctx) => (ctx.raw?.record ? 8 : 6),
    //   pointBackgroundColor: dotFill,
    //   pointBorderColor: dotStroke,
    //   pointBorderWidth: (ctx) => (ctx.raw?.record ? 2.5 : 0),
    //   pointHoverBackgroundColor: dotFill,
    //   pointHoverBorderColor: dotStroke,
    //   pointHoverBorderWidth: (ctx) => (ctx.raw?.record ? 2.5 : 0),
    //   pointHitRadius: 8,
    // },
    {
      data: games,
      showLine: false,
      pointStyle: "rectRot",
      pointRadius: 7,
      pointHoverRadius: 8,
      pointBackgroundColor: colors.surface,
      pointBorderColor: colors.record,
      pointBorderWidth: 2.5,
      pointHoverBackgroundColor: colors.surface,
      pointHoverBorderColor: colors.record,
      pointHoverBorderWidth: 2.5,
      pointHitRadius: 8,
    },
    {
      data: line,
      borderColor: colors.accent,
      borderWidth: 2,
      pointRadius: 0,
      pointHitRadius: 0,
    },
  ];
  if (avg === "mean") {
    datasets.push(
      {
        data: points.map((p) =>
          secsPoint(
            p,
            p.rolling?.sd == null ? null : p.rolling.avg + p.rolling.sd,
          ),
        ),
        borderWidth: 0,
        pointRadius: 0,
        pointHitRadius: 0,
        fill: "+1",
        backgroundColor: BAND,
      },
      {
        data: points.map((p) =>
          secsPoint(
            p,
            p.rolling?.sd == null ? null : p.rolling.avg - p.rolling.sd,
          ),
        ),
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
  const { search } = useLocation();
  const averageLabel =
    avg === "aox"
      ? `ao${windowSize}`
      : `${avg === "median" ? "Median" : "Mean"} of ${windowSize}`;
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
      if (gameId) navigate({ pathname: `/games/${gameId}`, search });
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
        grace: "8%",
        border: { display: false },
        grid: { drawTicks: false },
        ticks: {
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
    <Box component="figure" sx={{ m: 0 }}>
      <Box sx={{ position: "relative", height: 280 }}>
        <Line
          data={chartData(points, avg)}
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
        {/* <LegendItem
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
        /> */}
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
