// The type of a set as four small lettered squares, one per feature in card
// order: C color, S shape, F fill (shade; F so it isn't a second S), N number.
// Filled means the feature differs across the three cards, hollow that it
// is the same on all three (sets.diff_mask, docs/schema.md).
import { Box } from "@mui/material";
import { maskFeatures } from "../cardFace.js";
import { colors } from "../theme.js";

const LETTERS = { color: "C", shape: "S", shade: "F", number: "N" };

/** "differs: shape, shade; same: color, number", for screen readers. */
export function describeMask(mask) {
  const f = maskFeatures(mask);
  const list = (differs) =>
    f
      .filter((x) => x.differs === differs)
      .map((x) => x.feature)
      .join(", ") || "none";
  return `differs: ${list(true)}; same: ${list(false)}`;
}

/** tone "light" for light backgrounds, "dark" inside the dark chart tooltip. */
export default function DiffMarks({ mask, tone = "light", size = 16 }) {
  const ink = tone === "dark" ? "#ffffff" : colors.text;
  const paper = tone === "dark" ? colors.text : colors.surface;
  return (
    <Box
      component="span"
      role="img"
      aria-label={describeMask(mask)}
      title={describeMask(mask)}
      sx={{ display: "inline-flex", gap: "3px", verticalAlign: "middle" }}
    >
      {maskFeatures(mask).map(({ feature, differs }) => (
        <Box
          key={feature}
          component="span"
          aria-hidden="true"
          sx={{
            width: size,
            height: size,
            boxSizing: "border-box",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "3px",
            border: `1.5px solid ${ink}`,
            bgcolor: differs ? ink : "transparent",
            color: differs ? paper : ink,
            fontFamily: "mono",
            fontSize: size * 0.62,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {LETTERS[feature]}
        </Box>
      ))}
    </Box>
  );
}
