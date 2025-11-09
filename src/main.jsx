import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App.jsx";
import Blog from "./pages/Blog.jsx";
import Post from "./pages/Post.jsx";
import Simulados from "./pages/Simulados.jsx";

// ✅ Import opcional do painel admin (só se o arquivo existir)
import AdminDashboard from "./pages/AdminDashboard.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename="/enfermagem-urnm-plus/">
      <Routes>
        {/* Roteamento principal */}
        <Route path="/" element={<App />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:id" element={<Post />} />
        <Route path="/simulados" element={<Simulados />} />

        {/* ✅ Painel administrativo isolado */}
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
