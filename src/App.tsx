// App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import Portal2D from "./pages/Portal";
import Invite from "./pages/Invite";
import Admin from "./pages/Admin";
export default function App() {
  return (
      <Routes>
        <Route path="/" element={<Portal2D />} />
        <Route path="/invite" element={<Invite />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
  );
}