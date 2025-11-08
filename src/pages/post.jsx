// src/pages/Post.jsx
import { useParams, Link } from "react-router-dom";
import { posts } from "../data/posts";
import { motion } from "framer-motion";

export default function Post() {
  const { id } = useParams();
  const post = posts.find((p) => p.id === Number(id));

  if (!post) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-6 bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange flex items-center justify-center">
        <div className="max-w-2xl text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Post não encontrado</h2>
          <Link to="/blog" className="underline">Voltar ao blog</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-6 bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange text-gray-900 dark:text-gray-100">
      <div className="max-w-4xl mx-auto">
        <motion.img
          src={post.image}
          alt={post.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full h-64 object-cover rounded-2xl shadow-lg mb-8"
        />

        <motion.h1 initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }} className="text-3xl font-bold mb-4">
          {post.title}
        </motion.h1>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">📅 {new Date(post.date).toLocaleDateString()}</p>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="prose dark:prose-invert max-w-none leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </motion.div>

        <div className="mt-10">
          <Link to="/blog" className="inline-block mt-6 bg-white/20 dark:bg-gray-800/40 text-white py-2 px-4 rounded-lg border border-white/30 hover:bg-white/30 hover:scale-105 transition">
            ← Voltar ao Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
