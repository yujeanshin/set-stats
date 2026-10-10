import {
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useApi } from "../api.js";
import { BREAK_FACTOR, INSTANT_GAP_MS } from "../definitions.js";
import { useFilters } from "../filters.js";

/**
 * Mode select, Completed only, Hints off only (brief 6.2), Drop breaks,
 * Skip bad timing (brief-v2). With `normalOnly` (the Set types page) the
 * mode is fixed, so it is shown as text instead of a select; `notes`
 * replace the two time filters' tooltips where they mean something else.
 */
export default function FilterBar({ normalOnly = false, notes = {} }) {
  const [filters, setFilters] = useFilters();
  const modes = useApi("/modes");
  const list = modes.data ?? [];
  // Until /modes answers, or if the URL names a mode, show that; else the first.
  const mode = filters.mode ?? list[0]?.mode ?? "";
  return (
    <Paper
      component="section"
      aria-label="Filters"
      sx={{
        p: 2,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: 2.5,
      }}
    >
      <Stack spacing={0.75}>
        <Typography id="mode-label" variant="subtitle2" component="span">
          Mode
        </Typography>
        {normalOnly ? (
          <Typography
            sx={{ minHeight: 40, display: "flex", alignItems: "center" }}
          >
            Normal (the only mode with boards)
          </Typography>
        ) : (
          <Select
            labelId="mode-label"
            size="small"
            value={list.some((m) => m.mode === mode) ? mode : ""}
            onChange={(e) => setFilters({ mode: e.target.value })}
            sx={{ minWidth: 160 }}
          >
            {list.map((m) => (
              <MenuItem key={m.mode} value={m.mode}>
                {m.name}
              </MenuItem>
            ))}
          </Select>
        )}
      </Stack>
      <Stack
        direction="row"
        spacing={2.5}
        flexWrap="wrap"
        sx={{ minHeight: 44, alignItems: "center" }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={filters.completedOnly}
              onChange={(e) => setFilters({ completedOnly: e.target.checked })}
            />
          }
          label="Completed only"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={filters.hintsOff}
              onChange={(e) => setFilters({ hintsOff: e.target.checked })}
            />
          }
          label="Hints off only"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={filters.dropBreaks}
              onChange={(e) => setFilters({ dropBreaks: e.target.checked })}
            />
          }
          label="Drop breaks"
          title={
            notes.dropBreaks ??
            `Leave out any gap between sets longer than ${BREAK_FACTOR}× that game's median gap, from both pace and game time`
          }
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={filters.skipBadTiming}
              onChange={(e) => setFilters({ skipBadTiming: e.target.checked })}
            />
          }
          label="Skip bad timing"
          title={
            notes.skipBadTiming ??
            `Leave out games with two sets under ${INSTANT_GAP_MS} ms apart, which no one can do: their timestamps are off. They stay in the games list and calendar.`
          }
        />
      </Stack>
    </Paper>
  );
}
