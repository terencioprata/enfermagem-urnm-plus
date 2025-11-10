// src/pages/Simulados.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";
import { Link } from "react-router-dom";

/**
 * Simulados page + exam runner - Versão melhorada
 * 
 * Melhorias implementadas:
 * - Melhor gestão de estado com useCallback e useMemo
 * - Tratamento robusto de erros
 * - Loading states mais claros
 * - Validação de dados aprimorada
 * - Modal para nome/email em vez de prompt
 * - Animações suaves
 * - Código mais limpo e organizado
 */

// ============================================================================
// CONSTANTS
// ============================================================================
const DEFAULT_DURATION_SEC = 20 * 60; // 20 minutes
const VIEWS = {
  LIST: "list",
  USER_INFO: "userInfo",
  EXAM: "exam",
  RESULT: "result"
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const parseQuestions = (questionsData) => {
  try {
    let qs = questionsData || [];
    if (typeof qs === "string") {
      qs = JSON.parse(qs);
    }
    
    return (Array.isArray(qs) ? qs : []).map((q, i) => ({
      id: q.id ?? `q_${i + 1}`,
      type: q.type ?? "mcq",
      question: q.question ?? "",
      choices: Array.isArray(q.choices) ? q.choices : [],
      correct: q.correct ?? null,
      points: typeof q.points === "number" ? q.points : 1,
    }));
  } catch (e) {
    console.error("Erro ao fazer parse das questões:", e);
    return [];
  }
};

const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return "00:00";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

const calculateScore = (questions, answers) => {
  if (!questions?.length) return 0;
  
  let totalPoints = 0;
  let earnedPoints = 0;
  
  for (const q of questions) {
    const points = Number(q.points ?? 1);
    totalPoints += points;
    
    if (q.type === "mcq") {
      const givenAnswer = answers[q.id];
      if (givenAnswer === undefined || givenAnswer === null) continue;
      
      const isCorrect = typeof q.correct === "number"
        ? Number(givenAnswer) === Number(q.correct)
        : String(givenAnswer).trim() === String(q.correct).trim();
      
      if (isCorrect) earnedPoints += points;
    }
    // Open questions: not auto-graded (could be graded manually later)
  }
  
  if (totalPoints === 0) return 0;
  const score = (earnedPoints / totalPoints) * 20;
  return Math.round(score * 100) / 100;
};

const getWhatsAppLink = () => "https://wa.me/244921639010";

const shouldShowReserveButton = (simulado) => {
  const text = `${simulado?.title || ""} ${simulado?.description || ""}`.toLowerCase();
  return /(curso|formação|formacao|inscrição|inscricao|venda|comprar|workshop)/i.test(text);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Simulados() {
  // State management
  const [simulados, setSimulados] = useState([]);
  const [loading, setLoading] = useState({ list: true, saving: false });
  const [error, setError] = useState(null);
  const [view, setView] = useState(VIEWS.LIST);
  
  // Exam state
  const [currentSimulado, setCurrentSimulado] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  
  // User info
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  
  // Result
  const [attemptResult, setAttemptResult] = useState(null);
  
  // Refs
  const timerRef = useRef(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  useEffect(() => {
    loadSimulados();
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // ============================================================================
  // API FUNCTIONS
  // ============================================================================
  
  const loadSimulados = useCallback(async () => {
    setLoading(prev => ({ ...prev, list: true }));
    setError(null);
    
    try {
      const { data, error: supabaseError } = await supabase
        .from("simulados")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (supabaseError) throw supabaseError;
      
      setSimulados(data || []);
    } catch (err) {
      console.error("Erro ao carregar simulados:", err);
      setError("Não foi possível carregar os simulados. Por favor, tenta novamente.");
      setSimulados([]);
    } finally {
      setLoading(prev => ({ ...prev, list: false }));
    }
  }, []);

  const saveAttempt = useCallback(async (simulado, userName, userEmail, questions, answers, score) => {
    try {
      setLoading(prev => ({ ...prev, saving: true }));
      
      const payload = {
        simulado_id: simulado.id,
        user_name: userName || null,
        user_email: userEmail || null,
        score,
        answers: answers,
        completed_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from("attempts")
        .insert([payload])
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (err) {
      console.error("Erro ao gravar tentativa:", err);
      // Don't throw - we still want to show results even if save fails
      return null;
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  }, []);

  // ============================================================================
  // EXAM CONTROL FUNCTIONS
  // ============================================================================
  
  const startTimer = useCallback((duration) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setTimeLeft(duration);
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current);
          finishExam(true); // Auto-finish when time runs out
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  }, []);

  const startSimulado = useCallback((simulado) => {
    try {
      const parsedQuestions = parseQuestions(simulado.questions);
      
      if (!parsedQuestions.length) {
        alert("Este simulado não possui questões válidas.");
        return;
      }
      
      setCurrentSimulado(simulado);
      setQuestions(parsedQuestions);
      setAnswers({});
      setCurrentIndex(0);
      setAttemptResult(null);
      
      const duration = Number(
        simulado.total_time_seconds ?? 
        simulado.time_seconds ?? 
        DEFAULT_DURATION_SEC
      ) || DEFAULT_DURATION_SEC;
      
      setView(VIEWS.EXAM);
      startTimer(duration);
    } catch (err) {
      console.error("Erro ao iniciar simulado:", err);
      alert("Erro ao iniciar o simulado. Por favor, tenta novamente.");
    }
  }, [startTimer]);

  const finishExam = useCallback(async (autoFinish = false) => {
    if (!currentSimulado || !questions.length) return;
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Calculate score
    const score = calculateScore(questions, answers);
    
    // Save attempt
    const savedAttempt = await saveAttempt(
      currentSimulado,
      userName,
      userEmail,
      questions,
      answers,
      score
    );
    
    // Show result
    setAttemptResult({
      score,
      saved: savedAttempt,
      autoFinish
    });
    
    setView(VIEWS.RESULT);
  }, [currentSimulado, questions, answers, userName, userEmail, saveAttempt]);

  const abortExam = useCallback(() => {
    const confirmed = window.confirm(
      "Deseja abandonar o simulado? O teu progresso será perdido."
    );
    
    if (!confirmed) return;
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    resetExamState();
    setView(VIEWS.LIST);
  }, []);

  const resetExamState = useCallback(() => {
    setCurrentSimulado(null);
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setTimeLeft(null);
    setAttemptResult(null);
  }, []);

  // ============================================================================
  // NAVIGATION & ANSWER FUNCTIONS
  // ============================================================================
  
  const answerQuestion = useCallback((questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }, []);

  const goToQuestion = useCallback((index) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  }, [questions.length]);

  const goNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, questions.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  const answeredCount = useMemo(() => {
    return Object.entries(answers).filter(([_, value]) => {
      return value !== undefined && value !== null && value !== "";
    }).length;
  }, [answers]);

  const progressPercentage = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answeredCount, questions.length]);

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================
  
  const renderSimuladoCard = useCallback((simulado) => {
    const questionCount = parseQuestions(simulado.questions).length;
    const duration = Number(
      simulado.total_time_seconds ?? 
      simulado.time_seconds ?? 
      DEFAULT_DURATION_SEC
    );
    const durationMinutes = Math.round(duration / 60);
    
    return (
      <motion.div
        key={simulado.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between border border-white/10"
      >
        <div>
          <h3 className="text-xl font-semibold mb-3 text-white">
            {simulado.title}
          </h3>
          <p className="text-sm text-white/70 mb-4 line-clamp-3">
            {simulado.description || simulado.excerpt || "Sem descrição disponível"}
          </p>
          
          <div className="flex items-center gap-4 text-sm text-white/60 mb-4">
            <div className="flex items-center gap-2">
              <span>📝</span>
              <span>{questionCount} questão{questionCount !== 1 ? "ões" : ""}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⏱️</span>
              <span>{durationMinutes} min</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => {
              setCurrentSimulado(simulado);
              setView(VIEWS.USER_INFO);
            }}
            className="flex-1 bg-brandBlue hover:bg-brandBlue/90 px-4 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105"
          >
            Iniciar Simulado
          </button>

          <Link
            to={`/simulados/${simulado.id}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-3 rounded-lg border border-white/20 hover:bg-white/5 transition-all duration-200 flex items-center justify-center"
            title="Ver detalhes"
          >
            ℹ️
          </Link>
        </div>
      </motion.div>
    );
  }, []);

  const renderQuestionCard = useCallback((question, index) => {
    const currentAnswer = answers[question.id];
    
    return (
      <motion.div
        key={question.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10"
      >
        <div className="mb-4">
          <div className="text-sm text-white/60 mb-2">
            Questão {index + 1} de {questions.length}
          </div>
          <h3 className="text-lg font-semibold text-white leading-relaxed">
            {question.question}
          </h3>
        </div>

        {question.type === "mcq" && (
          <div className="grid gap-3">
            {question.choices.map((choice, choiceIndex) => {
              const isSelected = currentAnswer === choiceIndex;
              
              return (
                <label
                  key={choiceIndex}
                  className={`
                    block p-4 rounded-lg cursor-pointer transition-all duration-200
                    ${isSelected 
                      ? "bg-brandGreen text-black font-semibold shadow-lg scale-105" 
                      : "bg-white/5 text-white hover:bg-white/10"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={choiceIndex}
                    checked={isSelected}
                    onChange={() => answerQuestion(question.id, choiceIndex)}
                    className="mr-3"
                  />
                  <span>{choice}</span>
                </label>
              );
            })}
          </div>
        )}

        {question.type === "open" && (
          <textarea
            rows={6}
            value={currentAnswer ?? ""}
            onChange={(e) => answerQuestion(question.id, e.target.value)}
            className="w-full p-4 rounded-lg bg-white/5 text-white outline-none focus:ring-2 focus:ring-brandBlue border border-white/10 resize-none"
            placeholder="Escreve a tua resposta aqui. Esta questão será avaliada manualmente."
          />
        )}
      </motion.div>
    );
  }, [answers, questions.length, answerQuestion]);

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  return (
    <Layout>
      <div className="min-h-screen pt-24 pb-16 px-6 bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange">
        <div className="max-w-7xl mx-auto">
          
          {/* LIST VIEW */}
          {view === VIEWS.LIST && (
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.h1
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl font-bold text-center mb-4 text-white"
                >
                  🧾 Simulados Disponíveis
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-center text-white/80 mb-12 max-w-2xl mx-auto"
                >
                  Seleciona um simulado e inicia o modo prova. Cada tentativa será registada automaticamente.
                </motion.p>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/20 border border-red-500/50 text-white p-4 rounded-lg mb-6 text-center"
                  >
                    {error}
                  </motion.div>
                )}

                {loading.list ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                  </div>
                ) : simulados.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {simulados.map(renderSimuladoCard)}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20"
                  >
                    <div className="text-6xl mb-4">📚</div>
                    <p className="text-white/60 text-lg">
                      Nenhum simulado disponível no momento.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* USER INFO MODAL VIEW */}
          {view === VIEWS.USER_INFO && currentSimulado && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl border border-white/20 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {currentSimulado.title}
                </h2>
                <p className="text-white/70 mb-6 text-sm">
                  Antes de começar, por favor identifica-te (opcional)
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm text-white/80 mb-2">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="O teu nome"
                      className="w-full p-3 rounded-lg bg-white/5 text-white border border-white/10 outline-none focus:ring-2 focus:ring-brandBlue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/80 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="O teu email"
                      className="w-full p-3 rounded-lg bg-white/5 text-white border border-white/10 outline-none focus:ring-2 focus:ring-brandBlue"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => startSimulado(currentSimulado)}
                    className="flex-1 bg-brandGreen hover:bg-brandGreen/90 text-black font-semibold px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105"
                  >
                    Começar Agora
                  </button>
                  <button
                    onClick={() => {
                      setView(VIEWS.LIST);
                      setCurrentSimulado(null);
                    }}
                    className="px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* EXAM VIEW */}
          {view === VIEWS.EXAM && currentSimulado && questions.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {/* Header */}
              <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl mb-6 border border-white/20">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {currentSimulado.title}
                    </h2>
                    <p className="text-sm text-white/70">
                      {currentSimulado.description || currentSimulado.excerpt}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-white/70 mb-1">
                      ⏱️ Tempo restante
                    </div>
                    <div className={`
                      text-3xl font-mono font-bold
                      ${timeLeft <= 60 ? 'text-red-400 animate-pulse' : 'text-white'}
                    `}>
                      {formatTime(timeLeft)}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-white/70 mb-2">
                    <span>Progresso: {answeredCount}/{questions.length}</span>
                    <span>{progressPercentage}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-brandGreen"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>

              {/* Main content */}
              <div className="grid lg:grid-cols-4 gap-6">
                {/* Question area */}
                <div className="lg:col-span-3 space-y-6">
                  <AnimatePresence mode="wait">
                    {renderQuestionCard(questions[currentIndex], currentIndex)}
                  </AnimatePresence>

                  {/* Navigation */}
                  <div className="flex justify-between items-center gap-4">
                    <button
                      onClick={goPrev}
                      disabled={currentIndex === 0}
                      className="px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      ← Anterior
                    </button>

                    <div className="flex gap-3">
                      {currentIndex < questions.length - 1 ? (
                        <button
                          onClick={goNext}
                          className="px-6 py-3 rounded-lg bg-brandBlue hover:bg-brandBlue/90 font-semibold transition-all duration-200"
                        >
                          Próxima →
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const confirmed = window.confirm(
                              "Deseja terminar o simulado e submeter as respostas?"
                            );
                            if (confirmed) finishExam(false);
                          }}
                          className="px-6 py-3 rounded-lg bg-brandGreen hover:bg-brandGreen/90 text-black font-bold transition-all duration-200 transform hover:scale-105"
                        >
                          Terminar e Enviar ✓
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <aside className="lg:col-span-1">
                  <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl border border-white/20 sticky top-24 space-y-6">
                    {/* Quick map */}
                    <div>
                      <h3 className="text-sm font-semibold text-white/80 mb-3">
                        Mapa de Questões
                      </h3>
                      <div className="grid grid-cols-5 gap-2">
                        {questions.map((q, i) => {
                          const isAnswered = answers[q.id] !== undefined && 
                                            answers[q.id] !== null && 
                                            answers[q.id] !== "";
                          const isCurrent = i === currentIndex;
                          
                          return (
                            <button
                              key={q.id}
                              onClick={() => goToQuestion(i)}
                              className={`
                                aspect-square rounded-lg text-sm font-semibold
                                transition-all duration-200 transform hover:scale-110
                                ${isCurrent 
                                  ? 'bg-brandBlue text-white ring-2 ring-white' 
                                  : isAnswered 
                                    ? 'bg-brandGreen text-black' 
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                }
                              `}
                              title={`Questão ${i + 1}`}
                            >
                              {i + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* User info */}
                    <div className="pt-4 border-t border-white/10">
                      <h3 className="text-sm font-semibold text-white/80 mb-2">
                        Informações
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-white/60">Nome:</span>
                          <div className="text-white font-medium">
                            {userName || "—"}
                          </div>
                        </div>
                        <div>
                          <span className="text-white/60">Email:</span>
                          <div className="text-white font-medium truncate">
                            {userEmail || "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-white/10">
                      <button
                        onClick={abortExam}
                        className="w-full px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-all duration-200"
                      >
                        🚪 Abandonar
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </motion.div>
          )}

          {/* RESULT VIEW */}
          {view === VIEWS.RESULT && attemptResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl border border-white/20 shadow-2xl">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">
                    {attemptResult.score >= 15 ? "🎉" : attemptResult.score >= 10 ? "👍" : "📚"}
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {attemptResult.autoFinish ? "Tempo Esgotado!" : "Simulado Concluído!"}
                  </h2>
                  <p className="text-white/70">
                    {userName 
                      ? `Obrigado, ${userName}!` 
                      : "Obrigado pela participação!"
                    }
                  </p>
                </div>

                {/* Score */}
                <div className="bg-white/5 p-6 rounded-xl mb-6 text-center">
                  <div className="text-sm text-white/60 mb-2">
                    A Tua Pontuação
                  </div>
                  <div className="text-6xl font-bold text-white mb-2">
                    {attemptResult.score.toFixed(2)}
                  </div>
                  <div className="text-xl text-white/80">
                    / 20 valores
                  </div>
                  
                  {/* Performance message */}
                  <div className="mt-4 text-white/70">
                    {attemptResult.score >= 15 && "Excelente desempenho! 🌟"}
                    {attemptResult.score >= 10 && attemptResult.score < 15 && "Bom trabalho! Continue a estudar. 📖"}
                    {attemptResult.score < 10 && "Continue a praticar! Não desistas. 💪"}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-white/5 p-6 rounded-xl mb-6">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    📊 Resumo
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-white/60">Total de Questões</div>
                      <div className="text-xl font-bold text-white">
                        {questions.length}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-white/60">Respondidas</div>
                      <div className="text-xl font-bold text-white">
                        {answeredCount}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-white/60">Taxa de Conclusão</div>
                      <div className="text-xl font-bold text-white">
                        {progressPercentage}%
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-white/60">Estado</div>
                      <div className="text-xl font-bold text-white">
                        {attemptResult.saved ? "✓ Guardado" : "⚠️ Não guardado"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save status */}
                {!attemptResult.saved && (
                  <div className="bg-yellow-500/20 border border-yellow-500/50 p-4 rounded-lg mb-6 text-sm text-white">
                    ⚠️ A tua tentativa não foi guardada. Por favor, contacta o suporte se necessário.
                  </div>
                )}

                {loading.saving && (
                  <div className="bg-brandBlue/20 border border-brandBlue/50 p-4 rounded-lg mb-6 text-sm text-white flex items-center gap-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    A guardar a tua tentativa...
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3">
                  {/* Primary CTA based on simulado type */}
                  {shouldShowReserveButton(currentSimulado) ? (
                    <a
                      href={getWhatsAppLink()}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full text-center px-6 py-4 rounded-lg bg-brandGreen hover:bg-brandGreen/90 text-black font-bold text-lg transition-all duration-200 transform hover:scale-105"
                    >
                      🎓 Reservar Vaga no Curso
                    </a>
                  ) : (
                    <a
                      href={getWhatsAppLink()}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full text-center px-6 py-4 rounded-lg bg-brandBlue hover:bg-brandBlue/90 text-white font-bold text-lg transition-all duration-200 transform hover:scale-105"
                    >
                      💬 Falar Connosco no WhatsApp
                    </a>
                  )}

                  {/* Secondary actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        resetExamState();
                        setView(VIEWS.LIST);
                      }}
                      className="px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200"
                    >
                      📋 Ver Outros Simulados
                    </button>
                    
                    <button
                      onClick={() => {
                        setView(VIEWS.USER_INFO);
                      }}
                      className="px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200"
                    >
                      🔄 Repetir Este Simulado
                    </button>
                  </div>
                </div>

                {/* Footer note */}
                <div className="mt-6 pt-6 border-t border-white/10 text-center text-sm text-white/60">
                  Os resultados foram registados automaticamente.
                  {userEmail && " Receberás uma confirmação no email fornecido."}
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </Layout>
  );
}