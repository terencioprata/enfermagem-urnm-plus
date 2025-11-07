import { motion } from "framer-motion";
import Layout from "./components/Layout";
import { FaInstagram, FaFacebook, FaLinkedin } from "react-icons/fa";

const blogPosts = [
  {
    id: 1,
    title: "Cuidados de Enfermagem na Unidade de Internamento",
    excerpt:
      "Aprenda as boas práticas e protocolos essenciais para o cuidado hospitalar e segurança do paciente.",
    image:
      "https://images.unsplash.com/photo-1580281657521-9de073b1d1dc?auto=format&fit=crop&w=800&q=60",
    date: "5 de Novembro, 2025",
  },
  {
    id: 2,
    title: "Diferença entre sinais e sintomas — guia rápido",
    excerpt:
      "Um resumo prático para estudantes de enfermagem que querem dominar a semiologia clínica.",
    image:
      "https://images.unsplash.com/photo-1612277791397-1acdf7d50724?auto=format&fit=crop&w=800&q=60",
    date: "3 de Novembro, 2025",
  },
  {
    id: 3,
    title: "Como preparar-se para exames teóricos de Enfermagem Geral",
    excerpt:
      "Dicas e estratégias para melhorar seu desempenho em avaliações e simulados.",
    image:
      "https://images.unsplash.com/photo-1623059397354-9fdb7b1d73a3?auto=format&fit=crop&w=800&q=60",
    date: "1 de Novembro, 2025",
  },
];

export default function App() {
  return (
    <Layout>
      {/* Seção inicial */}
      <section className="text-center mt-12 px-4">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-4xl font-bold mb-4 drop-shadow-lg"
        >
          Enfermagem URNM+ | Simulados & Blog
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="text-lg max-w-xl mx-auto drop-shadow-md"
        >
          🎓 Bem-vindo(a) ao portal de aprendizagem da Universidade Rainha Nginga a Mbande.
          Aqui você pode estudar, fazer simulados e acompanhar o blog educativo.
        </motion.p>
      </section>

      {/* Sobre o site */}
      <section className="mt-16 px-6 max-w-4xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-3xl font-semibold mb-4"
        >
          Sobre o site
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-lg text-white/90"
        >
          Este portal foi desenvolvido para estudantes de Enfermagem, com foco em simulados
          teóricos, dicas de estudo e conteúdos educativos do curso de Enfermagem Geral na URNM.
          Nosso objetivo é facilitar o aprendizado e tornar o estudo mais interativo e moderno.
        </motion.p>
      </section>

      {/* Sobre mim / autor */}
      <section className="mt-16 px-6 max-w-4xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-3xl font-semibold mb-4"
        >
          Sobre mim
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-lg text-white/90"
        >
          Olá! Sou Terêncio Prata, responsável por criar este portal educativo.
          Minha missão é disponibilizar conteúdos claros e práticos para estudantes de Enfermagem,
          tornando o aprendizado mais acessível e interessante.
        </motion.p>
      </section>

      {/* Redes sociais */}
      <section className="mt-12 flex justify-center space-x-6">
        {[
          { icon: FaInstagram, link: "https://instagram.com" },
          { icon: FaFacebook, link: "https://facebook.com" },
          { icon: FaLinkedin, link: "https://linkedin.com" },
        ].map((social, index) => (
          <motion.a
            key={index}
            whileHover={{ scale: 1.3, rotate: 10 }}
            transition={{ type: "spring", stiffness: 300 }}
            href={social.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white text-2xl"
          >
            <social.icon />
          </motion.a>
        ))}
      </section>

      {/* Blog */}
      <section className="mt-20 px-6 max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-3xl font-bold text-center mb-10"
        >
          🩺 Últimos posts do Blog
        </motion.h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogPosts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ duration: 0.5 }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-md hover:shadow-xl overflow-hidden cursor-pointer"
            >
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-5">
                <h3 className="text-xl font-semibold mb-2 hover:text-brandGreen dark:hover:text-brandOrange transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  {post.excerpt}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">
                  {post.date}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
