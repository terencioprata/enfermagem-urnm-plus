// src/pages/ResultadosSimulado.jsx
import { useLocation, Link } from "react-router-dom";
import Layout from "../components/Layout";

export default function ResultadosSimulado() {
  const location = useLocation();
  const { simulado, acertos, total } = location.state || {};
  const nota = Math.round((acertos / total) * 20);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange text-white flex flex-col justify-center items-center px-6">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-lg w-full max-w-2xl text-center">
          <h1 className="text-3xl font-bold mb-6">🎉 Resultado Final</h1>
          <p className="text-lg mb-2">{simulado?.title}</p>
          <p className="text-2xl font-semibold mb-4">
            Você acertou {acertos} de {total} questões
          </p>
          <p className="text-3xl font-bold text-amber-400 mb-8">
            Nota: {nota}/20
          </p>

          <div className="flex justify-center gap-4">
            <Link
              to="/simulados"
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg"
            >
              ← Voltar aos simulados
            </Link>

            <a
              href="https://wa.me/244921639010?text=Olá%20gostei%20do%20simulado!"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-brandBlue to-brandGreen px-4 py-2 rounded-lg font-semibold"
            >
              Contatar o criador
            </a>
          </div>

          <p className="text-sm text-white/70 mt-6">
            Sugira novas matérias ou dê seu feedback para melhorar os próximos
            simulados.
          </p>
        </div>
      </div>
    </Layout>
  );
}
