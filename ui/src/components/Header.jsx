import { Box, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "../api.js";
import { fullDateTime, relativeTime, shortWhen } from "../format.js";
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

/** The current time, updated every minute so "3 minutes ago" stays true. */
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * "Data updated 2:41 PM (3 minutes ago)": when bin/rebuild.js last ran,
 * which is when what the UI shows last changed (brief-v3 item 2). A
 * button so the tooltip with the full time and the last sync can be
 * reached by keyboard and touch. A database not rebuilt since
 * last_rebuild_at was added shows "Last synced" as before.
 */
function DataUpdated({ meta }) {
  const now = useNow();
  if (!meta) return <span>Data updated …</span>;
  const rebuilt = meta.last_rebuild_at;
  const synced = meta.last_sync_at;
  if (rebuilt == null)
    return <span>Last synced {relativeTime(synced, now)}</span>;
  const syncText =
    synced == null
      ? "Never synced."
      : `Last synced ${fullDateTime(synced)} (${relativeTime(synced, now)}).`;
  return (
    <Tooltip
      title={`Data updated ${fullDateTime(rebuilt)}, when npm run rebuild or rebuild:new last finished. ${syncText}`}
      enterTouchDelay={0}
      leaveTouchDelay={6000}
    >
      <Box
        component="button"
        type="button"
        sx={{
          minHeight: 44,
          p: 0,
          border: 0,
          bgcolor: "transparent",
          font: "inherit",
          color: "inherit",
          cursor: "help",
          textAlign: "right",
          textDecoration: "underline dotted",
          textUnderlineOffset: "3px",
        }}
      >
        Data updated {shortWhen(rebuilt, now)} ({relativeTime(rebuilt, now)})
      </Box>
    </Tooltip>
  );
}

/** App name, Solo / Set types / Multiplayer tabs, data updated time (brief 6.1, brief-v3 item 2). */
export default function Header() {
  const { pathname, search } = useLocation();
  const tab =
    ["/types", "/multiplayer"].find((t) => pathname.startsWith(t)) ?? "/";
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
        <Tabs value={tab} aria-label="Pages" sx={{ ml: 2, minHeight: 44 }}>
          <Tab
            label="Solo"
            value="/"
            component={Link}
            to={{ pathname: "/", search }}
          />
          <Tab
            label="Set types"
            value="/types"
            component={Link}
            to={{ pathname: "/types", search }}
          />
          <Tab
            label="Multiplayer"
            value="/multiplayer"
            component={Link}
            to={{ pathname: "/multiplayer", search }}
          />
        </Tabs>
        <Typography variant="body2" color="text.secondary" sx={{ ml: "auto" }}>
          <DataUpdated meta={meta.data} />
        </Typography>
      </Box>
    </Box>
  );
}
