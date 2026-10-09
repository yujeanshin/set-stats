// The Over time card (brief 6.5). Its controls are local state: they apply
// only to this card, unlike the top-bar filters, which come from the URL.
import { useState } from "react";
import {
  Alert,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useApi } from "../api.js";
import { useFilters } from "../filters.js";
import {
  clock,
  localDayEnd,
  localDayStart,
  localMidnightDaysAgo,
  secs,
} from "../format.js";
import OverTimeChart from "./OverTimeChart.jsx";

const WINDOWS = [5, 10, 12, 50, 100];
const RANGES = [
  ["7d", "7d"],
  ["30d", "30d"],
  ["90d", "90d"],
  ["all", "All time"],
  ["custom", "Custom"],
];

/** clock() for a value that may be negative, as the change over range is. */
function signedClock(ms) {
  if (ms == null) return "–";
  const text = clock(Math.abs(ms));
  return ms < 0 ? `-${text}` : text;
}

/** "± 1.0 s" when there is a standard deviation, otherwise just the unit. */
function spread(sd, fmt, unit) {
  const body = sd == null ? "" : `± ${fmt(sd)} `;
  return `${body}${unit}`.trim();
}

function Stat({ label, value, suffix }) {
  return (
    <div style={{ flexShrink: 0 }}>
      <Typography
        variant="subtitle2"
        component="dt"
        sx={{ whiteSpace: "nowrap" }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{
          m: "4px 0 0",
          fontFamily: "mono",
          fontSize: 20,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {value}
        {suffix ? (
          <Typography
            component="span"
            sx={{ fontSize: 14, fontWeight: 500, color: "text.secondary" }}
          >
            {" "}
            {suffix}
          </Typography>
        ) : null}
      </Typography>
    </div>
  );
}

export default function OverTime() {
  const [filters] = useFilters();
  const [metric, setMetric] = useState("pace"); // "pace" | "time"
  const [avg, setAvg] = useState("mean"); // "mean" | "median" | "aox"
  const [windowSize, setWindowSize] = useState(5);
  const [range, setRange] = useState("90d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [lastN, setLastN] = useState("");

  const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
  const n = Number(lastN);
  const series = useApi("/series", {
    ...filters,
    metric,
    avg,
    window: windowSize,
    from: days
      ? localMidnightDaysAgo(days)
      : range === "custom" && customFrom
        ? localDayStart(customFrom)
        : undefined,
    to: range === "custom" && customTo ? localDayEnd(customTo) : undefined,
    lastN: Number.isInteger(n) && n > 0 ? n : undefined,
  });
  const s = series.data?.summary;
  const pace = metric === "pace";
  const fmt = pace ? secs : signedClock;
  const unit = pace ? "s" : "";
  return (
    <Paper
      component="section"
      aria-label="Over time"
      sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 3 }}
    >
      <Stack
        direction="row"
        useFlexGap
        spacing={1.5}
        sx={{
          width: "100%",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Stack
          direction="row"
          useFlexGap
          spacing={2}
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Typography variant="h2" component="h2">
            Over time
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={metric}
            onChange={(e, v) => v && setMetric(v)}
            aria-label="Metric"
          >
            <ToggleButton value="pace">Pace</ToggleButton>
            <ToggleButton value="time">Game time</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Stack
          direction="row"
          useFlexGap
          spacing={1.5}
          sx={{ ml: "auto", alignItems: "center", flexWrap: "wrap" }}
        >
          <ToggleButtonGroup
            exclusive
            value={avg}
            onChange={(e, v) => v && setAvg(v)}
            aria-label="Average"
          >
            <ToggleButton value="mean">Mean</ToggleButton>
            <ToggleButton value="median">Median</ToggleButton>
            <ToggleButton value="aox">aoX</ToggleButton>
          </ToggleButtonGroup>
          <Typography
            component="label"
            variant="body2"
            color="text.secondary"
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            over
            <Select
              size="small"
              value={windowSize}
              onChange={(e) => setWindowSize(Number(e.target.value))}
              inputProps={{ "aria-label": "Window size" }}
            >
              {WINDOWS.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </Select>
            games
          </Typography>
        </Stack>
      </Stack>
      <Stack
        direction="row"
        useFlexGap
        spacing={2.5}
        sx={{ flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <Stack spacing={0.75}>
          <Typography variant="subtitle2" component="span">
            Date range
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={range}
            onChange={(e, v) => v && setRange(v)}
            aria-label="Date range"
          >
            {RANGES.map(([value, label]) => (
              <ToggleButton key={value} value={value}>
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
        {range === "custom" ? (
          <>
            <Stack spacing={0.75}>
              <Typography
                variant="subtitle2"
                component="label"
                htmlFor="range-from"
              >
                From
              </Typography>
              <TextField
                id="range-from"
                type="date"
                size="small"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                slotProps={{ htmlInput: { max: customTo || undefined } }}
              />
            </Stack>
            <Stack spacing={0.75}>
              <Typography
                variant="subtitle2"
                component="label"
                htmlFor="range-to"
              >
                To
              </Typography>
              <TextField
                id="range-to"
                type="date"
                size="small"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                slotProps={{ htmlInput: { min: customFrom || undefined } }}
              />
            </Stack>
          </>
        ) : null}
        <Stack spacing={0.75}>
          <Typography variant="subtitle2" component="label" htmlFor="lastn">
            Last N games
          </Typography>
          <TextField
            id="lastn"
            type="number"
            size="small"
            placeholder="All"
            value={lastN}
            onChange={(e) => setLastN(e.target.value)}
            sx={{ width: 96 }}
            slotProps={{ htmlInput: { min: 1 } }}
          />
        </Stack>
        <Stack
          component="dl"
          direction="row"
          useFlexGap
          spacing={3}
          sx={{
            m: 0,
            ml: "auto",
            flex: "0 0 auto",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            maxWidth: "100%",
            minWidth: 0,
          }}
        >
          <Stat label="Games in range" value={s ? s.n : "…"} />
          <Stat
            label={pace ? "Average pace" : "Average time"}
            value={s ? fmt(s.avg) : "…"}
            suffix={s && spread(s.sd, fmt, unit)}
          />
          <Stat
            label={pace ? "Best pace" : "Best time"}
            value={s ? fmt(s.best) : "…"}
            suffix={s && unit}
          />
          <Stat
            label="Change over range"
            value={s ? fmt(s.change) : "…"}
            suffix={s && unit}
          />
        </Stack>
      </Stack>
      {series.error ? (
        <Alert severity="error">{series.error.message}</Alert>
      ) : null}
      <OverTimeChart
        series={series}
        metric={metric}
        avg={avg}
        windowSize={windowSize}
      />
    </Paper>
  );
}
