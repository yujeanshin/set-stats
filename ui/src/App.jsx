import { Container } from "@mui/material";
import { Outlet, Route, Routes } from "react-router-dom";
import Header from "./components/Header.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Game from "./pages/Game.jsx";
import Multiplayer from "./pages/Multiplayer.jsx";
import { contentWidth } from "./theme.js";

/** Header plus the 1120px content column used by the two tabs. */
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
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="multiplayer" element={<Multiplayer />} />
      </Route>
      <Route path="games/:id" element={<Game />} />
    </Routes>
  );
}
