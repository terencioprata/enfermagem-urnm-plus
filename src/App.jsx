import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaInstagram, FaFacebook, FaLinkedin, FaWhatsapp } from "react-icons/fa";
import Layout from "./components/Layout";
import { Link } from "react-router-dom";
import NewsletterForm from "./components/NewsletterForm";
import { supabase } from "./supabaseClient"; // 🔹 importa a conexão do Supabase

/* Conteúdos locais (fixos) */
const simulados = [
  { id: 1, title: "Anatomia - Simulado Rápido", date: "5 Nov, 2025", time: "30 min" },
  { id: 2, title: "Fisiologia - Simulado Essencial", date: "3 Nov, 2025", time: "40 min" },
  { id: 3, title: "Técnicas - Simulado Prático", date: "1 Nov, 2025", time: "25 min" },
];

export default function App() {
  const [featuredPosts, setFeaturedPosts] = useState([]);

  useEffect(() => {
    async function loadFeatured() {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("featured", true)
        .order("created_at", { ascending: false });

      if (error) console.error("Erro ao carregar posts destacados:", error);
      else setFeaturedPosts(data);
    }

    loadFeatured();
  }, []);

  return (
    <Layout>
      {/* HERO */}
      <header className="pt-12 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4 text-white drop-shadow-lg"
        >
          Enfermagem URNM+ <span className="text-brandGreen">|</span> Simulados & Blog
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl max-w-3xl mx-auto text-white/90 mb-6"
        >
          Plataforma criada para estudantes do 3.º ano de Enfermagem — simulados, resumos, dicas
          práticas e conteúdos para te preparar para exames e para a prática clínica.
        </motion.p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
          <Link to="/simulados" className="inline-flex items-center gap-3 bg-brandBlue hover:bg-brandBlue/90 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition">
            Fazer Simulado
          </Link>
          <Link to="/blog" className="inline-flex items-center gap-3 bg-white/90 hover:bg-white/95 text-brandBlue font-semibold px-6 py-3 rounded-xl shadow transition">
            Ler o Blog
          </Link>
          <a href="https://wa.me/244921639010" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-xl shadow transition">
            <FaWhatsapp /> Contactar (WhatsApp)
          </a>
        </div>
      </header>

      {/* BENEFÍCIOS */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <motion.h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-6" initial={{opacity:0}} whileInView={{opacity:1}}>
          Por que usar o Enfermagem URNM+?
        </motion.h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: "Simulados práticos", text: "Questões organizadas por matéria com correção ao final e nota de 0–20." },
            { title: "Material focado", text: "Conteúdos alinhados ao 3.º ano de Enfermagem e aos exames da URNM." },
            { title: "Rápido & acessível", text: "Acesse de qualquer dispositivo e treine nos melhores horários." },
            { title: "Suporte e anúncios", text: "Publicidade e serviços (cartões VISA, importação) disponíveis via WhatsApp." }
          ].map((item, i) => (
            <motion.div key={i} whileHover={{ y: -6 }} className="bg-white/10 p-6 rounded-2xl shadow backdrop-blur">
              <h3 className="font-semibold text-lg mb-2 text-white">{item.title}</h3>
              <p className="text-sm text-white/80">{item.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <motion.h3 className="text-2xl font-bold text-white mb-6 text-center" initial={{opacity:0}} whileInView={{opacity:1}}>Como funciona</motion.h3>
        <div className="grid md:grid-cols-3 gap-6">
          {["Escolhe a matéria e o simulado.", "Faz o simulado.", "Recebe a correção."].map((t, i) => (
            <div key={i} className="p-6 bg-white/5 rounded-2xl text-white">
              <strong>{i + 1}.</strong> {t}
            </div>
          ))}
        </div>
      </section>

      {/* 🔹 POSTS DESTACADOS (controlados pelo painel) */}
      {featuredPosts.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-8">
          {featuredPosts.map((post) => (
            <motion.div
              key={post.id}
              className="rounded-2xl p-6 md:p-10 bg-gradient-to-r from-black/30 via-brandBlue/30 to-brandGreen/20 border border-white/10 mb-6"
              initial={{ scale: 0.98 }}
              whileInView={{ scale: 1 }}
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h4 className="text-xl font-bold text-white mb-2">{post.title}</h4>
                  <p className="text-white/85 mb-3">{post.excerpt}</p>
                  <Link
                    to={`/post/${post.id}`}
                    className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-lg font-semibold transition"
                  >
                    Ver mais
                  </Link>
                </div>
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="w-40 h-28 object-cover rounded-xl shadow-md"
                  />
                )}
              </div>
            </motion.div>
          ))}
        </section>
      )}

      {/* SIMULADOS EM DESTAQUE */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <h3 className="text-2xl font-bold text-white mb-6">Simulados em destaque</h3>
        <div className="grid sm:grid-cols-3 gap-6">
          {simulados.map((s) => (
            <motion.div key={s.id} whileHover={{ y: -6 }} className="bg-white/8 p-5 rounded-2xl text-white">
              <h4 className="font-semibold text-lg">{s.title}</h4>
              <p className="text-sm text-white/80">{s.date} • {s.time}</p>
              <div className="mt-4">
                <Link to="/simulados" className="inline-block bg-brandBlue px-4 py-2 rounded-md font-medium text-white hover:bg-brandBlue/90">Iniciar</Link>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="max-w-3xl mx-auto px-6 py-8 text-center">
        <h4 className="text-xl font-bold text-white mb-3">Receba novidades por email</h4>
        <p className="text-white/85 mb-4">Inscreve-te para receber avisos sobre novos simulados e formações.</p>
        <NewsletterForm />
      </section>

      {/* FOOTER */}
      <footer className="mt-12 border-t border-white/10 py-6 text-sm text-white/80">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="font-semibold">Enfermagem URNM+</div>
            <div className="text-xs">Universidade Rainha Nginga a Mbande — Suporte via WhatsApp</div>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://www.instagram.com/launchbox01" target="_blank" rel="noreferrer" className="text-white/90"><FaInstagram /></a>
            <a href="https://web.facebook.com/terencioprataoficial" target="_blank" rel="noreferrer" className="text-white/90"><FaFacebook /></a>
            <a href="https://www.linkedin.com/in/ter%C3%AAncio-prata-67330118a/" target="_blank" rel="noreferrer" className="text-white/90"><FaLinkedin /></a>
            <a href="https://wa.me/244921639010" target="_blank" rel="noreferrer" className="text-white/90"><FaWhatsapp /></a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 mt-4 text-center text-xs text-white/70">
          © {new Date().getFullYear()} Enfermagem URNM+ — Desenvolvido por Terêncio Prata
        </div>
      </footer>
    </Layout>
  );
}
