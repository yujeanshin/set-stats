import { Container, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useLocation, useParams } from "react-router-dom";
import { contentWidth } from "../theme.js";

/** Single game view (brief 7). Filled in at build step 8. */
export default function Game() {
  const { id } = useParams();
  const { search } = useLocation();
  return (
    <Container maxWidth={false} sx={{ maxWidth: contentWidth, py: 3 }}>
      <Stack spacing={3}>
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
        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontFamily: "mono",
            fontSize: 14,
            fontWeight: 400,
            color: "text.secondary",
          }}
        >
          {id}
        </Typography>
      </Stack>
    </Container>
  );
}
