import { Container, Link } from "@mui/material";
import { Link as RouterLink, useLocation, useParams } from "react-router-dom";
import GameDetails from "../components/GameDetails.jsx";
import { contentWidth } from "../theme.js";

function BackLink() {
  const { search } = useLocation();
  return (
    <Link
      component={RouterLink}
      to={{ pathname: "/", search }}
      underline="none"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        minHeight: 44,
        alignSelf: "flex-start",
        fontWeight: 600,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 3 L5 8 L10 13" />
      </svg>
      All games
    </Link>
  );
}

/** Single game view as a full page: direct loads, refreshes, new tabs. */
export default function Game() {
  const { id } = useParams();
  return (
    <Container maxWidth={false} sx={{ maxWidth: contentWidth, py: 3 }}>
      <GameDetails key={id} id={id} header={<BackLink />} replay />
    </Container>
  );
}
