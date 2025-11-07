import { motion } from "framer-motion";
import Navbar from "../components/Navbar";

const simulados = [
  {
    id: 1,
    title: "Simulado de Anatomia",
    description: "Teste seus conhecimentos de anatomia com questões teóricas e práticas.",
    date: "5 de Novembro, 2025",
  },
  {
    id: 2,
    title: "Simulado de Fisiologia",
    description: "Pratique e revise conteúdos essenciais de fisiologia clínica.",
    date: "3 de Novembro, 2025",
  },
  {
    id: 3,
    title: "Simulado de Ética e Legislação em Enfermagem",
    description: "Avalie sua compreensão sobre ética e normas profissionais.",
    date: "1 de Novembro, 2025",
  },
  {
    id: 4,
    title: "Simulado de Técnicas de Enfermagem",
    description: "Exercite habilidades práticas e teóricas das técnicas de enfermagem.",
    date: "30 de Outubro, 2025",
  },
];

export default function Simulados() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-all pt-24 pb-16 px-6 text-gray-900 dark:text-gray-100">
      <Navbar />

      <div className="max-w-6xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-4xl font-bold text-center mb-10"
        >
          📝 Simulados de Enfermagem URNM+
        </motion.h1>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {simulados.map((simulado) => (
            <motion.div
              key={simulado.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: simulado.id * 0.1 }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-md hover:shadow-xl transition-all p-6 flex flex-col justify-between"
            >
              <div>
                <h2 className="text-xl font-semibold mb-2 text-brandBlue dark:text-brandGreen">
                  {simulado.title}
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  {simulado.description}
                </p>
              </div>
              <div className="flex justify-between items-center mt-4 text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  {simulado.date}
                </span>
                <button className="bg-brandBlue dark:bg-brandGreen text-white px-4 py-1 rounded-lg hover:opacity-90 transition">
                  Iniciar →
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
