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
import Records from "../components/Records.jsx";

/** Solo tab (brief 6, brief-v3 item 6), sections top to bottom. */
export default function Dashboard() {
  const [filters] = useFilters();
  // One request serves the tiles, the By window table and Records.
  const summary = useApi("/summary", {
    ...filters,
    since30: localMidnightDaysAgo(30),
  });
  return (
    <Stack spacing={3}>
      <FilterBar />
      <HeadlineTiles summary={summary} />
      <Calendar />
      <OverTime />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        <ByWindow summary={summary} />
        <Records summary={summary} />
      </Box>
      <GamesList />
    </Stack>
  );
}
