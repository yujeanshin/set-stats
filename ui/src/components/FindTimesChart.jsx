// Time per find in one game (brief 7): one bar per find, in order, with a
// dashed line at the median find time. Hovering a bar shows that find's set
// when the board data is there (brief-v2); clicking one calls onSelect.
//
// bars: [{ ms, number, find, isBreak }]. `number` is my find number in the
// game, `find` the row from /games/:id/finds (or null), matched by seq by
// the caller. Break bars (full page only) are grey and capped so one long
// break doesn't flatten the rest.
import { Box, Paper, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import "../chart.js";
import { DEFINITIONS } from "../definitions.js";
import { secs } from "../format.js";
import { colors } from "../theme.js";
import DiffMarks from "./DiffMarks.jsx";
import InfoTip from "./InfoTip.jsx";
import SetCard from "./SetCard.jsx";

const HEIGHT = 280;

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

// Two white slashes near the top of each bar listed in
// options.plugins.cutBars.indexes, to show the bar is cut off at the top.
const cutBars = {
  id: "cutBars",
  afterDatasetsDraw(chart, args, opts) {
    if (!opts.indexes?.length) return;
    const { ctx } = chart;
    const bars = chart.getDatasetMeta(0).data;
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    for (const i of opts.indexes) {
      const { x, y, width } = bars[i];
      for (const dy of [8, 13]) {
        ctx.beginPath();
        ctx.moveTo(x - width / 2, y + dy + 3);
        ctx.lineTo(x + width / 2, y + dy - 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};

/** The hover tooltip: the find, its time and, with board data, its set. */
function FindTip({ bar, x, y, chartWidth }) {
  const chosen = bar.find?.sets.find((s) => s.is_chosen);
  const right = x > chartWidth / 2;
  return (
    <Box
      sx={{
        position: "absolute",
        pointerEvents: "none",
        zIndex: 1,
        // Beside the bar, on whichever side has more room.
        ...(right ? { right: chartWidth - x + 10 } : { left: x + 10 }),
        top: Math.min(Math.max(y - 70, 4), HEIGHT - 150),
        p: "10px",
        borderRadius: "6px",
        bgcolor: colors.text,
        color: "#ffffff",
        fontFamily: "mono",
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      Find {bar.number} · {secs(bar.ms)} s
      {bar.isBreak ? (
        <Box sx={{ fontFamily: "fontFamily", fontSize: 12, mt: 0.25 }}>
          Break, left out of the stats
        </Box>
      ) : null}
      {chosen ? (
        <>
          <Box sx={{ display: "flex", gap: "4px", mt: 1 }}>
            {chosen.cards.map((c) => (
              <SetCard key={c} card={c} width={28} />
            ))}
          </Box>
          <Box sx={{ mt: 0.75 }}>
            <DiffMarks mask={chosen.diff_mask} tone="dark" size={15} />
          </Box>
        </>
      ) : null}
    </Box>
  );
}

export default function FindTimesChart({
  bars,
  medianMs,
  note = null,
  selected = null,
  onSelect = null,
}) {
  const [tip, setTip] = useState(null); // { index, x, y, chartWidth }

  // With breaks shown, cap the y axis a little above the longest other find.
  const cap = useMemo(() => {
    const rest = bars.filter((b) => !b.isBreak).map((b) => b.ms);
    return bars.some((b) => b.isBreak) && rest.length
      ? Math.max(...rest) * 1.15
      : null;
  }, [bars]);

  const { data, options } = useMemo(() => {
    const cut = bars.flatMap((b, i) => (cap != null && b.ms > cap ? [i] : []));
    const fill = (hover) =>
      bars.map((b, i) =>
        b.isBreak
          ? colors.controlBorder
          : i === selected || hover
            ? colors.accentDark
            : colors.scale[3],
      );
    const data = {
      labels: bars.map((b) => b.number),
      datasets: [
        {
          data: bars.map((b) => Math.min(b.ms, cap ?? Infinity) / 1000),
          backgroundColor: fill(false),
          hoverBackgroundColor: fill(true),
          borderRadius: { topLeft: 3, topRight: 3 },
          borderSkipped: "bottom",
          categoryPercentage: 0.85,
          barPercentage: 1,
        },
      ],
    };
    const options = {
      interaction: { mode: "index", intersect: false },
      onClick: onSelect
        ? (evt, elements) => elements.length && onSelect(elements[0].index)
        : undefined,
      onHover: (evt, elements) => {
        evt.native.target.style.cursor =
          onSelect && elements.length ? "pointer" : "default";
      },
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
            callback: (v, i) => {
              const n = bars[i].number;
              return i === 0 || n % 5 === 0 ? n : "";
            },
          },
        },
        y: {
          beginAtZero: true,
          max: cap == null ? undefined : cap / 1000,
          border: { display: false },
          grid: { drawTicks: false },
          // The cap is not a round number; leave its tick unlabelled.
          ticks: {
            padding: 6,
            callback: (v) => (Number.isInteger(v) ? `${v}s` : ""),
          },
        },
      },
      plugins: {
        medianLine: { value: medianMs == null ? null : medianMs / 1000 },
        cutBars: { indexes: cut },
        tooltip: {
          // Drawn in HTML by FindTip, so it can hold the cards.
          enabled: false,
          external: ({ chart, tooltip }) => {
            const point = tooltip.opacity ? tooltip.dataPoints?.[0] : null;
            const next = point && {
              index: point.dataIndex,
              x: tooltip.caretX,
              y: tooltip.caretY,
              chartWidth: chart.width,
            };
            // Only on change: this runs on every draw, and a new state
            // object would redraw the chart again.
            setTip((prev) =>
              prev?.index === next?.index &&
              prev?.x === next?.x &&
              prev?.y === next?.y
                ? prev
                : next,
            );
          },
        },
      },
    };
    return { data, options };
  }, [bars, cap, medianMs, selected, onSelect]);

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
          Time per find{" "}
          <InfoTip title={DEFINITIONS.findTime} label="find time" />
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
      {note ? (
        <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
          {note}
        </Typography>
      ) : bars.some((b) => b.find) ? (
        <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
          Hover a bar to see the set I took.{" "}
          <InfoTip title={DEFINITIONS.diffMarks} label="the C S F N marks" />
          {onSelect ? " Click it to show that board below." : null}
        </Typography>
      ) : null}
      <Box sx={{ overflowX: "auto", mt: 2 }}>
        <Box sx={{ position: "relative", height: HEIGHT, minWidth: 640 }}>
          {bars.length ? (
            <>
              <Bar
                data={data}
                options={options}
                plugins={[medianLine, cutBars]}
                fallbackContent={`Find times in seconds: ${bars
                  .map((b) => secs(b.ms))
                  .join(", ")}`}
              />
              {tip && bars[tip.index] ? (
                <FindTip bar={bars[tip.index]} {...tip} />
              ) : null}
            </>
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
