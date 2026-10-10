// Activity calendar (brief 6.4): one cell per local day, colored by games
// started that day. The API buckets days and picks the color thresholds;
// this lays out the weeks and draws them. Each day is a button that opens
// that day's games under the grid (brief-v3 item 3); the grid is one tab
// stop, and the arrow keys move between days.
import { useLayoutEffect, useRef, useState } from "react";
import { Alert, Box, Button, Paper, Tooltip, Typography } from "@mui/material";
import { useApi } from "../api.js";
import { useFilters, useSelectedDay } from "../filters.js";
import { localTimeZone } from "../format.js";
import { colors } from "../theme.js";
import DayPanel from "./DayPanel.jsx";

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

/** A "YYYY-MM-DD" key moved by n days. */
function shiftKey(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

// Columns are weeks, so left and right move a week, up and down a day.
const STEPS = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };

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
  const [day, setDay] = useSelectedDay();
  // The day the arrow keys last moved to. The grid's one tab stop is that
  // day, else the selected day, else the last day shown.
  const [focusKey, setFocusKey] = useState(null);
  const cells = useRef(new Map()); // day key -> button
  const shown = (key) =>
    key != null && data && key >= data.from && key <= data.to;
  const tabKey = shown(focusKey) ? focusKey : shown(day) ? day : data?.to;

  function onCellKey(e, key) {
    let next;
    if (e.key in STEPS) next = shiftKey(key, STEPS[e.key]);
    else if (e.key === "Home") next = data.from;
    else if (e.key === "End") next = data.to;
    else return;
    e.preventDefault();
    if (next < data.from) next = data.from;
    if (next > data.to) next = data.to;
    setFocusKey(next);
    cells.current.get(next)?.focus();
  }
  // Clicking the selected day again closes it.
  function onCellClick(key) {
    setFocusKey(key);
    setDay(key === day ? null : key);
  }
  // Closing the panel puts focus back on its day, when it is shown.
  function closeDay() {
    const cell = cells.current.get(day);
    setDay(null);
    cell?.focus();
  }

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
      <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
        Select a day to list its games.
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
          {/* Padding so the selected day's ring isn't clipped. */}
          <Box sx={{ width: "max-content", p: "4px" }}>
            <MonthLabels cols={cols} />
            <Box
              role="group"
              aria-label="Games per day. Arrow keys move between days."
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
                    const selected = key === day;
                    return (
                      <Tooltip key={key} title={label} disableInteractive>
                        <Box
                          component="button"
                          type="button"
                          ref={(el) => {
                            if (el) cells.current.set(key, el);
                            else cells.current.delete(key);
                          }}
                          tabIndex={key === tabKey ? 0 : -1}
                          aria-label={label}
                          aria-pressed={selected}
                          onClick={() => onCellClick(key)}
                          onKeyDown={(e) => onCellKey(e, key)}
                          sx={{
                            display: "block",
                            width: CELL,
                            height: CELL,
                            p: 0,
                            border: 0,
                            borderRadius: "3px",
                            bgcolor: colors.scale[level(n, data.thresholds)],
                            cursor: "pointer",
                            position: "relative",
                            // A white gap, then a dark ring: visible on
                            // every color level.
                            boxShadow: selected
                              ? `0 0 0 1px #ffffff, 0 0 0 3px ${colors.text}`
                              : undefined,
                            zIndex: selected ? 1 : undefined,
                            "&:hover": {
                              outline: `1px solid ${colors.text}`,
                              outlineOffset: "1px",
                            },
                            "&:focus-visible": {
                              outline: `2px solid ${colors.accent}`,
                              outlineOffset: selected ? "4px" : "1px",
                              zIndex: 2,
                            },
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
      {day ? <DayPanel key={day} day={day} onClose={closeDay} /> : null}
    </Paper>
  );
}
