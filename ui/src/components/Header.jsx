import { Box, Tab, Tabs, Typography } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "../api.js";
import { relativeTime } from "../format.js";
import { contentWidth } from "../theme.js";
import SquiggleIcon from "./SquiggleIcon.jsx";

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="22"
        height="22"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <SquiggleIcon x="9" y="5" size={8} />
    </svg>
  );
}

/** App name, Solo / Multiplayer tabs, last sync time (brief 6.1). */
export default function Header() {
  const { pathname, search } = useLocation();
  const tab = pathname.startsWith("/multiplayer") ? "/multiplayer" : "/";
  const meta = useApi("/meta");
  return (
    <Box
      component="header"
      sx={{
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          maxWidth: contentWidth,
          mx: "auto",
          px: 3,
          minHeight: 64,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            color: "primary.main",
          }}
        >
          <Logo />
          <Typography
            component="span"
            sx={{ fontSize: 20, fontWeight: 700, color: "text.primary" }}
          >
            set stats
          </Typography>
        </Box>
        <Tabs value={tab} aria-label="Game type" sx={{ ml: 2, minHeight: 44 }}>
          <Tab
            label="Solo"
            value="/"
            component={Link}
            to={{ pathname: "/", search }}
          />
          <Tab
            label="Multiplayer"
            value="/multiplayer"
            component={Link}
            to={{ pathname: "/multiplayer", search }}
          />
        </Tabs>
        <Typography variant="body2" color="text.secondary" sx={{ ml: "auto" }}>
          Last synced {meta.data ? relativeTime(meta.data.last_sync_at) : "…"}
        </Typography>
      </Box>
    </Box>
  );
}
