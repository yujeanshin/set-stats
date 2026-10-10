// The trend card (brief 6.5; title and Range from brief-v3 item 4). Its
// controls are local state: they apply only to this card, unlike the
// top-bar filters, which come from the URL.
import { useState } from "react";
import {
  Alert,
  Box,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useApi } from "../api.js";
import { useFilters } from "../filters.js";
import { clock, secs } from "../format.js";
import Histogram from "./Histogram.jsx";
import OverTimeChart from "./OverTimeChart.jsx";
import RangeControls, { rangeParams } from "./RangeControls.jsx";

const WINDOWS = [5, 10, 12, 50, 100];

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
  const [metric, setMetric] = useState("time"); // "time" | "pace"
  const [avg, setAvg] = useState("mean"); // "mean" | "median" | "aox"
  const [windowSize, setWindowSize] = useState(5);
  const [rangeValue, setRange] = useState({
    range: "90d",
    customFrom: "",
    customTo: "",
    lastN: "",
  });
  const setRangeValue = (patch) => setRange((v) => ({ ...v, ...patch }));
  const series = useApi("/series", {
    ...filters,
    metric,
    avg,
    window: windowSize,
    ...rangeParams(rangeValue),
  });
  const s = series.data?.summary;
  const pace = metric === "pace";
  const fmt = pace ? secs : signedClock;
  const unit = pace ? "s" : "";
  return (
    <Paper
      component="section"
      aria-labelledby="trend-title"
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
          <Typography id="trend-title" variant="h2" component="h2">
            Trend
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={metric}
            onChange={(e, v) => v && setMetric(v)}
            aria-label="Metric"
          >
            <ToggleButton value="time">Game time</ToggleButton>
            <ToggleButton value="pace">Pace</ToggleButton>
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
        <RangeControls
          value={rangeValue}
          onChange={setRangeValue}
          scope={series.data?.scope}
        />
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
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        <OverTimeChart
          series={series}
          metric={metric}
          avg={avg}
          windowSize={windowSize}
        />
        <Histogram series={series} metric={metric} />
      </Box>
    </Paper>
  );
}
