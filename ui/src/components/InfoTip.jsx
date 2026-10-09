// A small "i" button that shows a definition on hover or keyboard focus.
// The button is the tooltip's anchor, so touch users can tap it.
import { Box, Tooltip } from "@mui/material";

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.75" />
      <path d="M8 7.25 V11.5" strokeLinecap="round" />
      <circle cx="8" cy="4.75" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** title: the definition. label: what it defines, for screen readers. */
export default function InfoTip({ title, label }) {
  return (
    <Tooltip title={title} enterTouchDelay={0} leaveTouchDelay={6000}>
      <Box
        component="button"
        type="button"
        aria-label={`About ${label}`}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          verticalAlign: "middle",
          // Small to look at, 24px to hit.
          width: 24,
          height: 24,
          m: "-5px 0",
          p: 0,
          border: 0,
          borderRadius: "50%",
          bgcolor: "transparent",
          color: "text.secondary",
          cursor: "help",
          "&:hover, &:focus-visible": { color: "primary.main" },
        }}
      >
        <InfoIcon />
      </Box>
    </Tooltip>
  );
}
