import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App.jsx";
import Blog from "./pages/Blog.jsx";
import Post from "./pages/Post.jsx";
import Simulados from "./pages/Simulados.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* basename ajustado para o repositório */}
    <BrowserRouter basename="/enfermagem-urnm-plus/">
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:id" element={<Post />} />
        <Route path="/simulados" element={<Simulados />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
