// Where I pick from (brief 6.7, reworked in brief-v3 item 8): for each
// board position, the share of my finds that used a card there, over the
// Set types page's games. The grid matches the board in landscape:
// position i is at row i % 3, column floor(i / 3). Each cell is colored by
// its distance from an even 25%, above in purple and below in teal; the
// percentage in every cell says the same without color.
import { Alert, Box, Paper, Tooltip, Typography } from "@mui/material";
import { useApi } from "../api.js";
import { heatExtent, heatLevel, STEPS } from "../positionScale.js";
import { colors } from "../theme.js";

const ORDER = [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11]; // row-major cells

const pct = (x) => (x == null ? "–" : `${(x * 100).toFixed(1)}%`);

/** Background and text color of a step; dark text on the lighter steps. */
function heatColors(level) {
  if (!level) return { bg: colors.heat.neutral, fg: colors.text };
  const side = level > 0 ? colors.heat.above : colors.heat.below;
  const i = Math.abs(level) - 1;
  return { bg: side[i], fg: i >= 2 ? "#ffffff" : colors.text };
}

/** "1.5 points above even", for screen readers and the tooltip. */
function offText(share) {
  const points = (share - 0.25) * 100;
  if (Math.abs(points) < 0.05) return "even";
  return `${Math.abs(points).toFixed(1)} points ${points > 0 ? "above" : "below"} even`;
}

/** The scale under the grid: the steps from below to above, with ends. */
function Key({ extent }) {
  const levels = Array.from({ length: 2 * STEPS + 1 }, (_, i) => i - STEPS);
  const lo = pct(0.25 - extent);
  const hi = pct(0.25 + extent);
  return (
    <Box
      role="img"
      aria-label={`Color scale: teal below 25%, purple above, full color at ${lo} and ${hi} or beyond.`}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        mt: 1.25,
        fontFamily: "mono",
        fontSize: 12,
        color: "text.secondary",
      }}
    >
      <span aria-hidden="true">≤{lo}</span>
      <Box sx={{ display: "flex", gap: "2px" }} aria-hidden="true">
        {levels.map((l) => (
          <Box
            key={l}
            sx={{
              width: 14,
              height: 10,
              borderRadius: "2px",
              bgcolor: heatColors(l).bg,
            }}
          />
        ))}
      </Box>
      <span aria-hidden="true">≥{hi}</span>
    </Box>
  );
}

/** params: the Set types page's filters and Range, as /types takes them. */
export default function Positions({ params }) {
  const res = useApi("/types/positions", params);
  const data = res.data?.needsRebuild ? null : res.data;
  const shares = data?.shares ?? [];
  const extent = heatExtent(shares);
  return (
    <Paper
      component="section"
      aria-labelledby="positions-title"
      sx={{ p: 2.5, minWidth: 0 }}
    >
      <Typography id="positions-title" variant="h2" component="h2">
        Where I pick from
      </Typography>
      <Typography variant="caption" component="p" sx={{ mt: 0.5, mb: 1.5 }}>
        Share of finds that used each position. A find uses 3 cards, so an even
        spread is 25%.
      </Typography>
      {res.error ? <Alert severity="error">{res.error.message}</Alert> : null}
      <Box
        role="table"
        aria-label="Share of finds by board position"
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "6px",
          maxWidth: 560,
        }}
      >
        {ORDER.map((pos) => {
          const share = shares[pos] ?? null;
          const { bg, fg } = heatColors(data ? heatLevel(share, extent) : null);
          const label = !data
            ? `Position ${pos + 1}: loading`
            : share == null
              ? `Position ${pos + 1}: no finds`
              : `Position ${pos + 1}: ${pct(share)}, ${offText(share)}`;
          return (
            <Box
              key={pos}
              role="cell"
              aria-label={label}
              title={label}
              sx={{
                py: 1.75,
                borderRadius: "6px",
                textAlign: "center",
                fontFamily: "mono",
                fontSize: 14,
                fontWeight: 600,
                bgcolor: bg,
                color: fg,
              }}
            >
              {data ? pct(share) : "…"}
            </Box>
          );
        })}
      </Box>
      {data ? <Key extent={extent} /> : null}
      <Typography variant="caption" component="p" sx={{ mt: 1.25 }}>
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
