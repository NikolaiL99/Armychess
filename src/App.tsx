import { Route, Routes } from "react-router-dom";
import { LocalGame, NotFound, OnlineGame } from "./components/Game";
import { Lobby } from "./components/Lobby";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/local" element={<LocalGame />} />
      <Route path="/g/:code" element={<OnlineGame />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
