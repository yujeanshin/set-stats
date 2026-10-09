// Time per find in one game (brief 7): one bar per find, in order, with a
// dashed line at the median find time. No click action yet.
import { Box, Paper, Typography } from "@mui/material";
import { Bar } from "react-chartjs-2";
import "../chart.js";
import { secs } from "../format.js";
import { colors } from "../theme.js";

// Draws a dashed horizontal line at options.plugins.medianLine.value (in
// the y scale's units), above the bars.
const medianLine = {
  id: "medianLine",
  afterDatasetsDraw(chart, args, opts) {
    if (opts.value == null) return;
    const { ctx, chartArea, scales } = chart;
    const y = scales.y.getPixelForValue(opts.value);
    ctx.save();
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();
    ctx.restore();
  },
};

export default function FindTimesChart({ findTimes, medianMs }) {
  const data = {
    labels: findTimes.map((_, i) => i + 1),
    datasets: [
      {
        data: findTimes.map((ms) => ms / 1000),
        backgroundColor: colors.scale[3],
        hoverBackgroundColor: colors.accentDark,
        borderRadius: { topLeft: 3, topRight: 3 },
        borderSkipped: "bottom",
        categoryPercentage: 0.85,
        barPercentage: 1,
      },
    ],
  };
  const options = {
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        grid: { display: false },
        border: { color: colors.controlBorder },
        title: {
          display: true,
          text: "Find number",
          font: { family: "Figtree, system-ui, sans-serif", size: 13 },
        },
        ticks: {
          maxRotation: 0,
          autoSkip: false,
          // Label the first find and every fifth, as in the mockup.
          callback: (v, i) => (i === 0 || (i + 1) % 5 === 0 ? i + 1 : ""),
        },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { drawTicks: false },
        ticks: { padding: 6, callback: (v) => `${v}s` },
      },
    },
    plugins: {
      medianLine: { value: medianMs == null ? null : medianMs / 1000 },
      tooltip: {
        callbacks: {
          title: () => "",
          label: (item) =>
            `Find ${item.dataIndex + 1} · ${item.raw.toFixed(1)} s`,
        },
      },
    },
  };
  return (
    <Paper component="section" aria-label="Time per find" sx={{ p: 2.5 }}>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Typography variant="h2" component="h2">
          Time per find
        </Typography>
        {medianMs != null ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              fontSize: 13,
              color: "text.secondary",
            }}
          >
            <Box
              component="span"
              sx={{ width: 18, borderTop: `2px dashed ${colors.text}` }}
            />
            Median,{" "}
            <Box component="span" sx={{ fontFamily: "mono" }}>
              {secs(medianMs)} s
            </Box>
          </Box>
        ) : null}
      </Box>
      <Box sx={{ overflowX: "auto", mt: 2 }}>
        <Box sx={{ position: "relative", height: 280, minWidth: 640 }}>
          {findTimes.length ? (
            <Bar
              data={data}
              options={options}
              plugins={[medianLine]}
              fallbackContent={`Find times in seconds: ${findTimes
                .map((ms) => secs(ms))
                .join(", ")}`}
            />
          ) : (
            <Typography color="text.secondary">
              No sets found in this game.
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
