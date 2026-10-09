import { Paper, Typography } from "@mui/material";

/** Multiplayer tab: empty state only in this version (brief 2). */
export default function Multiplayer() {
  return (
    <Paper
      component="section"
      aria-label="Multiplayer"
      sx={{ p: 5, textAlign: "center" }}
    >
      <Typography variant="h2" component="h2">
        No multiplayer stats yet
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        This version covers solo games only. Multiplayer stats are planned for a
        later version.
      </Typography>
    </Paper>
  );
}
