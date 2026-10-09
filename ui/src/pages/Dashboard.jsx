import { Stack } from "@mui/material";
import { useApi } from "../api.js";
import Calendar from "../components/Calendar.jsx";
import FilterBar from "../components/FilterBar.jsx";
import HeadlineTiles from "../components/HeadlineTiles.jsx";
import { useFilters } from "../filters.js";
import { localMidnightDaysAgo } from "../format.js";
import OverTime from "../components/OverTime.jsx";

/** Solo tab (brief 6). Sections are added one per build step. */
export default function Dashboard() {
  const [filters] = useFilters();
  // One request serves the tiles now and the By window table later.
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
    </Stack>
  );
}
