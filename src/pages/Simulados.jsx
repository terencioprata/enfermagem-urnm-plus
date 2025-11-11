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
    } else if (q.type === "open") {
      const givenAnswer = answers[q.id];
      if (givenAnswer && typeof givenAnswer === "string" && givenAnswer.trim().length > 0) {
        earnedPoints += points;
      }
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

const playAlertSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log("Audio não suportado");
  }
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
  const hasPlayedAlert = useRef(false);

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

  useEffect(() => {
    if (timeLeft !== null && timeLeft <= 10 && timeLeft > 0 && !hasPlayedAlert.current) {
      playAlertSound();
      hasPlayedAlert.current = true;
    }
    if (timeLeft > 10) {
      hasPlayedAlert.current = false;
    }
  }, [timeLeft]);

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
      } else if (q.type === "open") {
        if (userAnswer && typeof userAnswer === "string" && userAnswer.trim().length > 0) {
          correctCount++;
          isCorrect = true;
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

  const startTimer = useCallback((duration) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setTimeLeft(duration);
    hasPlayedAlert.current = false;
    
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
  }, [finishExam]);

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
    hasPlayedAlert.current = false;
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
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -5, boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.4)" }}
        transition={{ duration: 0.2 }}
        className="bg-white/10 backdrop-blur-sm p-5 rounded-2xl shadow-xl border border-white/20 flex flex-col justify-between hover:border-white/40 hover:bg-white/15"
      >
        <div>
          <h3 className="text-xl font-bold mb-2 text-white">
            {simulado.title}
          </h3>
          <p className="text-sm text-white/85 mb-4 line-clamp-2 leading-relaxed">
            {simulado.description || simulado.excerpt || "Sem descrição disponível"}
          </p>
          
          <div className="flex items-center gap-4 text-xs mb-3">
            <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
              <span>📝</span>
              <span className="font-semibold text-white">{questionCount} questões</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
              <span>⏱️</span>
              <span className="font-semibold text-white">{durationMinutes} min</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setCurrentSimulado(simulado);
            setView(VIEWS.USER_INFO);
          }}
          className="w-full bg-gradient-to-r from-brandBlue to-brandGreen text-white font-bold px-5 py-3 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg text-sm"
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
        className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20 shadow-xl"
      >
        <div className="mb-5">
          <div className="text-xs text-white/75 mb-2 font-semibold uppercase tracking-wide">
            Questão {index + 1} de {questions.length}
          </div>
          <h3 className="text-lg font-bold text-white leading-relaxed">
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
                    block p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-2
                    ${isSelected 
                      ? "bg-gradient-to-r from-brandGreen to-brandBlue text-white font-bold shadow-lg border-white" 
                      : "bg-white/10 text-white hover:bg-white/20 border-white/30"
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
                  <span className="text-base">{choice}</span>
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
            className="w-full p-4 rounded-xl bg-white/10 text-white outline-none focus:ring-2 focus:ring-brandBlue/60 border-2 border-white/25 focus:border-brandBlue resize-none backdrop-blur-sm placeholder-white/50"
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
                  className="text-4xl font-extrabold text-center mb-3 text-white drop-shadow-lg"
                >
                  🧾 Simulados Disponíveis
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-center text-white/90 mb-10 max-w-2xl mx-auto font-medium"
                >
                  Seleciona um simulado e inicia o modo prova. Cada tentativa será registada automaticamente.
                </motion.p>

                <div className="max-w-2xl mx-auto mb-8">
                  <div className="bg-white/10 backdrop-blur-sm p-2 rounded-2xl border border-white/25 shadow-xl">
                    <input
                      type="text"
                      placeholder="🔍 Pesquisar simulados..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-5 py-3 rounded-xl bg-white/15 text-white placeholder-white/65 outline-none font-semibold border-2 border-transparent focus:border-white/40"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-3 mb-10">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-5 py-2.5 rounded-full bg-white/15 backdrop-blur-sm text-white font-semibold outline-none cursor-pointer border-2 border-white/35 hover:border-white/50 text-sm"
                  >
                    <option value="recent" className="bg-gray-800">Mais Recentes</option>
                    <option value="oldest" className="bg-gray-800">Mais Antigos</option>
                    <option value="title" className="bg-gray-800">Nome (A-Z)</option>
                    <option value="questions" className="bg-gray-800">Mais Questões</option>
                  </select>

                  <div className="flex flex-wrap gap-2">
                    {temas.map(tema => (
                      <button
                        key={tema}
                        onClick={() => setFilterTema(tema === "Todos" ? "all" : tema)}
                        className={`px-5 py-2.5 rounded-full font-semibold transition-all duration-200 border-2 text-sm ${
                          (filterTema === "all" && tema === "Todos") || filterTema === tema
                            ? "bg-white text-black border-white shadow-lg"
                            : "bg-white/15 text-white border-white/35 hover:bg-white/25 hover:border-white/50"
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
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
                  >
                    <div className="bg-gradient-to-br from-red-500/90 to-red-600/90 backdrop-blur-xl p-6 rounded-2xl border-2 border-white/30 shadow-2xl max-w-sm w-full">
                      <div className="text-center">
                        <div className="text-5xl mb-3">⚠️</div>
                        <h3 className="text-xl font-bold text-white mb-2">Erro</h3>
                        <p className="text-white/95 mb-5 text-sm">{error}</p>
                        <button
                          onClick={() => setError(null)}
                          className="px-6 py-2.5 rounded-xl bg-white text-red-600 font-bold hover:scale-105 transition-transform text-sm"
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {loading.list ? (
                  <div className="flex justify-center items-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-white"></div>
                  </div>
                ) : filteredAndSortedSimulados.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAndSortedSimulados.map(renderSimuladoCard)}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16"
                  >
                    <div className="text-7xl mb-4">📚</div>
                    <p className="text-white/70 text-xl font-semibold">
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
              <div className="bg-white/15 backdrop-blur-lg p-7 rounded-2xl border-2 border-white/25 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {currentSimulado.title}
                </h2>
                <p className="text-white/85 mb-6">
                  Antes de começar, por favor identifica-te (opcional)
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm text-white/85 mb-1.5 font-semibold">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="O teu nome"
                      className="w-full p-3 rounded-xl bg-white/10 text-white border-2 border-white/25 outline-none focus:ring-2 focus:ring-brandBlue/50 focus:border-brandBlue placeholder-white/55"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/85 mb-1.5 font-semibold">
                      Email
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="O teu email"
                      className="w-full p-3 rounded-xl bg-white/10 text-white border-2 border-white/25 outline-none focus:ring-2 focus:ring-brandBlue/50 focus:border-brandBlue placeholder-white/55"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => startSimulado(currentSimulado)}
                    className="flex-1 bg-gradient-to-r from-brandGreen to-brandBlue text-white font-bold px-6 py-3 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    Começar Agora
                  </button>
                  <button
                    onClick={() => {
                      setView(VIEWS.LIST);
                      setCurrentSimulado(null);
                    }}
                    className="px-6 py-3 rounded-xl bg-white/15 hover:bg-white/25 transition-all duration-200 border-2 border-white/35 font-semibold text-white"
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
              <div className="bg-white/15 backdrop-blur-lg p-5 rounded-2xl mb-6 border-2 border-white/25 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {currentSimulado.title}
                    </h2>
                    <p className="text-sm text-white/85">
                      {currentSimulado.description || currentSimulado.excerpt}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-white/80 mb-1 font-semibold">
                      ⏱️ Tempo restante
                    </div>
                    <motion.div 
                      className={`
                        text-4xl font-mono font-extrabold
                        ${timeLeft <= 60 ? 'text-red-300' : 'text-white'}
                      `}
                      animate={timeLeft <= 10 ? {
                        scale: [1, 1.15, 1],
                        textShadow: [
                          "0 0 0px rgba(255,255,255,0)",
                          "0 0 15px rgba(255,0,0,0.8)",
                          "0 0 0px rgba(255,255,255,0)"
                        ]
                      } : {}}
                      transition={timeLeft <= 10 ? {
                        duration: 1,
                        repeat: Infinity
                      } : {}}
                    >
                      {formatTime(timeLeft)}
                    </motion.div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-white/80 mb-2 font-semibold">
                    <span>Progresso: {answeredCount}/{questions.length}</span>
                    <span>{progressPercentage}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-brandGreen to-brandBlue"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 space-y-6">
                  <AnimatePresence mode="wait">
                    {renderQuestionCard(questions[currentIndex], currentIndex)}
                  </AnimatePresence>

                  <div className="flex justify-between items-center gap-3">
                    <button
                      onClick={goPrev}
                      disabled={currentIndex === 0}
                      className="px-6 py-3 rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 font-bold text-white border-2 border-white/30 text-sm"
                    >
                      ← Anterior
                    </button>

                    <div className="flex gap-3">
                      {currentIndex < questions.length - 1 ? (
                        <button
                          onClick={goNext}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-brandBlue to-brandGreen hover:from-brandBlue/90 hover:to-brandGreen/90 font-bold transition-all duration-200 shadow-lg text-white text-sm"
                        >
                          Próxima →
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowFinishModal(true)}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-brandGreen to-brandBlue hover:from-brandGreen/90 hover:to-brandBlue/90 text-white font-bold transition-all duration-200 transform hover:scale-105 shadow-lg text-sm"
                        >
                          Terminar e Enviar ✓
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <aside className="lg:col-span-1">
                  <div className="bg-white/15 backdrop-blur-lg p-5 rounded-2xl border-2 border-white/25 sticky top-24 space-y-5 shadow-xl">
                    <div>
                      <h3 className="text-xs font-bold text-white mb-3 uppercase tracking-wide">
                        Mapa de Questões
                      </h3>
                      <div className="grid grid-cols-5 gap-1.5">
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
                                aspect-square rounded-lg text-xs font-bold
                                transition-all duration-200 transform hover:scale-110
                                ${isCurrent 
                                  ? 'bg-gradient-to-r from-brandBlue to-brandGreen text-white ring-2 ring-white shadow-lg' 
                                  : isAnswered 
                                    ? 'bg-brandGreen text-black shadow-md' 
                                    : 'bg-white/25 text-white hover:bg-white/35 border border-white/40'
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

                    <div className="pt-3 border-t border-white/25">
                      <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">
                        Informações
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-white/75 font-medium">Nome:</span>
                          <div className="text-white font-bold">
                            {userName || "—"}
                          </div>
                        </div>
                        <div>
                          <span className="text-white/75 font-medium">Email:</span>
                          <div className="text-white font-bold truncate">
                            {userEmail || "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/25">
                      <button
                        onClick={abortExam}
                        className="w-full px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-all duration-200 shadow-md text-sm"
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
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: "spring", duration: 0.4 }}
                  className="bg-gradient-to-br from-brandBlue/95 to-brandGreen/95 backdrop-blur-xl p-7 rounded-2xl border-2 border-white/40 shadow-2xl max-w-sm w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center">
                    <motion.div 
                      className="text-5xl mb-4"
                      animate={{ 
                        scale: [1, 1.15, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        duration: 0.7,
                        repeat: Infinity,
                        repeatDelay: 1
                      }}
                    >
                      ⚠️
                    </motion.div>
                    <h3 className="text-2xl font-extrabold text-white mb-3">
                      Terminar Simulado?
                    </h3>
                    <p className="text-white/90 mb-6 text-sm leading-relaxed">
                      Tem certeza que deseja finalizar e enviar suas respostas? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowFinishModal(false)}
                        className="flex-1 px-5 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold transition-all transform hover:scale-105 border-2 border-white/35 text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          setShowFinishModal(false);
                          finishExam(false);
                        }}
                        className="flex-1 px-5 py-3 rounded-xl bg-white text-black font-extrabold transition-all transform hover:scale-105 shadow-xl text-sm"
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white/15 backdrop-blur-lg p-6 rounded-2xl border-2 border-white/25 shadow-2xl">
                <div className="text-center mb-6">
                  <motion.div 
                    className="text-5xl mb-3"
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 10, -10, 0]
                    }}
                    transition={{ 
                      duration: 1,
                      repeat: 2
                    }}
                  >
                    {attemptResult.score >= 15 ? "🎉" : attemptResult.score >= 10 ? "👍" : "📚"}
                  </motion.div>
                  <h2 className="text-3xl font-extrabold text-white mb-2">
                    {attemptResult.autoFinish ? "Tempo Esgotado!" : "Simulado Concluído!"}
                  </h2>
                  <p className="text-white/85">
                    {userName 
                      ? `Obrigado, ${userName}!` 
                      : "Obrigado pela participação!"
                    }
                  </p>
                </div>

                <div className="bg-gradient-to-r from-brandGreen/30 to-brandBlue/30 backdrop-blur-sm p-5 rounded-xl mb-5 text-center border border-white/25">
                  <div className="text-xs text-white/80 mb-1 font-bold uppercase tracking-wide">
                    A Tua Pontuação
                  </div>
                  <div className="text-5xl font-extrabold text-white mb-2">
                    {attemptResult.score.toFixed(2)}
                  </div>
                  <div className="text-xl text-white/90 font-bold mb-3">
                    / 20 valores
                  </div>
                  
                  <div className="text-white/85 text-sm font-semibold">
                    {attemptResult.score >= 15 && "Excelente desempenho! 🌟"}
                    {attemptResult.score >= 10 && attemptResult.score < 15 && "Bom trabalho! Continue a estudar. 📖"}
                    {attemptResult.score < 10 && "Continue a praticar! Não desistas. 💪"}
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm p-5 rounded-xl mb-5 border border-white/20">
                  <h3 className="font-extrabold text-white mb-3 flex items-center gap-2 text-lg">
                    📊 Resumo Detalhado
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/10 p-3 rounded-lg border border-white/25">
                      <div className="text-white/75 text-xs font-semibold mb-1">Total de Questões</div>
                      <div className="text-2xl font-extrabold text-white">
                        {questions.length}
                      </div>
                    </div>
                    
                    <div className="bg-brandGreen/20 p-3 rounded-lg border border-brandGreen/40">
                      <div className="text-white/75 text-xs font-semibold mb-1">Acertadas</div>
                      <div className="text-2xl font-extrabold text-brandGreen">
                        {attemptResult.correctCount || 0}
                      </div>
                    </div>
                    
                    <div className="bg-red-400/20 p-3 rounded-lg border border-red-400/40">
                      <div className="text-white/75 text-xs font-semibold mb-1">Erradas</div>
                      <div className="text-2xl font-extrabold text-red-300">
                        {attemptResult.wrongCount || 0}
                      </div>
                    </div>
                    
                    <div className="bg-white/10 p-3 rounded-lg border border-white/25">
                      <div className="text-white/75 text-xs font-semibold mb-1">Taxa de Acerto</div>
                      <div className="text-2xl font-extrabold text-white">
                        {questions.length > 0 
                          ? Math.round((attemptResult.correctCount / questions.length) * 100)
                          : 0}%
                      </div>
                    </div>
                  </div>
                </div>

                {!attemptResult.saved && (
                  <div className="bg-yellow-500/25 border border-yellow-500/50 p-3 rounded-xl mb-5 text-white backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⚠️</span>
                      <div className="text-xs">
                        <div className="font-bold mb-0.5">Aviso</div>
                        <div>A tua tentativa não foi guardada. Contacta o suporte se necessário.</div>
                      </div>
                    </div>
                  </div>
                )}

                {loading.saving && (
                  <div className="bg-brandBlue/25 border border-brandBlue/50 p-3 rounded-xl mb-5 text-white flex items-center gap-3 backdrop-blur-sm text-sm">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="font-semibold">A guardar a tua tentativa...</span>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      resetExamState();
                      setView(VIEWS.LIST);
                    }}
                    className="w-full px-7 py-4 rounded-xl bg-gradient-to-r from-brandBlue to-brandGreen hover:from-brandBlue/90 hover:to-brandGreen/90 text-white font-extrabold text-lg transition-all duration-200 transform hover:scale-105 shadow-xl"
                  >
                    📋 Ver Outros Simulados
                  </button>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setShowCorrections(!showCorrections)}
                      className="px-3 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold transition-all duration-200 transform hover:scale-105 shadow-md text-xs"
                    >
                      {showCorrections ? "🔒 Ocultar" : "📝 Correção"}
                    </button>
                    
                    <a
                      href={getWhatsAppLink()}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold transition-all duration-200 transform hover:scale-105 shadow-md text-center text-xs"
                    >
                      💬 WhatsApp
                    </a>
                    
                    <button
                      onClick={() => {
                        setView(VIEWS.USER_INFO);
                      }}
                      className="px-3 py-2.5 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 font-bold border border-white/35 text-white text-xs"
                    >
                      🔄 Repetir
                    </button>
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-white/25 text-center">
                  <p className="text-white/75 text-xs mb-1">
                    💡 <strong>Dica:</strong> Tens sugestões ou opiniões sobre este simulado?
                  </p>
                  <p className="text-white/85 text-xs font-semibold">
                    Envia-nos feedback pelo WhatsApp para melhorarmos continuamente!
                  </p>
                </div>
              </div>

              <AnimatePresence>
                {showCorrections && attemptResult.detailedResults && attemptResult.detailedResults.some(r => !r.isCorrect && r.question.type === "mcq") && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="mt-5 bg-white/15 backdrop-blur-lg p-5 rounded-2xl border-2 border-white/25 shadow-xl"
                  >
                    <h3 className="font-extrabold text-white mb-3 flex items-center gap-2 text-xl">
                      📖 Revisão Detalhada
                    </h3>
                    <p className="text-white/85 mb-4 text-sm">
                      Reveja as questões que errou para melhorar seu desempenho:
                    </p>
                    
                    <div className="space-y-4">
                      {attemptResult.detailedResults
                        .map((result, idx) => ({ ...result, originalIndex: idx }))
                        .filter(r => !r.isCorrect && r.question.type === "mcq")
                        .map((result) => (
                          <div key={result.originalIndex} className="bg-red-500/15 p-4 rounded-xl border border-red-400/35 backdrop-blur-sm">
                            <div className="flex items-start gap-3 mb-3">
                              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/25 text-red-300 flex items-center justify-center font-extrabold text-sm border border-red-400/40">
                                {result.originalIndex + 1}
                              </span>
                              <div className="flex-1">
                                <div className="text-xs text-white/70 font-bold mb-1.5 uppercase tracking-wide">
                                  Questão {result.originalIndex + 1} • {result.question.points} pontos
                                </div>
                                <p className="text-white font-bold text-sm mb-3 leading-relaxed">
                                  {result.question.question}
                                </p>
                                
                                <div className="space-y-2">
                                  {result.question.choices.map((choice, choiceIdx) => {
                                    const isUserAnswer = result.userAnswer === choiceIdx;
                                    const isCorrectAnswer = result.correctAnswer === choiceIdx;
                                    
                                    return (
                                      <div
                                        key={choiceIdx}
                                        className={`p-2.5 rounded-lg text-xs font-semibold transition-all ${
                                          isCorrectAnswer
                                            ? 'bg-gradient-to-r from-brandGreen to-green-500 border border-white/60 text-white shadow-md'
                                            : isUserAnswer
                                            ? 'bg-gradient-to-r from-red-500 to-red-600 border border-red-300 text-white shadow-sm'
                                            : 'bg-white/10 text-white/75 border border-white/20'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {isCorrectAnswer && <span className="text-base">✓</span>}
                                          {isUserAnswer && !isCorrectAnswer && <span className="text-base">✗</span>}
                                          <span className="flex-1">{choice}</span>
                                          {isCorrectAnswer && <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">CORRETA</span>}
                                          {isUserAnswer && !isCorrectAnswer && <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">SUA RESPOSTA</span>}
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