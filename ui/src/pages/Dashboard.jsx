import { Stack } from "@mui/material";
import FilterBar from "../components/FilterBar.jsx";

/** Solo tab (brief 6). Sections are added one per build step. */
export default function Dashboard() {
  return (
    <Stack spacing={3}>
      <FilterBar />
    </Stack>
  );
}
