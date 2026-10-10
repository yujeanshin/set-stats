// Date range and Last N games controls (brief 6.5), shared by the Over time
// card, which keeps them in local state, and the Set types page, which
// keeps them in the URL. The parent owns the values; this only draws them.
import {
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { localDayEnd, localDayStart, localMidnightDaysAgo } from "../format.js";

export const RANGES = [
  ["7d", "7d"],
  ["30d", "30d"],
  ["90d", "90d"],
  ["all", "All time"],
  ["custom", "Custom"],
];

/**
 * The API's from, to and lastN for the controls' values. Days count back
 * from local midnight; a custom range covers its last day; a last N that
 * isn't a positive integer means all games.
 */
export function rangeParams({ range, customFrom, customTo, lastN }) {
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
  const n = Number(lastN);
  return {
    from: days
      ? localMidnightDaysAgo(days)
      : range === "custom" && customFrom
        ? localDayStart(customFrom)
        : undefined,
    to: range === "custom" && customTo ? localDayEnd(customTo) : undefined,
    lastN: Number.isInteger(n) && n > 0 ? n : undefined,
  };
}

/**
 * value: { range, customFrom, customTo, lastN } (dates as "YYYY-MM-DD",
 * lastN as typed). onChange(patch) gets the fields that changed. Renders
 * its controls as siblings, so they wrap with whatever row holds them.
 * idPrefix keeps the input ids unique on the page.
 */
export default function RangeControls({ value, onChange, idPrefix = "" }) {
  const { range, customFrom, customTo, lastN } = value;
  return (
    <>
      <Stack spacing={0.75}>
        <Typography variant="subtitle2" component="span">
          Date range
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={range}
          onChange={(e, v) => v && onChange({ range: v })}
          aria-label="Date range"
        >
          {RANGES.map(([v, label]) => (
            <ToggleButton key={v} value={v}>
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
              htmlFor={`${idPrefix}range-from`}
            >
              From
            </Typography>
            <TextField
              id={`${idPrefix}range-from`}
              type="date"
              size="small"
              value={customFrom}
              onChange={(e) => onChange({ customFrom: e.target.value })}
              slotProps={{ htmlInput: { max: customTo || undefined } }}
            />
          </Stack>
          <Stack spacing={0.75}>
            <Typography
              variant="subtitle2"
              component="label"
              htmlFor={`${idPrefix}range-to`}
            >
              To
            </Typography>
            <TextField
              id={`${idPrefix}range-to`}
              type="date"
              size="small"
              value={customTo}
              onChange={(e) => onChange({ customTo: e.target.value })}
              slotProps={{ htmlInput: { min: customFrom || undefined } }}
            />
          </Stack>
        </>
      ) : null}
      <Stack spacing={0.75}>
        <Typography
          variant="subtitle2"
          component="label"
          htmlFor={`${idPrefix}lastn`}
        >
          Last N games
        </Typography>
        <TextField
          id={`${idPrefix}lastn`}
          type="number"
          size="small"
          placeholder="All"
          value={lastN}
          onChange={(e) => onChange({ lastN: e.target.value })}
          sx={{ width: 96 }}
          slotProps={{ htmlInput: { min: 1 } }}
        />
      </Stack>
    </>
  );
}
