import { Container } from "@mui/material";
import { useState } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import GameDialog from "./components/GameDialog.jsx";
import Header from "./components/Header.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Game from "./pages/Game.jsx";
import Multiplayer from "./pages/Multiplayer.jsx";
import Types from "./pages/Types.jsx";
import { contentWidth } from "./theme.js";

/** Header plus the 1120px content column used by the tabs. */
function Shell() {
  return (
    <>
      <Header />
      <Container maxWidth={false} sx={{ maxWidth: contentWidth, py: 3 }}>
        <Outlet />
      </Container>
    </>
  );
}

export default function App() {
  const location = useLocation();
  // A game opened from the games list carries the list's location in its
  // state, so the list stays rendered and the game shows as a dialog over it.
  // History state survives a reload, so ignore it on the entry the page was
  // loaded on: a refresh or a pasted link gets the full page.
  const [loadedKey] = useState(location.key);
  const background =
    location.key === loadedKey ? null : location.state?.backgroundLocation;
  return (
    <>
      <Routes location={background ?? location}>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="types" element={<Types />} />
          <Route path="multiplayer" element={<Multiplayer />} />
        </Route>
        <Route path="games/:id" element={<Game />} />
      </Routes>
      {background ? (
        <Routes>
          <Route path="games/:id" element={<GameDialog />} />
        </Routes>
      ) : null}
    </>
  );
}
