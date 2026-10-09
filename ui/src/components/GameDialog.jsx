// A game opened from the games list, shown over the list (see App.jsx).
// The URL is the game's own route; closing goes back to the list entry.
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Link,
  useMediaQuery,
} from "@mui/material";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import GameDetails from "./GameDetails.jsx";

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 3 L13 13 M13 3 L3 13" />
    </svg>
  );
}

export default function GameDialog() {
  const { id } = useParams();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down("sm"));
  // Opened by a push from the list, so back is the list, scroll and all.
  const close = () => navigate(-1);
  const header = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {/* No background state, so this renders the page version. */}
      <Link
        component={RouterLink}
        to={{ pathname, search }}
        replace
        underline="hover"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 44,
          fontWeight: 600,
        }}
      >
        Open full page
      </Link>
      <IconButton
        aria-label="Close"
        onClick={close}
        sx={{ ml: "auto", width: 44, height: 44 }}
      >
        <CloseIcon />
      </IconButton>
    </Box>
  );
  return (
    <Dialog
      open
      onClose={close}
      fullWidth
      maxWidth="lg"
      fullScreen={fullScreen}
      aria-labelledby="game-dialog-title"
    >
      <DialogContent sx={{ pt: 1.5 }}>
        <GameDetails id={id} header={header} titleId="game-dialog-title" />
      </DialogContent>
    </Dialog>
  );
}
