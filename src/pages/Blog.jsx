// src/pages/Blog.jsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { posts as allPosts } from "../data/posts";
import { motion } from "framer-motion";
import Layout from "../components/Layout"; // ✅ para incluir navbar e footer

export default function Blog() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 6;

  // pesquisa simples (título + resumo)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q)
      return allPosts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    return allPosts
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handlePrev = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <Layout>
      <div className="min-h-screen pt-24 pb-12 px-6 bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange text-gray-900 dark:text-gray-100">
        <div className="max-w-6xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-center mb-8 text-white drop-shadow-lg"
          >
            🩺 Blog de Enfermagem URNM+
          </motion.h1>

          {/* Search + summary centralizados */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-full sm:w-2/3">
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Pesquisar posts (título ou resumo)..."
                className="w-full rounded-lg px-4 py-3 shadow-sm outline-none text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-brandGreen"
              />
            </div>

            <div className="text-sm text-white/90">
              {filtered.length} post(s) • Página {page} de {totalPages}
            </div>
          </div>

          {/* Lista de posts */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {paginated.map((post) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden border border-white/10 hover:scale-[1.02] transition-transform"
              >
                <Link to={`/blog/${post.id}`} className="block">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-44 object-cover"
                  />
                  <div className="p-5 text-white">
                    <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
                    <p className="text-sm text-white/80 mb-4">{post.excerpt}</p>
                    <div className="flex justify-between items-center text-sm text-white/70">
                      <span>{new Date(post.date).toLocaleDateString()}</span>
                     <span
  className="inline-block border border-brandBlue dark:border-brandGreen text-brandBlue dark:text-brandGreen 
  px-3 py-1 rounded-lg font-medium hover:bg-brandBlue hover:dark:bg-brandGreen hover:text-white 
  transition-colors duration-300"
>  Ler mais →
                      </span>

                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>

          {/* Paginação */}
          <div className="mt-10 flex justify-center items-center gap-4">
            <button
              onClick={handlePrev}
              disabled={page === 1}
              className="px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white"
            >
              Anterior
            </button>
            <div className="text-sm text-white/80">
              {page} / {totalPages}
            </div>
            <button
              onClick={handleNext}
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
