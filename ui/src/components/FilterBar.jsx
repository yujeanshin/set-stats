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
import { useFilters } from "../filters.js";

/** Mode select, Completed only, Hints off only (brief 6.2). */
export default function FilterBar() {
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
      </Stack>
    </Paper>
  );
}
