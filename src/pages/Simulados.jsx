// src/pages/Simulados.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../supabaseClient";
import Layout from "../components/Layout";
import { Link } from "react-router-dom";

const DEFAULT_DURATION_SEC = 20 * 60;
const VIEWS = {
  LIST: "list",
  USER_INFO: "userInfo",
  EXAM: "exam",
  RESULT: "result"
};

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

export default function Simulados() {
  const [simulados, setSimulados] = useState([]);
  const [loading, setLoading] = useState({ list: true, saving: false });
  const [error, setError] = useState(null);
  const [view, setView] = useState(VIEWS.LIST);
  
  const [currentSimulado, setCurrentSimulado] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  
  const [attemptResult, setAttemptResult] = useState(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [filterTema, setFilterTema] = useState("all");
  
  const timerRef = useRef(null);

  useEffect(() => {
    loadSimulados();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

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
      return null;
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  }, []);

  const startTimer = useCallback((duration) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setTimeLeft(duration);
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current);
          finishExam(true);
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
      setShowCorrections(false);
      
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
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    const score = calculateScore(questions, answers);
    
    let correctCount = 0;
    let wrongCount = 0;
    const detailedResults = questions.map((q) => {
      const userAnswer = answers[q.id];
      let isCorrect = false;
      
      if (q.type === "mcq") {
        if (userAnswer !== undefined && userAnswer !== null) {
          isCorrect = typeof q.correct === "number"
            ? Number(userAnswer) === Number(q.correct)
            : String(userAnswer).trim() === String(q.correct).trim();
          
          if (isCorrect) {
            correctCount++;
          } else {
            wrongCount++;
          }
        } else {
          wrongCount++;
        }
      }
      
      return {
        question: q,
        userAnswer,
        isCorrect,
        correctAnswer: q.type === "mcq" ? q.correct : null
      };
    });
    
    const savedAttempt = await saveAttempt(
      currentSimulado,
      userName,
      userEmail,
      questions,
      answers,
      score
    );
    
    setAttemptResult({
      score,
      saved: savedAttempt,
      autoFinish,
      correctCount,
      wrongCount,
      detailedResults
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
    setShowCorrections(false);
  }, []);

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

  const answeredCount = useMemo(() => {
    return Object.entries(answers).filter(([_, value]) => {
      return value !== undefined && value !== null && value !== "";
    }).length;
  }, [answers]);

  const progressPercentage = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answeredCount, questions.length]);

  const temas = useMemo(() => {
    const allTemas = new Set(["Todos"]);
    simulados.forEach(sim => {
      const desc = (sim.description || sim.title || "").toLowerCase();
      if (desc.includes("fundamentos")) allTemas.add("Fundamentos");
      if (desc.includes("anatomia")) allTemas.add("Anatomia");
      if (desc.includes("farmacologia")) allTemas.add("Farmacologia");
      if (desc.includes("microbiologia")) allTemas.add("Microbiologia");
      if (desc.includes("combo") || desc.includes("misto")) allTemas.add("Combos");
    });
    return Array.from(allTemas);
  }, [simulados]);

  const filteredAndSortedSimulados = useMemo(() => {
    let filtered = simulados;
    
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterTema !== "all" && filterTema !== "Todos") {
      filtered = filtered.filter(s => {
        const desc = (s.description || s.title || "").toLowerCase();
        return desc.includes(filterTema.toLowerCase());
      });
    }
    
    const sorted = [...filtered];
    switch(sortBy) {
      case "recent":
        sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case "oldest":
        sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case "title":
        sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "questions":
        sorted.sort((a, b) => {
          const aQ = parseQuestions(a.questions).length;
          const bQ = parseQuestions(b.questions).length;
          return bQ - aQ;
        });
        break;
      default:
        break;
    }
    
    return sorted;
  }, [simulados, searchTerm, filterTema, sortBy]);

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
        whileHover={{ y: -8, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md p-6 rounded-3xl shadow-2xl border border-white/20 flex flex-col justify-between hover:border-white/40"
      >
        <div>
          <h3 className="text-2xl font-bold mb-3 text-white bg-gradient-to-r from-brandGreen to-brandBlue bg-clip-text text-transparent">
            {simulado.title}
          </h3>
          <p className="text-sm text-white/80 mb-6 line-clamp-3 leading-relaxed">
            {simulado.description || simulado.excerpt || "Sem descrição disponível"}
          </p>
          
          <div className="flex items-center gap-6 text-sm text-white/70 mb-4">
            <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-full">
              <span className="text-lg">📝</span>
              <span className="font-semibold">{questionCount} questões</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-full">
              <span className="text-lg">⏱️</span>
              <span className="font-semibold">{durationMinutes} min</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setCurrentSimulado(simulado);
            setView(VIEWS.USER_INFO);
          }}
          className="w-full bg-gradient-to-r from-brandBlue to-brandGreen hover:from-brandBlue/90 hover:to-brandGreen/90 text-white font-bold px-6 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg"
        >
          Iniciar Simulado →
        </button>
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
        className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-2xl"
      >
        <div className="mb-6">
          <div className="text-sm text-white/60 mb-3 font-semibold">
            Questão {index + 1} de {questions.length}
          </div>
          <h3 className="text-xl font-bold text-white leading-relaxed">
            {question.question}
          </h3>
        </div>

        {question.type === "mcq" && (
          <div className="grid gap-4">
            {question.choices.map((choice, choiceIndex) => {
              const isSelected = currentAnswer === choiceIndex;
              
              return (
                <label
                  key={choiceIndex}
                  className={`
                    block p-5 rounded-2xl cursor-pointer transition-all duration-300 border-2
                    ${isSelected 
                      ? "bg-gradient-to-r from-brandGreen to-brandBlue text-white font-bold shadow-2xl scale-105 border-white" 
                      : "bg-white/5 text-white hover:bg-white/10 border-white/20 hover:border-white/40"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={choiceIndex}
                    checked={isSelected}
                    onChange={() => answerQuestion(question.id, choiceIndex)}
                    className="mr-4"
                  />
                  <span className="text-lg">{choice}</span>
                </label>
              );
            })}
          </div>
        )}

        {question.type === "open" && (
          <textarea
            rows={8}
            value={currentAnswer ?? ""}
            onChange={(e) => answerQuestion(question.id, e.target.value)}
            className="w-full p-5 rounded-2xl bg-white/10 text-white outline-none focus:ring-4 focus:ring-brandBlue/50 border-2 border-white/20 focus:border-brandBlue resize-none backdrop-blur-md text-lg"
            placeholder="Escreve a tua resposta aqui. Esta questão será avaliada manualmente."
          />
        )}
      </motion.div>
    );
  }, [answers, questions.length, answerQuestion]);

  return (
    <Layout>
      <div className="min-h-screen pt-24 pb-16 px-6 bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange">
        <div className="max-w-7xl mx-auto">
          
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
                  className="text-5xl font-extrabold text-center mb-4 text-white drop-shadow-2xl"
                >
                  🧾 Simulados Disponíveis
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-center text-white/90 mb-12 max-w-2xl mx-auto text-lg"
                >
                  Seleciona um simulado e inicia o modo prova. Cada tentativa será registada automaticamente.
                </motion.p>

                <div className="max-w-3xl mx-auto mb-12">
                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-3xl border border-white/30 shadow-2xl">
                    <input
                      type="text"
                      placeholder="🔍 Pesquisar simulados..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl bg-white/20 text-white placeholder-white/60 outline-none text-lg font-semibold border-2 border-transparent focus:border-white/50"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-4 mb-12">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-6 py-3 rounded-full bg-white/20 backdrop-blur-md text-white font-semibold outline-none cursor-pointer border-2 border-white/30 hover:border-white/50"
                  >
                    <option value="recent">Mais Recentes</option>
                    <option value="oldest">Mais Antigos</option>
                    <option value="title">Nome (A-Z)</option>
                    <option value="questions">Mais Questões</option>
                  </select>

                  <div className="flex flex-wrap gap-2">
                    {temas.map(tema => (
                      <button
                        key={tema}
                        onClick={() => setFilterTema(tema === "Todos" ? "all" : tema)}
                        className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 border-2 ${
                          (filterTema === "all" && tema === "Todos") || filterTema === tema
                            ? "bg-white text-black border-white shadow-xl scale-110"
                            : "bg-white/10 text-white border-white/30 hover:bg-white/20 hover:border-white/50"
                        }`}
                      >
                        {tema}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                  >
                    <div className="bg-gradient-to-br from-red-500/90 to-red-600/90 backdrop-blur-xl p-8 rounded-3xl border-2 border-white/30 shadow-2xl max-w-md mx-4">
                      <div className="text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h3 className="text-2xl font-bold text-white mb-3">Erro</h3>
                        <p className="text-white/90 mb-6">{error}</p>
                        <button
                          onClick={() => setError(null)}
                          className="px-8 py-3 rounded-xl bg-white text-red-600 font-bold hover:scale-105 transition-transform"
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {loading.list ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
                  </div>
                ) : filteredAndSortedSimulados.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredAndSortedSimulados.map(renderSimuladoCard)}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-20"
                  >
                    <div className="text-8xl mb-6">📚</div>
                    <p className="text-white/60 text-2xl font-semibold">
                      Nenhum simulado encontrado.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {view === VIEWS.USER_INFO && currentSimulado && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-xl p-10 rounded-3xl border-2 border-white/30 shadow-2xl">
                <h2 className="text-3xl font-bold text-white mb-3">
                  {currentSimulado.title}
                </h2>
                <p className="text-white/80 mb-8 text-lg">
                  Antes de começar, por favor identifica-te (opcional)
                </p>

                <div className="space-y-5 mb-8">
                  <div>
                    <label className="block text-sm text-white/80 mb-2 font-semibold">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="O teu nome"
                      className="w-full p-4 rounded-2xl bg-white/10 text-white border-2 border-white/20 outline-none focus:ring-4 focus:ring-brandBlue/50 focus:border-brandBlue text-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/80 mb-2 font-semibold">
                      Email
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="O teu email"
                      className="w-full p-4 rounded-2xl bg-white/10 text-white border-2 border-white/20 outline-none focus:ring-4 focus:ring-brandBlue/50 focus:border-brandBlue text-lg"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => startSimulado(currentSimulado)}
                    className="flex-1 bg-gradient-to-r from-brandGreen to-brandBlue hover:from-brandGreen/90 hover:to-brandBlue/90 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl text-lg"
                  >
                    Começar Agora
                  </button>
                  <button
                    onClick={() => {
                      setView(VIEWS.LIST);
                      setCurrentSimulado(null);
                    }}
                    className="px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-all duration-300 border-2 border-white/30 font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === VIEWS.EXAM && currentSimulado && questions.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-xl p-8 rounded-3xl mb-8 border-2 border-white/30 shadow-2xl">
                <div className="flex items-center justify-between flex-wrap gap-6">
                  <div className="flex-1 min-w-[200px]">
                    <h2 className="text-3xl font-bold text-white mb-2">
                      {currentSimulado.title}
                    </h2>
                    <p className="text-lg text-white/80">
                      {currentSimulado.description || currentSimulado.excerpt}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-white/70 mb-2 font-semibold">
                      ⏱️ Tempo restante
                    </div>
                    <div className={`
                      text-5xl font-mono font-extrabold
                      ${timeLeft <= 60 ? 'text-red-400 animate-pulse' : 'text-white'}
                    `}>
                      {formatTime(timeLeft)}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between text-sm text-white/80 mb-3 font-semibold">
                    <span>Progresso: {answeredCount}/{questions.length}</span>
                    <span>{progressPercentage}%</span>
                  </div>
                  <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-brandGreen to-brandBlue"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-8">
                  <AnimatePresence mode="wait">
                    {renderQuestionCard(questions[currentIndex], currentIndex)}
                  </AnimatePresence>

                  <div className="flex justify-between items-center gap-4">
                    <button
                      onClick={goPrev}
                      disabled={currentIndex === 0}
                      className="px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 font-bold text-white border-2 border-white/30"
                    >
                      ← Anterior
                    </button>

                    <div className="flex gap-4">
                      {currentIndex < questions.length - 1 ? (
                        <button
                          onClick={goNext}
                          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-brandBlue to-brandGreen hover:from-brandBlue/90 hover:to-brandGreen/90 font-bold transition-all duration-300 shadow-lg text-white"
                        >
                          Próxima →
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowFinishModal(true)}
                          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-brandGreen to-brandBlue hover:from-brandGreen/90 hover:to-brandBlue/90 text-white font-bold transition-all duration-300 transform hover:scale-105 shadow-xl"
                        >
                          Terminar e Enviar ✓
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <aside className="lg:col-span-1">
                  <div className="bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-xl p-6 rounded-3xl border-2 border-white/30 sticky top-24 space-y-6 shadow-2xl">
                    <div>
                      <h3 className="text-sm font-bold text-white/90 mb-4">
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
                                aspect-square rounded-xl text-sm font-bold
                                transition-all duration-300 transform hover:scale-110
                                ${isCurrent 
                                  ? 'bg-gradient-to-r from-brandBlue to-brandGreen text-white ring-4 ring-white shadow-xl' 
                                  : isAnswered 
                                    ? 'bg-brandGreen text-black shadow-lg' 
                                    : 'bg-white/20 text-white hover:bg-white/30 border-2 border-white/40'
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

                    <div className="pt-4 border-t-2 border-white/30">
                      <h3 className="text-sm font-bold text-white/90 mb-3">
                        Informações
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-white/70">Nome:</span>
                          <div className="text-white font-semibold">
                            {userName || "—"}
                          </div>
                        </div>
                        <div>
                          <span className="text-white/70">Email:</span>
                          <div className="text-white font-semibold truncate">
                            {userEmail || "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t-2 border-white/30">
                      <button
                        onClick={abortExam}
                        className="w-full px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all duration-300 shadow-lg"
                      >
                        🚪 Abandonar
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {showFinishModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
                onClick={() => setShowFinishModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="bg-gradient-to-br from-brandBlue/95 to-brandGreen/95 backdrop-blur-xl p-10 rounded-3xl border-2 border-white/40 shadow-2xl max-w-md w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center">
                    <motion.div 
                      className="text-7xl mb-6"
                      animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        duration: 0.8,
                        repeat: Infinity,
                        repeatDelay: 1
                      }}
                    >
                      ⚠️
                    </motion.div>
                    <h3 className="text-4xl font-extrabold text-white mb-4 drop-shadow-lg">
                      Terminar Simulado?
                    </h3>
                    <p className="text-white/90 mb-8 text-lg leading-relaxed">
                      Tem certeza que deseja finalizar e enviar suas respostas? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setShowFinishModal(false)}
                        className="flex-1 px-6 py-4 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold transition-all transform hover:scale-105 border-2 border-white/40"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          setShowFinishModal(false);
                          finishExam(false);
                        }}
                        className="flex-1 px-6 py-4 rounded-2xl bg-white text-black font-extrabold transition-all transform hover:scale-105 shadow-2xl"
                      >
                        Confirmar ✓
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {view === VIEWS.RESULT && attemptResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-3xl mx-auto"
            >
              <div className="bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-xl p-10 rounded-3xl border-2 border-white/30 shadow-2xl">
                <div className="text-center mb-10">
                  <motion.div 
                    className="text-8xl mb-6"
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 10, -10, 0]
                    }}
                    transition={{ 
                      duration: 1,
                      repeat: 3
                    }}
                  >
                    {attemptResult.score >= 15 ? "🎉" : attemptResult.score >= 10 ? "👍" : "📚"}
                  </motion.div>
                  <h2 className="text-5xl font-extrabold text-white mb-4 drop-shadow-2xl">
                    {attemptResult.autoFinish ? "Tempo Esgotado!" : "Simulado Concluído!"}
                  </h2>
                  <p className="text-white/90 text-xl">
                    {userName 
                      ? `Obrigado, ${userName}!` 
                      : "Obrigado pela participação!"
                    }
                  </p>
                </div>

                <div className="bg-gradient-to-r from-brandGreen/30 to-brandBlue/30 backdrop-blur-md p-8 rounded-2xl mb-8 text-center border-2 border-white/30">
                  <div className="text-sm text-white/80 mb-3 font-bold uppercase tracking-wider">
                    A Tua Pontuação
                  </div>
                  <div className="text-7xl font-extrabold text-white mb-3 drop-shadow-xl">
                    {attemptResult.score.toFixed(2)}
                  </div>
                  <div className="text-3xl text-white/90 font-bold">
                    / 20 valores
                  </div>
                  
                  <div className="mt-6 text-white/80 text-lg font-semibold">
                    {attemptResult.score >= 15 && "Excelente desempenho! 🌟"}
                    {attemptResult.score >= 10 && attemptResult.score < 15 && "Bom trabalho! Continue a estudar. 📖"}
                    {attemptResult.score < 10 && "Continue a praticar! Não desistas. 💪"}
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl mb-8 border-2 border-white/20">
                  <h3 className="font-extrabold text-white mb-6 flex items-center gap-3 text-2xl">
                    📊 Resumo Detalhado
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-white/10 to-white/5 p-6 rounded-2xl border border-white/30">
                      <div className="text-white/70 text-sm font-semibold mb-2">Total de Questões</div>
                      <div className="text-4xl font-extrabold text-white">
                        {questions.length}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-brandGreen/20 to-brandGreen/10 p-6 rounded-2xl border border-brandGreen/50">
                      <div className="text-white/70 text-sm font-semibold mb-2">Questões Acertadas</div>
                      <div className="text-4xl font-extrabold text-brandGreen">
                        {attemptResult.correctCount || 0}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-red-400/20 to-red-400/10 p-6 rounded-2xl border border-red-400/50">
                      <div className="text-white/70 text-sm font-semibold mb-2">Questões Erradas</div>
                      <div className="text-4xl font-extrabold text-red-400">
                        {attemptResult.wrongCount || 0}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-white/10 to-white/5 p-6 rounded-2xl border border-white/30">
                      <div className="text-white/70 text-sm font-semibold mb-2">Taxa de Acerto</div>
                      <div className="text-4xl font-extrabold text-white">
                        {questions.length > 0 
                          ? Math.round((attemptResult.correctCount / questions.length) * 100)
                          : 0}%
                      </div>
                    </div>
                  </div>
                </div>

                {!attemptResult.saved && (
                  <div className="bg-yellow-500/30 border-2 border-yellow-500/60 p-6 rounded-2xl mb-8 text-white backdrop-blur-md">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">⚠️</span>
                      <div>
                        <div className="font-bold mb-1">Aviso</div>
                        <div className="text-sm">A tua tentativa não foi guardada. Por favor, contacta o suporte se necessário.</div>
                      </div>
                    </div>
                  </div>
                )}

                {loading.saving && (
                  <div className="bg-brandBlue/30 border-2 border-brandBlue/60 p-6 rounded-2xl mb-8 text-white flex items-center gap-4 backdrop-blur-md">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span className="font-semibold">A guardar a tua tentativa...</span>
                  </div>
                )}

                <div className="space-y-4">
                  <button
                    onClick={() => {
                      resetExamState();
                      setView(VIEWS.LIST);
                    }}
                    className="w-full px-10 py-6 rounded-2xl bg-gradient-to-r from-brandBlue to-brandGreen hover:from-brandBlue/90 hover:to-brandGreen/90 text-white font-extrabold text-2xl transition-all duration-300 transform hover:scale-105 shadow-2xl"
                  >
                    📋 Ver Outros Simulados
                  </button>

                  <div className="grid grid-cols-3 gap-4">
                    <button
                      onClick={() => setShowCorrections(!showCorrections)}
                      className="px-6 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
                    >
                      {showCorrections ? "🔒 Ocultar" : "📝 Ver Correção"}
                    </button>
                    
                    <a
                      href={getWhatsAppLink()}
                      target="_blank"
                      rel="noreferrer"
                      className="px-6 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold transition-all duration-300 transform hover:scale-105 shadow-lg text-center"
                    >
                      💬 WhatsApp
                    </a>
                    
                    <button
                      onClick={() => {
                        setView(VIEWS.USER_INFO);
                      }}
                      className="px-6 py-4 rounded-2xl bg-white/20 hover:bg-white/30 transition-all duration-300 font-bold border-2 border-white/40"
                    >
                      🔄 Repetir
                    </button>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t-2 border-white/30 text-center">
                  <p className="text-white/70 text-sm mb-2">
                    💡 <strong>Dica:</strong> Tens sugestões ou opiniões sobre este simulado?
                  </p>
                  <p className="text-white/80 text-sm">
                    Envia-nos feedback pelo WhatsApp para melhorarmos continuamente!
                  </p>
                </div>
              </div>

              <AnimatePresence>
                {showCorrections && attemptResult.detailedResults && attemptResult.detailedResults.some(r => !r.isCorrect && r.question.type === "mcq") && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mt-8 bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-xl p-8 rounded-3xl border-2 border-white/30 shadow-2xl"
                  >
                    <h3 className="font-extrabold text-white mb-6 flex items-center gap-3 text-3xl">
                      📖 Revisão Detalhada
                    </h3>
                    <p className="text-white/80 mb-8 text-lg">
                      Reveja as questões que errou para melhorar seu desempenho:
                    </p>
                    
                    <div className="space-y-6">
                      {attemptResult.detailedResults
                        .map((result, idx) => ({ ...result, originalIndex: idx }))
                        .filter(r => !r.isCorrect && r.question.type === "mcq")
                        .map((result) => (
                          <div key={result.originalIndex} className="bg-gradient-to-br from-red-500/20 to-red-600/10 p-6 rounded-2xl border-2 border-red-400/40 backdrop-blur-md">
                            <div className="flex items-start gap-4 mb-4">
                              <span className="flex-shrink-0 w-12 h-12 rounded-2xl bg-red-500/30 text-red-400 flex items-center justify-center font-extrabold text-lg border-2 border-red-400/50">
                                {result.originalIndex + 1}
                              </span>
                              <div className="flex-1">
                                <div className="text-xs text-white/60 font-semibold mb-2 uppercase tracking-wider">
                                  Questão {result.originalIndex + 1} • {result.question.points} pontos
                                </div>
                                <p className="text-white font-bold text-lg mb-4 leading-relaxed">
                                  {result.question.question}
                                </p>
                                
                                <div className="space-y-3">
                                  {result.question.choices.map((choice, choiceIdx) => {
                                    const isUserAnswer = result.userAnswer === choiceIdx;
                                    const isCorrectAnswer = result.correctAnswer === choiceIdx;
                                    
                                    return (
                                      <div
                                        key={choiceIdx}
                                        className={`p-4 rounded-xl text-sm font-semibold transition-all ${
                                          isCorrectAnswer
                                            ? 'bg-gradient-to-r from-brandGreen to-green-500 border-2 border-white text-white shadow-xl'
                                            : isUserAnswer
                                            ? 'bg-gradient-to-r from-red-500 to-red-600 border-2 border-red-300 text-white shadow-lg'
                                            : 'bg-white/10 text-white/70 border-2 border-white/20'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          {isCorrectAnswer && <span className="text-2xl">✓</span>}
                                          {isUserAnswer && !isCorrectAnswer && <span className="text-2xl">✗</span>}
                                          <span className="flex-1">{choice}</span>
                                          {isCorrectAnswer && <span className="text-xs bg-white/20 px-3 py-1 rounded-full">CORRETA</span>}
                                          {isUserAnswer && !isCorrectAnswer && <span className="text-xs bg-white/20 px-3 py-1 rounded-full">SUA RESPOSTA</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </div>
      </div>
    </Layout>
  );
}