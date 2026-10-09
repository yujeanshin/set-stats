// Activity calendar (brief 6.4): one cell per local day, colored by games
// started that day. The API buckets days and picks the color thresholds;
// this lays out the weeks and draws them.
import { useLayoutEffect, useRef, useState } from "react";
import { Alert, Box, Button, Paper, Tooltip, Typography } from "@mui/material";
import { useApi } from "../api.js";
import { useFilters } from "../filters.js";
import { localTimeZone } from "../format.js";
import { colors } from "../theme.js";

const CELL = 13;
const GAP = 3;

/** "YYYY-MM-DD" of a local date. */
function dayKey(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** A "YYYY-MM-DD" key as a local Date at midnight. */
function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Weeks (columns, Sunday first) covering from..to. Each week is 7 entries,
 * a day key or null for days outside the range.
 */
function weeks(from, to) {
  const start = parseKey(from);
  start.setDate(start.getDate() - start.getDay());
  const end = parseKey(to);
  const out = [];
  for (const d = start; d <= end;) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const key = dayKey(d);
      week.push(key >= from && key <= to ? key : null);
      d.setDate(d.getDate() + 1);
    }
    out.push(week);
  }
  return out;
}

/** Color level 0-4 for a count, given the API's three thresholds. */
function level(count, thresholds) {
  if (!count) return 0;
  const i = thresholds.findIndex((t) => count <= t);
  return i === -1 ? 4 : i + 1;
}

const plural = (n) => `${n} ${n === 1 ? "game" : "games"}`;
const longDate = (key) =>
  parseKey(key).toLocaleDateString(undefined, { dateStyle: "medium" });

function Legend() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        fontSize: 13,
        color: "text.secondary",
      }}
    >
      <span>Fewer</span>
      {colors.scale.map((c) => (
        <Box
          key={c}
          sx={{ width: 14, height: 14, borderRadius: "3px", bgcolor: c }}
        />
      ))}
      <span>More</span>
    </Box>
  );
}

/** Month names above the week that holds the 1st of each month. */
function MonthLabels({ cols }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        display: "flex",
        gap: `${GAP}px`,
        height: 18,
        fontSize: 12,
        color: "text.secondary",
      }}
    >
      {cols.map((week, i) => {
        const first = week.find((key) => key?.endsWith("-01"));
        return (
          <Box key={i} sx={{ width: CELL, flex: "none", overflow: "visible" }}>
            {first
              ? parseKey(first).toLocaleDateString(undefined, {
                  month: "short",
                })
              : null}
          </Box>
        );
      })}
    </Box>
  );
}

export default function Calendar() {
  const [filters] = useFilters();
  const [year, setYear] = useState(null); // null: the past year
  const cal = useApi("/calendar", {
    ...filters,
    year,
    tz: localTimeZone(),
    today: dayKey(new Date()),
  });
  const data = cal.data;
  // A year with no games in the newly selected mode falls back to past year.
  if (data && year != null && !data.years.includes(year)) setYear(null);

  const cols = data ? weeks(data.from, data.to) : [];
  // On narrow screens the grid scrolls; start at the most recent weeks.
  const scroller = useRef(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data]);
  return (
    <Paper component="section" aria-label="Activity calendar" sx={{ p: 2.5 }}>
      <Typography variant="h2" component="h2">
        <Box component="span" sx={{ fontFamily: "mono" }}>
          {data ? data.total : "…"}
        </Box>{" "}
        {data?.total === 1 ? "game" : "games"}{" "}
        {year == null ? "in the past year" : `in ${year}`}
      </Typography>
      {cal.error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {cal.error.message}
        </Alert>
      ) : null}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 3,
          mt: 2,
        }}
      >
        <Box
          sx={{
            order: 1,
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <Legend />
          <Box
            role="group"
            aria-label="Year"
            sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
          >
            {[null, ...(data?.years ?? [])].map((y) => {
              const selected = y === year;
              return (
                <Button
                  key={y ?? "past"}
                  aria-pressed={selected}
                  onClick={() => setYear(y)}
                  variant={selected ? "contained" : "text"}
                  disableElevation
                  sx={{
                    justifyContent: "flex-start",
                    px: 1.75,
                    fontWeight: selected ? 600 : 400,
                    color: selected ? undefined : "text.primary",
                  }}
                >
                  {y ?? "Past year"}
                </Button>
              );
            })}
          </Box>
        </Box>
        <Box
          ref={scroller}
          sx={{ flex: "999 1 480px", minWidth: 0, overflowX: "auto" }}
        >
          <Box sx={{ width: "max-content" }}>
            <MonthLabels cols={cols} />
            <Box
              role="group"
              aria-label="Games per day"
              sx={{ display: "flex", gap: `${GAP}px` }}
            >
              {cols.map((week, i) => (
                <Box
                  key={i}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: `${GAP}px`,
                  }}
                >
                  {week.map((key, j) => {
                    if (!key)
                      return <Box key={j} sx={{ width: CELL, height: CELL }} />;
                    const n = data.days[key] ?? 0;
                    const label = `${n ? plural(n) : "No games"} on ${longDate(key)}`;
                    return (
                      <Tooltip key={key} title={label} disableInteractive>
                        <Box
                          role="img"
                          aria-label={label}
                          sx={{
                            width: CELL,
                            height: CELL,
                            borderRadius: "3px",
                            bgcolor: colors.scale[level(n, data.thresholds)],
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
