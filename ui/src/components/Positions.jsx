// Where I pick from (brief 6.7): for each board position, the share of my
// finds that used a card there. Normal mode only; the caller hides it
// otherwise. The grid matches the board in landscape: position i is at row
// i % 3, column floor(i / 3).
import { Alert, Box, Paper, Tooltip, Typography } from "@mui/material";
import { useApi } from "../api.js";
import { useFilters } from "../filters.js";
import { colors } from "../theme.js";

const ORDER = [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11]; // row-major cells

/** Color level 0-4 by where a share sits between the lowest and highest. */
function level(share, lo, hi) {
  if (share == null) return 0;
  if (hi === lo) return 2;
  return Math.min(4, Math.floor(((share - lo) / (hi - lo)) * 5));
}

const pct = (x) => (x == null ? "–" : `${(x * 100).toFixed(1)}%`);

export default function Positions() {
  const [filters] = useFilters();
  const res = useApi("/positions", { ...filters, mode: "normal" });
  const data = res.data;
  const shares = data?.shares ?? [];
  const defined = shares.filter((s) => s != null);
  const lo = Math.min(...defined);
  const hi = Math.max(...defined);
  return (
    <Paper
      component="section"
      aria-label="Positions picked"
      sx={{ p: 2.5, flex: "1 1 420px", minWidth: 0 }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 1,
          mb: 1.5,
        }}
      >
        <Typography variant="h2" component="h2">
          Where I pick from
        </Typography>
        <Typography variant="caption" component="span">
          Share of my finds using each board position
        </Typography>
      </Box>
      {res.error ? <Alert severity="error">{res.error.message}</Alert> : null}
      <Box
        role="table"
        aria-label="Share of finds by board position"
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "6px",
        }}
      >
        {ORDER.map((pos) => {
          const share = shares[pos] ?? null;
          const l = data ? level(share, lo, hi) : 0;
          return (
            <Box
              key={pos}
              role="cell"
              aria-label={`Position ${pos + 1}: ${pct(share)}`}
              title={`Position ${pos + 1}`}
              sx={{
                py: 1.75,
                borderRadius: "6px",
                textAlign: "center",
                fontFamily: "mono",
                fontSize: 14,
                fontWeight: 600,
                bgcolor: colors.scale[l],
                // White text only on the two darkest purples (brief 8).
                color: l >= 3 ? "#ffffff" : "text.primary",
              }}
            >
              {data ? pct(share) : "…"}
            </Box>
          );
        })}
      </Box>
      <Typography variant="caption" component="p" sx={{ mt: 1.25 }}>
        Even spread would be 25% per position.{" "}
        <Tooltip
          title={
            data?.beyond
              ? `Positions 13 and up (boards with extra cards) are left out: ${data.beyond} picked cards over ${data.finds} finds.`
              : "Positions 13 and up (boards with extra cards) are left out."
          }
        >
          <Box
            component="button"
            type="button"
            sx={{
              p: 0,
              border: 0,
              bgcolor: "transparent",
              font: "inherit",
              color: "primary.main",
              textDecoration: "underline dotted",
              cursor: "help",
              minHeight: 24,
            }}
          >
            12 positions only
          </Box>
        </Tooltip>
      </Typography>
    </Paper>
  );
}
