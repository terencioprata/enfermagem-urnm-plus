// src/pages/Blog.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { posts as localPosts } from "../data/posts";
import { supabase } from "../supabaseClient";
import { motion } from "framer-motion";
import Layout from "../components/Layout";

export default function Blog() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [remotePosts, setRemotePosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const perPage = 6;

  useEffect(() => {
    let mounted = true;
    async function loadPosts() {
      try {
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (mounted) setRemotePosts(data || []);
      } catch (err) {
        console.error("Erro ao buscar posts:", err);
        if (mounted) setRemotePosts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadPosts();
    return () => (mounted = false);
  }, []);

  const allPosts = useMemo(() => {
    const normalizeRemote = (p) => ({
      id: p.id,
      title: p.title,
      excerpt: p.excerpt,
      content: p.content,
      image: p.image_url || p.image || "https://via.placeholder.com/800x400?text=Sem+Imagem",
      date: p.created_at || p.date,
      featured: !!p.featured,
      source: "remote",
    });
    const normalizeLocal = (p) => ({
      id: p.id,
      title: p.title,
      excerpt: p.excerpt,
      content: p.content,
      image: p.image || "https://via.placeholder.com/800x400?text=Sem+Imagem",
      date: p.date,
      featured: !!p.featured,
      source: "local",
    });

    const remote = (remotePosts || []).map(normalizeRemote);
    const local = (localPosts || []).map(normalizeLocal);

    const map = new Map();
    remote.forEach((r) => map.set(`remote-${r.id}`, r));
    local.forEach((l) => map.set(`local-${l.id}`, l));

    return Array.from(map.values());
  }, [remotePosts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = allPosts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!q) return sorted;
    return sorted.filter((p) =>
      (p.title || "").toLowerCase().includes(q) ||
      (p.excerpt || "").toLowerCase().includes(q)
    );
  }, [query, allPosts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <Layout>
      <div className="min-h-screen pt-24 pb-12 px-6 bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange text-white">
        <div className="max-w-6xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-center mb-8 drop-shadow-lg"
          >
            🩺 Blog de Enfermagem URNM+
          </motion.h1>

          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-full sm:w-2/3">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Pesquisar posts..."
                className="w-full rounded-lg px-4 py-3 shadow-sm outline-none text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brandGreen"
              />
            </div>

            <div className="text-sm text-white/90">
              {loading
                ? "Carregando..."
                : `${filtered.length} post(s) • Página ${page} de ${totalPages}`}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {paginated.map((post) => {
              const path = `${post.source}-${post.id}`;
              return (
                <motion.article
                  key={path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden border border-white/10 hover:scale-[1.02] transition-transform"
                >
                  <Link to={`/blog/${path}`} className="block">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-44 object-cover"
                    />
                    <div className="p-5">
                      <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
                      <p className="text-sm text-white/80 mb-4">{post.excerpt}</p>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/70">{new Date(post.date).toLocaleDateString()}</span>

                        {/* Botão mais destacado */}
                        <span className="inline-block px-4 py-2 rounded-lg font-semibold border border-white bg-gradient-to-r from-brandGreen to-brandBlue text-white shadow-md hover:shadow-xl hover:from-brandBlue hover:to-brandGreen hover:scale-105 transition-all duration-300">
                          Ler mais →
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.article>
              );
            })}
          </div>

          <div className="mt-10 flex justify-center items-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white"
            >
              Anterior
            </button>
            <div className="text-sm">{page} / {totalPages}</div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
