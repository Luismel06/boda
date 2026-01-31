import { Routes, Route, Navigate } from "react-router-dom";
import Invite from "./pages/Invite";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Invite />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}