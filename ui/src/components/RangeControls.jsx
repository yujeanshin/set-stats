// The Range control (brief-v3 item 4), shared by the trend card, which
// keeps its value in local state, and the Set types page, which keeps it
// in the URL. Two groups of preset buttons, Dates and Most recent games,
// with one button pressed across both: either a date range or a number of
// games, never both. Under it, the scope that choice gives. The parent
// owns the value; this only draws it.
import { useId, useState } from "react";
import {
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  localDayEnd,
  localDayStart,
  localMidnightDaysAgo,
  spanText,
} from "../format.js";

// Button labels are short; each group's heading (Dates, Most recent
// games) names them for screen readers.
export const DATE_RANGES = [
  ["7d", "7d"],
  ["30d", "30d"],
  ["90d", "90d"],
  ["all", "All time"],
  ["custom", "Custom"],
];

export const GAME_COUNTS = [50, 100, 500];

/**
 * The API's from, to and lastN for a value. Days count back from local
 * midnight; a custom range covers its last day. In games mode, a last N
 * that isn't a positive integer means all games.
 */
export function rangeParams({ range, customFrom, customTo, lastN }) {
  if (range === "games") {
    const n = Number(lastN);
    return { lastN: Number.isInteger(n) && n > 0 ? n : undefined };
  }
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
  return {
    from: days
      ? localMidnightDaysAgo(days)
      : range === "custom" && customFrom
        ? localDayStart(customFrom)
        : undefined,
    to: range === "custom" && customTo ? localDayEnd(customTo) : undefined,
  };
}

function DateInput({ id, label, ...props }) {
  return (
    <Stack spacing={0.75}>
      <Typography variant="subtitle2" component="label" htmlFor={id}>
        {label}
      </Typography>
      <TextField id={id} type="date" size="small" {...props} />
    </Stack>
  );
}

/**
 * value: { range, customFrom, customTo, lastN }. range is a DATE_RANGES
 * key, or "games" for the last lastN games; dates are "YYYY-MM-DD" and
 * lastN is as typed. onChange(patch) gets the fields that changed.
 * scope: the API's gameSpan ({ games, from, to }) for the line under the
 * control, or null while loading; `extra` is appended to that line.
 */
export default function RangeControls({ value, onChange, scope, extra }) {
  const { range, customFrom, customTo, lastN } = value;
  const id = useId();
  // Whether the custom count is chosen. Kept here, since a typed 100 would
  // otherwise turn into the 100 preset and hide the input.
  const [customCount, setCustomCount] = useState(
    range === "games" && !GAME_COUNTS.includes(Number(lastN)),
  );
  const games = range === "games";
  const selected = !games
    ? range
    : customCount || !GAME_COUNTS.includes(Number(lastN))
      ? "ncustom"
      : `n${lastN}`;

  function choose(v) {
    if (v === "ncustom") {
      setCustomCount(true);
      onChange({ range: "games", lastN: games ? lastN : "" });
    } else if (v.startsWith("n")) {
      setCustomCount(false);
      onChange({ range: "games", lastN: v.slice(1) });
    } else {
      setCustomCount(false);
      onChange({ range: v });
    }
  }

  return (
    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        useFlexGap
        spacing={1.5}
        sx={{ flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <Stack spacing={0.75}>
          <Typography id={`${id}-dates`} variant="subtitle2" component="span">
            Dates
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={games ? null : range}
            onChange={(e, v) => v && choose(v)}
            aria-labelledby={`${id}-dates`}
          >
            {DATE_RANGES.map(([v, label]) => (
              <ToggleButton key={v} value={v}>
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
        <Stack spacing={0.75}>
          <Typography id={`${id}-games`} variant="subtitle2" component="span">
            Most recent games
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={games ? selected : null}
            onChange={(e, v) => v && choose(v)}
            aria-labelledby={`${id}-games`}
          >
            {GAME_COUNTS.map((n) => (
              <ToggleButton key={n} value={`n${n}`}>
                {n}
              </ToggleButton>
            ))}
            <ToggleButton value="ncustom">Custom</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {range === "custom" ? (
          <>
            <DateInput
              id={`${id}-from`}
              label="From"
              value={customFrom}
              onChange={(e) => onChange({ customFrom: e.target.value })}
              slotProps={{ htmlInput: { max: customTo || undefined } }}
            />
            <DateInput
              id={`${id}-to`}
              label="To"
              value={customTo}
              onChange={(e) => onChange({ customTo: e.target.value })}
              slotProps={{ htmlInput: { min: customFrom || undefined } }}
            />
          </>
        ) : null}
        {selected === "ncustom" ? (
          <Stack spacing={0.75}>
            <Typography
              variant="subtitle2"
              component="label"
              htmlFor={`${id}-lastn`}
            >
              Number of games
            </Typography>
            <TextField
              id={`${id}-lastn`}
              type="number"
              size="small"
              placeholder="All"
              value={lastN}
              onChange={(e) => onChange({ lastN: e.target.value })}
              sx={{ width: 110 }}
              slotProps={{ htmlInput: { min: 1 } }}
            />
          </Stack>
        ) : null}
      </Stack>
      <Typography
        variant="body2"
        role="status"
        sx={{ color: "text.secondary" }}
      >
        {scope ? spanText(scope) : "…"}
        {scope && extra ? ` · ${extra}` : ""}
      </Typography>
    </Stack>
  );
}
