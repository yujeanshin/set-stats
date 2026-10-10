// By window table (brief 6.6). Pace here is pooled over every find in the
// window, the way `npm run stats` reports it. `summary` is useApi("/summary").
import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { clock, secs } from "../format.js";

const ROWS = [
  ["allTime", "All time"],
  ["last30Days", "Last 30 days"],
  ["last10Finished", "Last 10 finished"],
];

const num = { fontFamily: "mono", fontSize: 14, textAlign: "right" };

/** Half width beside Records on wide screens. */
export default function ByWindow({ summary }) {
  const windows = summary.data?.windows;
  return (
    <Paper
      component="section"
      aria-label="Stats by window"
      sx={{
        p: 2.5,
        flex: "1 1 420px",
        minWidth: 0,
      }}
    >
      <Typography variant="h2" component="h2" sx={{ mb: 1.5 }}>
        By window
      </Typography>
      {summary.error ? (
        <Alert severity="error">{summary.error.message}</Alert>
      ) : null}
      <Box sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 380 }}>
          <TableHead>
            <TableRow>
              <TableCell>Window</TableCell>
              <TableCell align="right">Finished</TableCell>
              <TableCell align="right">Unfinished</TableCell>
              <TableCell align="right">Avg time</TableCell>
              <TableCell align="right">Pace</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ROWS.map(([key, label], i) => {
              const w = windows?.[key];
              const last = i === ROWS.length - 1;
              const cell = last ? { ...num, borderBottom: 0 } : num;
              return (
                <TableRow key={key}>
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{ fontWeight: 500, borderBottom: last ? 0 : undefined }}
                  >
                    {label}
                  </TableCell>
                  <TableCell sx={cell}>{w ? w.finished : "…"}</TableCell>
                  <TableCell sx={cell}>{w ? w.unfinished : "…"}</TableCell>
                  <TableCell sx={cell}>
                    {w ? clock(w.avgTimeMs) : "…"}
                  </TableCell>
                  <TableCell sx={cell}>
                    {w ? (w.paceMs == null ? "–" : `${secs(w.paceMs)} s`) : "…"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
