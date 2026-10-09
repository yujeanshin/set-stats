import { Paper, Typography } from "@mui/material";

/**
 * One statistic card: a small label, a big mono value, and an optional
 * smaller grey suffix (unit, ± spread). `accent` gives the purple border
 * the mockups use to call out one tile.
 */
export default function Tile({
  label,
  value,
  suffix,
  suffixSize = 15,
  accent = false,
  size = 30,
}) {
  return (
    <Paper
      sx={{
        p: 2,
        flex: "1 1 180px",
        minWidth: 0,
        borderColor: accent ? "primary.main" : undefined,
      }}
    >
      <Typography
        variant="subtitle2"
        component="div"
        sx={{ color: accent ? "primary.main" : undefined }}
      >
        {label}
      </Typography>
      <Typography
        component="div"
        sx={{
          fontFamily: "mono",
          fontSize: size,
          fontWeight: 600,
          lineHeight: 1.2,
          mt: 0.75,
        }}
      >
        {value}
        {suffix ? (
          <Typography
            component="span"
            sx={{
              fontFamily: "mono",
              fontSize: suffixSize,
              fontWeight: 500,
              color: "text.secondary",
              // Inline, not inline-block, so the leading space below is kept
              // at the suffix's size, as in the mockup.
              whiteSpace: "nowrap",
            }}
          >
            {" "}
            {suffix}
          </Typography>
        ) : null}
      </Typography>
    </Paper>
  );
}
