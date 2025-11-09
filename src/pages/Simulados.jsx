// src/pages/Simulados.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";
import { Link } from "react-router-dom";

/**
 * Simulados page + exam runner.
 *
 * Requisitos:
 * - supabase table "simulados" deve ter ao menos: id, title, description, questions (JSON), created_at
 *   questions: array of { id, type: "mcq" | "open", question, choices?: string[], correct?: index or value, points?: number }
 * - supabase table "attempts" should exist and accept: simulado_id, user_name, user_email, score, answers (json), created_at
 *
 * Behavior:
 * - list view: mostra cartões com resumo e botão "Iniciar".
 * - start: pede nome/email (opcional mas recomendado), carrega as perguntas e começa o cronómetro.
 * - ao terminar, calcula pontuação (somando pontos de questões de múltipla escolha; perguntas abertas ficam como 0 por default),
 *   grava registro em attempts e mostra resumo com nota 0–20.
 */

export default function Simulados() {
  const [simulados, setSimulados] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [view, setView] = useState("list"); // 'list' | 'exam' | 'result'
  const [currentSimulado, setCurrentSimulado] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // { questionId: answerIndexOrText }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null); // seconds
  const timerRef = useRef(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [attemptResult, setAttemptResult] = useState(null);
  const [savingAttempt, setSavingAttempt] = useState(false);

  // Config: default duration per simulado (in seconds) if simulado doesn't specify total_time
  const DEFAULT_DURATION_SEC = 20 * 60; // 20 minutes

  useEffect(() => {
    loadSimulados();
  }, []);

  async function loadSimulados() {
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from("simulados")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSimulados(data || []);
    } catch (err) {
      console.error("Erro ao carregar simulados:", err);
      setSimulados([]);
    } finally {
      setLoadingList(false);
    }
  }

  // Start a simulado: fetch questions (if stored in JSON field 'questions') and initialize state
  async function startSimulado(sim) {
    try {
      // If sim.questions stored as JSON string, parse; else assume object/array already.
      let qs = sim.questions || [];
      if (typeof qs === "string") {
        try { qs = JSON.parse(qs); } catch (e) { qs = []; }
      }

      // Normalize questions: ensure each has id, type, points (defaults)
      qs = (qs || []).map((q, i) => ({
        id: q.id ?? i + 1,
        type: q.type ?? "mcq",
        question: q.question ?? "",
        choices: q.choices ?? [],
        correct: q.correct ?? null,
        points: typeof q.points === "number" ? q.points : 1,
      }));

      setCurrentSimulado(sim);
      setQuestions(qs);
      setAnswers({});
      setCurrentIndex(0);

      // Time: prefer sim.total_time_seconds or sim.time_seconds or default
      const total = Number(sim.total_time_seconds ?? sim.time_seconds ?? DEFAULT_DURATION_SEC) || DEFAULT_DURATION_SEC;
      setTimeLeft(total);

      setView("exam");

      // start timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            finishExam(); // auto finish
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } catch (err) {
      console.error(err);
      alert("Erro ao iniciar o simulado.");
    }
  }

  // stop timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function formatTime(sec) {
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function answerQuestion(qId, value) {
    setAnswers((a) => ({ ...a, [qId]: value }));
  }

  function goNext() {
    if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1);
  }
  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  // Score calculation: compute sum points, scale to 0-20
  function calculateScore(qs = questions, ans = answers) {
    if (!qs.length) return 0;
    let totalPoints = 0;
    let earned = 0;
    for (const q of qs) {
      totalPoints += Number(q.points ?? 1);
      if (q.type === "mcq") {
        // assume q.correct is index or value
        const given = ans[q.id];
        if (given === undefined || given === null) continue;
        if (typeof q.correct === "number") {
          if (Number(given) === Number(q.correct)) earned += Number(q.points ?? 1);
        } else {
          // compare string values
          if (String(given).trim() === String(q.correct).trim()) earned += Number(q.points ?? 1);
        }
      } else {
        // open question: not auto-graded — give 0 (could be graded later)
      }
    }
    // Avoid division by zero
    if (totalPoints === 0) return 0;
    const raw = (earned / totalPoints) * 20; // scale to 0-20
    return Math.round(raw * 100) / 100; // two decimals
  }

  // Save attempt to Supabase
  async function saveAttempt(sim, usrName, usrEmail, qs, ans, score) {
    try {
      setSavingAttempt(true);
      const payload = {
        simulado_id: sim.id,
        user_name: usrName || null,
        user_email: usrEmail || null,
        score,
        answers: ans,
      };
      const { data, error } = await supabase.from("attempts").insert([payload]).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Erro ao gravar tentativa:", err);
      return null;
    } finally {
      setSavingAttempt(false);
    }
  }

  // Finish exam: compute score, save attempt, show result
  async function finishExam() {
    if (!currentSimulado) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const score = calculateScore(questions, answers);
    const saved = await saveAttempt(currentSimulado, userName, userEmail, questions, answers, score);
    setAttemptResult({ score, saved });
    setView("result");
  }

  function abortExam() {
    if (!confirm("Deseja abandonar o simulado? Progresso será perdido.")) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setView("list");
    setCurrentSimulado(null);
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setTimeLeft(null);
  }

  // UI: exam card for a question
  function QuestionCard({ q, idx }) {
    return (
      <div className="bg-white/5 p-6 rounded-lg">
        <div className="mb-3 text-sm text-gray-300">Questão {idx + 1} de {questions.length}</div>
        <div className="mb-4 text-lg font-semibold">{q.question}</div>

        {q.type === "mcq" && (
          <div className="grid gap-3">
            {q.choices.map((c, i) => {
              const value = i;
              const checked = answers[q.id] === value;
              return (
                <label key={i} className={`block p-3 rounded-lg cursor-pointer transition ${checked ? "bg-brandGreen text-black" : "bg-white/3 text-white"}`}>
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={value}
                    checked={checked}
                    onChange={() => answerQuestion(q.id, value)}
                    className="mr-2"
                  />
                  <span>{c}</span>
                </label>
              );
            })}
          </div>
        )}

        {q.type === "open" && (
          <textarea
            rows={5}
            value={answers[q.id] ?? ""}
            onChange={(e) => answerQuestion(q.id, e.target.value)}
            className="w-full p-3 rounded bg-white/5 text-white outline-none"
            placeholder="Escreve a tua resposta (esta questão será avaliada manualmente)."
          />
        )}
      </div>
    );
  }

  // small helper to open whatsapp in new tab for purchase/reserve link
  function whatsappLink() {
    return "https://wa.me/244921639010";
  }

  // Render
  return (
    <Layout>
      <div className="min-h-screen pt-24 pb-16 px-6 bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange text-white">
        <div className="max-w-6xl mx-auto">
          {/* LIST VIEW */}
          {view === "list" && (
            <>
              <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-bold text-center mb-8">
                🧾 Simulados Disponíveis
              </motion.h1>

              <div className="mb-6 text-center text-white/90">Seleciona um simulado e inicia o modo prova. Cada tentativa será registada.</div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {loadingList ? (
                  <div>Carregando...</div>
                ) : (simulados.length ? simulados.map((s) => {
                  // count questions if possible
                  let qCount = 0;
                  try {
                    const qs = typeof s.questions === "string" ? JSON.parse(s.questions || "[]") : s.questions || [];
                    qCount = qs.length;
                  } catch (e) { qCount = 0; }
                  return (
                    <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
                      <div>
                        <h3 className="text-xl font-semibold mb-2 text-white">{s.title}</h3>
                        <p className="text-sm text-white/80 mb-4 line-clamp-3">{s.description || s.excerpt || "—"}</p>
                        <div className="text-sm text-white/70 mb-3">{qCount} questão(ões)</div>
                        <div className="text-xs text-white/60 mb-2">Duração: {Number(s.total_time_seconds ?? s.time_seconds) ? `${Math.round((Number(s.total_time_seconds ?? s.time_seconds) || DEFAULT_DURATION_SEC) / 60)} min` : `${Math.round(DEFAULT_DURATION_SEC / 60)} min`}</div>
                      </div>

                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={() => {
                            // prompt for name/email before starting (small modal-like)
                            const name = prompt("Nome (opcional):", userName || "");
                            const email = prompt("Email (opcional):", userEmail || "");
                            if (name !== null) setUserName(name);
                            if (email !== null) setUserEmail(email);
                            startSimulado(s);
                          }}
                          className="flex-1 bg-brandBlue px-4 py-2 rounded font-semibold hover:bg-brandBlue/90 transition"
                        >
                          Iniciar Simulado
                        </button>

                        <Link to={`/simulados/${s.id}`} target="_blank" rel="noreferrer" className="px-4 py-2 rounded border border-white/20 hover:bg-white/5">
                          Detalhes
                        </Link>
                      </div>
                    </motion.div>
                  );
                }) : (
                  <div className="col-span-full text-center text-white/80">Nenhum simulado disponível.</div>
                ))}
              </div>
            </>
          )}

          {/* EXAM VIEW */}
          {view === "exam" && currentSimulado && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{currentSimulado.title}</h2>
                  <div className="text-sm text-white/80">{currentSimulado.description || currentSimulado.excerpt}</div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-white/80 mb-1">Tempo restante</div>
                  <div className="text-2xl font-mono font-bold">{formatTime(timeLeft ?? 0)}</div>
                </div>
              </div>

              {/* Question area + side summary */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  {questions.length ? (
                    <>
                      <QuestionCard q={questions[currentIndex]} idx={currentIndex} />
                      <div className="flex justify-between items-center mt-4">
                        <button onClick={goPrev} disabled={currentIndex === 0} className="px-4 py-2 rounded bg-white/5 hover:bg-white/10">Anterior</button>
                        <div className="flex items-center gap-3">
                          <button onClick={() => {
                            // quick: mark current as unanswered? just go next
                            if (currentIndex < questions.length - 1) goNext();
                          }} className="px-4 py-2 rounded bg-brandBlue">Próxima</button>
                          <button onClick={() => {
                            if (!confirm("Deseja terminar o simulado e submeter as respostas?")) return;
                            finishExam();
                          }} className="px-4 py-2 rounded bg-brandGreen text-black">Terminar e Enviar</button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white/5 p-6 rounded">Este simulado não possui perguntas.</div>
                  )}
                </div>

                <aside className="p-4 bg-white/5 rounded-lg">
                  <div className="mb-4">
                    <div className="text-sm text-white/80">Progresso</div>
                    <div className="text-lg font-semibold mt-1">{Object.keys(answers).length} / {questions.length} respondidas</div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-white/80 mb-2">Mapa rápido</div>
                    <div className="grid grid-cols-5 gap-2">
                      {questions.map((q, i) => {
                        const done = answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== "";
                        return (
                          <button
                            key={q.id}
                            onClick={() => setCurrentIndex(i)}
                            className={`px-2 py-1 text-xs rounded ${done ? "bg-brandGreen text-black" : "bg-white/3 text-white"}`}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-sm text-white/80">
                    <div className="mb-2">Nome: <strong className="block text-white">{userName || "—"}</strong></div>
                    <div>Email: <strong className="block text-white">{userEmail || "—"}</strong></div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <button onClick={abortExam} className="px-3 py-2 rounded bg-red-600">Abandonar</button>
                  </div>
                </aside>
              </div>
            </>
          )}

          {/* RESULT VIEW */}
          {view === "result" && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/5 p-8 rounded-2xl">
                <h2 className="text-2xl font-bold mb-2">Resultado</h2>
                <div className="mb-4 text-white/80">Obrigado, {userName || "Aluno(a)"} — a tua tentativa foi registada.</div>

                <div className="mb-4">
                  <div className="text-sm text-white/80">Pontuação</div>
                  <div className="text-4xl font-bold">{attemptResult?.score ?? "—"} / 20</div>
                </div>

                <div className="mb-6">
                  <h4 className="font-semibold mb-2">Resumo</h4>
                  <div className="text-sm text-white/80">Questões respondidas: {Object.keys(answers).length} / {questions.length}</div>
                </div>

                <div className="flex gap-3">
                  {/* If the simulado title or description contains words like "curso" or "formação", show "Reservar Vaga" */}
                  {/(curso|formação|formacao|inscrição|venda|comprar|workshop)/i.test(currentSimulado?.title + " " + (currentSimulado?.description || "")) ? (
                    <a href={whatsappLink()} target="_blank" rel="noreferrer" className="px-4 py-2 rounded bg-brandGreen text-black font-semibold">Reservar Vaga (WhatsApp)</a>
                  ) : (
                    <a href={whatsappLink()} target="_blank" rel="noreferrer" className="px-4 py-2 rounded bg-brandBlue font-semibold">Comprar / Contactar (WhatsApp)</a>
                  )}

                  <button onClick={() => { setView("list"); setCurrentSimulado(null); setQuestions([]); setAnswers({}); setAttemptResult(null); }} className="px-4 py-2 rounded bg-white/5">Voltar à lista</button>

                  <button onClick={() => window.open(whatsappLink(), "_blank")} className="px-4 py-2 rounded bg-white/5">Conversar</button>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
