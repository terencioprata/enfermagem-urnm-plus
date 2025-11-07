import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "../components/Layout";

const posts = [
  /* mesmos posts de antes */
];

export default function Post() {
  const { id } = useParams();
  const post = posts.find((p) => p.id === Number(id));

  if (!post) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h1 className="text-3xl font-bold mb-4">Post não encontrado 🧐</h1>
          <Link
            to="/blog"
            className="text-brandBlue dark:text-brandGreen underline hover:opacity-80"
          >
            Voltar ao blog
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <motion.img
          src={post.image}
          alt={post.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="w-full h-64 object-cover rounded-2xl shadow-lg mb-8"
        />

        <motion.h1
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7 }}
          className="text-3xl font-bold mb-4"
        >
          {post.title}
        </motion.h1>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          📅 {post.date}
        </p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="prose dark:prose-invert max-w-none leading-relaxed"
          dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, "<br/>") }}
        />

        <div className="mt-10">
          <Link
            to="/blog"
            className="inline-block mt-6 bg-white/20 dark:bg-gray-800/40 text-white py-2 px-4 rounded-lg border border-white/30 hover:bg-white/30 hover:scale-105 transition"
          >
            ← Voltar para o Blog
          </Link>
        </div>
      </div>
    </Layout>
  );
}
