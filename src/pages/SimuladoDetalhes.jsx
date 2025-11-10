// src/pages/SimuladoDetalhes.jsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";

export default function SimuladoDetalhes() {
  const { id } = useParams();
  const [simulado, setSimulado] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from("simulados")
        .select("*")
        .eq("id", id)
        .single();

      if (error) console.error(error);
      else setSimulado(data);
      setLoading(false);
    }
    carregar();
  }, [id]);

  if (loading)
    return (
      <div className="text-center text-white mt-20">Carregando detalhes...</div>
    );

  if (!simulado)
    return (
      <div className="text-center text-white mt-20">Simulado não encontrado.</div>
    );

  const metadata =
    typeof simulado.metadata === "string"
      ? JSON.parse(simulado.metadata)
      : simulado.metadata || {};

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange text-white pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-lg">
          <h1 className="text-3xl font-bold mb-4">{simulado.title}</h1>
          <p className="text-white/80 mb-6">{simulado.description}</p>

          <div className="space-y-3 mb-8 text-sm">
            <p>
              <strong>Matérias:</strong>{" "}
              {metadata.materias?.join(", ") || "Não especificado"}
            </p>
            <p>
              <strong>Tipo:</strong> {metadata.tipo || "Misto"}
            </p>
            <p>
              <strong>Perguntas:</strong> {metadata.perguntas || "10"}
            </p>
            <p>
              <strong>Duração:</strong> {simulado.duration || "30"} minutos
            </p>
          </div>

          <div className="flex justify-between items-center">
            <Link
              to="/simulados"
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg"
            >
              ← Voltar
            </Link>

            <button
              onClick={() => navigate(`/simulados/${id}/iniciar`)}
              className="bg-gradient-to-r from-brandBlue to-brandGreen hover:opacity-90 text-white px-6 py-2 rounded-lg font-semibold"
            >
              Iniciar simulado
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
