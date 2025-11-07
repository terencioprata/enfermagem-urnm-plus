import { motion } from "framer-motion";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Bem-vindo, ${email}! (login simulado)`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange text-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-all duration-700 font-sans relative">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="w-full max-w-md bg-white/10 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-8"
      >
        <h2 className="text-3xl font-bold text-center mb-6">Acesso à Plataforma</h2>

        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <input
            type="email"
            placeholder="Digite seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 rounded-lg bg-white/80 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brandGreen"
            required
          />
          <input
            type="password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-3 rounded-lg bg-white/80 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brandGreen"
            required
          />

          <button
            type="submit"
            className="mt-4 bg-brandGreen hover:bg-brandOrange transition-colors text-white font-semibold py-3 rounded-lg"
          >
            Entrar
          </button>
        </form>

        <p className="text-sm text-center mt-6 text-gray-200 dark:text-gray-400">
          Esqueceu sua senha?{" "}
          <a href="#" className="underline hover:text-brandOrange">
            Recuperar acesso
          </a>
        </p>
      </motion.div>
    </div>
  );
}
