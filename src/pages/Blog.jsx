import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";

const posts = [
  /* mesmos posts de antes */
];

export default function Blog() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-4xl font-bold text-center mb-10"
        >
          🩺 Blog de Enfermagem URNM+
        </motion.h1>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: post.id * 0.1 }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden"
            >
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-5">
                <h2 className="text-xl font-semibold mb-2 hover:text-brandGreen dark:hover:text-brandOrange transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  {post.excerpt}
                </p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {post.date}
                  </span>
                  <Link
                    to={`/blog/${post.id}`}
                    className="text-brandBlue dark:text-brandGreen hover:underline"
                  >
                    Ler mais →
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
