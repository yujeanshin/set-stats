import { Box, Stack } from "@mui/material";
import { useApi } from "../api.js";
import ByWindow from "../components/ByWindow.jsx";
import Calendar from "../components/Calendar.jsx";
import FilterBar from "../components/FilterBar.jsx";
import GamesList from "../components/GamesList.jsx";
import HeadlineTiles from "../components/HeadlineTiles.jsx";
import { useFilters } from "../filters.js";
import { localMidnightDaysAgo } from "../format.js";
import OverTime from "../components/OverTime.jsx";
import Positions from "../components/Positions.jsx";
import Records from "../components/Records.jsx";

/** Solo tab (brief 6), sections top to bottom. */
export default function Dashboard() {
  const [filters] = useFilters();
  // One request serves the tiles and the By window table.
  const summary = useApi("/summary", {
    ...filters,
    since30: localMidnightDaysAgo(30),
  });
  const normal = summary.data?.mode === "normal";
  return (
    <Stack spacing={3}>
      <FilterBar />
      <HeadlineTiles summary={summary} />
      <Calendar />
      <OverTime />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {/* The position heatmap is normal mode only (brief 6.7). */}
        <ByWindow summary={summary} alone={!normal} />
        <Records summary={summary} />
        {normal ? <Positions /> : null}
      </Box>
      <GamesList />
    </Stack>
  );
}
