// src/pages/SalaDeProva.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";

export default function SalaDeProva() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [simulado, setSimulado] = useState(null);
  const [perguntas, setPerguntas] = useState([]);
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [terminou, setTerminou] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from("simulados")
        .select("*")
        .eq("id", id)
        .single();
      if (data) {
        setSimulado(data);
        const meta =
          typeof data.metadata === "string"
            ? JSON.parse(data.metadata)
            : data.metadata;
        setPerguntas(meta.perguntasLista || []);
      }
    }
    carregar();
  }, [id]);

  if (!simulado)
    return (
      <div className="text-center text-white mt-20">Carregando simulado...</div>
    );

  const perguntaAtual = perguntas[indice];

  function selecionarResposta(resposta) {
    setRespostas({ ...respostas, [indice]: resposta });
  }

  function proximaPergunta() {
    if (indice + 1 < perguntas.length) setIndice(indice + 1);
    else setTerminou(true);
  }

  if (terminou) {
    const acertos = perguntas.filter(
      (p, i) => respostas[i] === p.correta
    ).length;
    navigate(`/simulados/${id}/resultado`, {
      state: { simulado, acertos, total: perguntas.length },
    });
    return null;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col justify-center items-center px-6">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-lg w-full max-w-3xl">
          <h1 className="text-2xl font-bold mb-4">
            {simulado.title} — Questão {indice + 1} de {perguntas.length}
          </h1>
          <p className="mb-6">{perguntaAtual?.enunciado}</p>

          <div className="space-y-3">
            {perguntaAtual?.opcoes?.map((op, idx) => (
              <button
                key={idx}
                onClick={() => selecionarResposta(op)}
                className={`w-full text-left px-4 py-2 rounded-lg border ${
                  respostas[indice] === op
                    ? "bg-green-500/30 border-green-400"
                    : "border-white/20 hover:border-white/40"
                }`}
              >
                {op}
              </button>
            ))}
          </div>

          <div className="flex justify-end mt-8">
            <button
              onClick={proximaPergunta}
              className="bg-gradient-to-r from-brandBlue to-brandGreen px-6 py-2 rounded-lg font-semibold"
            >
              {indice + 1 < perguntas.length ? "Próxima" : "Finalizar"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
