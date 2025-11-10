// src/pages/AdminDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { posts as localPosts } from "../data/posts";

/**
 * Painel administrativo - Versão melhorada para Simulados
 * 
 * Melhorias:
 * - Interface simplificada para colar JSON completo
 * - Validação robusta do formato JSON
 * - Visualização prévia das questões
 * - Edição de simulados existentes
 * - Gerador de template JSON
 */

export default function AdminDashboard() {
  const [autenticado, setAutenticado] = useState(false);
  const [senha, setSenha] = useState("");
  const ADMIN_PASSWORD = "admin3000";

  const [section, setSection] = useState("posts");
  const [loading, setLoading] = useState(false);

  // POSTS
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", excerpt: "", content: "", imageFile: null, featured: false });

  // SIMULADOS
  const [simulados, setSimulados] = useState([]);
  const [editingSimulado, setEditingSimulado] = useState(null);
  const [simuladoJSON, setSimuladoJSON] = useState("");
  const [jsonPreview, setJsonPreview] = useState(null);
  const [jsonError, setJsonError] = useState(null);

  // PARTICIPANTES / ATTEMPTS
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    if (autenticado) loadAll();
  }, [autenticado]);

  // Validar JSON em tempo real
  useEffect(() => {
    if (!simuladoJSON.trim()) {
      setJsonPreview(null);
      setJsonError(null);
      return;
    }

    try {
      const parsed = JSON.parse(simuladoJSON);
      const validation = validateSimuladoJSON(parsed);
      
      if (validation.valid) {
        setJsonPreview(validation.data);
        setJsonError(null);
      } else {
        setJsonPreview(null);
        setJsonError(validation.error);
      }
    } catch (err) {
      setJsonPreview(null);
      setJsonError(`Erro de sintaxe JSON: ${err.message}`);
    }
  }, [simuladoJSON]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadPosts(), loadSimulados(), loadAttempts()]);
    setLoading(false);
  }

  // ============================================================================
  // POSTS (mantido como original)
  // ============================================================================
  
  async function loadPosts() {
    try {
      const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error("Erro loadPosts:", err);
      setPosts([]);
    }
  }

  async function uploadImage(file) {
    if (!file) return null;
    try {
      const ext = file.name.split(".").pop();
      const filename = `${Date.now()}.${ext}`;
      const bucket = "posts";
      const { data: upData, error: upErr } = await supabase.storage.from(bucket).upload(filename, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) console.warn("upload image warning:", upErr);
      
      const { data: publicData } = await supabase.storage.from(bucket).getPublicUrl(filename);
      return publicData?.publicUrl || publicData?.publicURL || null;
    } catch (err) {
      console.error("Erro uploadImage:", err);
      return null;
    }
  }

  async function savePost(e) {
    e?.preventDefault();
    try {
      let image_url = editing?.image_url || null;
      if (form.imageFile) {
        const uploaded = await uploadImage(form.imageFile);
        if (uploaded) image_url = uploaded;
      }
      const postData = {
        title: form.title,
        excerpt: form.excerpt,
        content: form.content,
        image_url,
        featured: form.featured ?? false,
      };
      if (editing) {
        const { error } = await supabase.from("posts").update(postData).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("posts").insert([postData]);
        if (error) throw error;
      }
      setForm({ title: "", excerpt: "", content: "", imageFile: null, featured: false });
      setEditing(null);
      await loadPosts();
      alert("Guardado com sucesso!");
    } catch (err) {
      console.error("Erro savePost:", err);
      alert("Erro ao guardar post. Veja console.");
    }
  }

  function startEdit(p) {
    setEditing(p);
    setForm({
      title: p.title || "",
      excerpt: p.excerpt || "",
      content: p.content || "",
      imageFile: null,
      featured: !!p.featured,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deletePost(id) {
    if (!confirm("Eliminar este post?")) return;
    try {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
      await loadPosts();
    } catch (err) {
      console.error("Erro deletePost:", err);
      alert("Erro ao eliminar.");
    }
  }

  async function toggleFeatured(p) {
    try {
      const { error } = await supabase.from("posts").update({ featured: !p.featured }).eq("id", p.id);
      if (error) throw error;
      await loadPosts();
    } catch (err) {
      console.error("Erro toggleFeatured:", err);
      alert("Erro ao atualizar destaque.");
    }
  }

  const localOnly = useMemo(() => {
    const remoteTitles = new Set((posts || []).map((p) => (p.title || "").trim().toLowerCase()));
    return (localPosts || []).filter((lp) => !remoteTitles.has((lp.title || "").trim().toLowerCase()));
  }, [posts]);

  async function addLocalToSupabase(local) {
    try {
      const postData = {
        title: local.title,
        excerpt: local.excerpt,
        content: local.content || "",
        image_url: local.image || null,
        featured: !!local.featured,
      };
      const { error } = await supabase.from("posts").insert([postData]);
      if (error) throw error;
      await loadPosts();
      alert(`Post "${local.title}" adicionado ao Supabase.`);
    } catch (err) {
      console.error("Erro addLocalToSupabase:", err);
      alert("Erro ao adicionar post local.");
    }
  }

  async function syncAllLocal() {
    if (!localOnly.length) return alert("Nenhum post local pendente.");
    if (!confirm(`Adicionar ${localOnly.length} post(s) locais ao Supabase?`)) return;
    let count = 0;
    for (const lp of localOnly) {
      try {
        await addLocalToSupabase(lp);
        count++;
      } catch (e) {
        console.error("Erro sync item:", e);
      }
    }
    alert(`Sincronização concluída. ${count} adicionados.`);
    await loadPosts();
  }

  // ============================================================================
  // SIMULADOS - NOVA IMPLEMENTAÇÃO
  // ============================================================================

  async function loadSimulados() {
    try {
      const { data, error } = await supabase
        .from("simulados")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Normalizar: garantir que questions é um array
      const normalized = (data || []).map((s) => ({
        ...s,
        questions: parseQuestions(s.questions)
      }));
      
      setSimulados(normalized);
    } catch (err) {
      console.error("Erro loadSimulados:", err);
      setSimulados([]);
    }
  }

  function parseQuestions(questionsData) {
    try {
      if (Array.isArray(questionsData)) return questionsData;
      if (typeof questionsData === "string") {
        return JSON.parse(questionsData);
      }
      return [];
    } catch (e) {
      console.error("Erro ao fazer parse das questões:", e);
      return [];
    }
  }

  /**
   * Valida o JSON do simulado e normaliza para o formato esperado
   * Aceita múltiplos formatos e converte para o padrão
   */
  function validateSimuladoJSON(data) {
    try {
      // Aceitar formato simplificado ou completo
      let title, description, questions, timeSeconds;

      // Formato 1: { title, description, questions, total_time_seconds }
      if (data.title || data.titulo) {
        title = data.title || data.titulo;
        description = data.description || data.descricao || data.excerpt || "";
        questions = data.questions || data.perguntas || [];
        timeSeconds = data.total_time_seconds || data.time_seconds || data.duracao || 1200;
      }
      // Formato 2: Apenas array de questões
      else if (Array.isArray(data)) {
        return {
          valid: false,
          error: "JSON deve incluir 'title' e 'questions'. Use o template fornecido."
        };
      }
      else {
        return {
          valid: false,
          error: "Formato JSON inválido. Use o template fornecido."
        };
      }

      // Validar título
      if (!title || title.trim().length === 0) {
        return {
          valid: false,
          error: "O campo 'title' é obrigatório e não pode estar vazio."
        };
      }

      // Validar questões
      if (!Array.isArray(questions) || questions.length === 0) {
        return {
          valid: false,
          error: "O campo 'questions' deve ser um array com pelo menos 1 questão."
        };
      }

      // Normalizar questões para formato padrão
      const normalizedQuestions = questions.map((q, index) => {
        // Aceitar múltiplos nomes de campos
        const questionText = q.question || q.pergunta || q.text || q.texto;
        const questionType = q.type || q.tipo || "mcq";
        const choices = q.choices || q.options || q.opcoes || q.alternativas || [];
        const correct = q.correct !== undefined ? q.correct : (q.correctIndex !== undefined ? q.correctIndex : q.correta !== undefined ? q.correta : 0);
        const points = q.points || q.pontos || q.valor || 1;

        // Validação da questão
        if (!questionText || questionText.trim().length === 0) {
          throw new Error(`Questão ${index + 1}: texto da questão é obrigatório.`);
        }

        if (questionType === "mcq") {
          if (!Array.isArray(choices) || choices.length < 2) {
            throw new Error(`Questão ${index + 1}: questões de múltipla escolha precisam de pelo menos 2 opções.`);
          }
          if (typeof correct !== "number" || correct < 0 || correct >= choices.length) {
            throw new Error(`Questão ${index + 1}: índice da resposta correta inválido (deve ser entre 0 e ${choices.length - 1}).`);
          }
        }

        // Retornar formato normalizado
        return {
          id: q.id || `q_${index + 1}`,
          type: questionType,
          question: questionText.trim(),
          choices: questionType === "mcq" ? choices.map(c => String(c).trim()) : [],
          correct: questionType === "mcq" ? Number(correct) : null,
          points: Number(points)
        };
      });

      return {
        valid: true,
        data: {
          title: title.trim(),
          description: description.trim(),
          questions: normalizedQuestions,
          total_time_seconds: Number(timeSeconds)
        }
      };

    } catch (err) {
      return {
        valid: false,
        error: err.message || "Erro ao validar JSON."
      };
    }
  }

  /**
   * Salvar simulado (criar ou editar)
   */
  async function saveSimulado(e) {
    e?.preventDefault();
    
    if (!simuladoJSON.trim()) {
      alert("Cole o JSON do simulado no campo de texto.");
      return;
    }

    try {
      setLoading(true);
      
      const parsed = JSON.parse(simuladoJSON);
      const validation = validateSimuladoJSON(parsed);

      if (!validation.valid) {
        alert(`Erro de validação:\n${validation.error}`);
        return;
      }

      const { title, description, questions, total_time_seconds } = validation.data;

      const payload = {
        title,
        description,
        questions, // Supabase irá armazenar como JSONB automaticamente
        total_time_seconds
      };

      let result;
      if (editingSimulado) {
        // Atualizar simulado existente
        const { error } = await supabase
          .from("simulados")
          .update(payload)
          .eq("id", editingSimulado.id);
        
        if (error) throw error;
        alert("Simulado atualizado com sucesso!");
      } else {
        // Criar novo simulado
        const { error } = await supabase
          .from("simulados")
          .insert([payload]);
        
        if (error) throw error;
        alert("Simulado criado com sucesso!");
      }

      // Resetar formulário
      setSimuladoJSON("");
      setEditingSimulado(null);
      setJsonPreview(null);
      setJsonError(null);
      
      // Recarregar lista
      await loadSimulados();
      
    } catch (err) {
      console.error("Erro saveSimulado:", err);
      alert(`Erro ao salvar simulado:\n${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Carregar simulado para edição
   */
  function startEditSimulado(simulado) {
    setEditingSimulado(simulado);
    
    // Converter de volta para JSON formatado
    const jsonData = {
      title: simulado.title,
      description: simulado.description || "",
      total_time_seconds: simulado.total_time_seconds || 1200,
      questions: simulado.questions
    };
    
    setSimuladoJSON(JSON.stringify(jsonData, null, 2));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /**
   * Deletar simulado
   */
  async function deleteSimulado(id) {
    if (!confirm("Tem certeza que deseja eliminar este simulado? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from("simulados").delete().eq("id", id);
      if (error) throw error;
      
      alert("Simulado eliminado com sucesso!");
      await loadSimulados();
    } catch (err) {
      console.error("Erro deleteSimulado:", err);
      alert(`Erro ao eliminar simulado:\n${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Gerar template JSON
   */
  function generateTemplate() {
    const template = {
      title: "Nome do Simulado",
      description: "Descrição breve do simulado",
      total_time_seconds: 1200,
      questions: [
        {
          id: "q1",
          type: "mcq",
          question: "Qual é a capital de Angola?",
          choices: [
            "Luanda",
            "Benguela",
            "Huambo",
            "Lobito"
          ],
          correct: 0,
          points: 1
        },
        {
          id: "q2",
          type: "mcq",
          question: "Quanto é 2 + 2?",
          choices: [
            "3",
            "4",
            "5",
            "6"
          ],
          correct: 1,
          points: 1
        },
        {
          id: "q3",
          type: "open",
          question: "Descreva a importância da enfermagem na saúde pública.",
          points: 2
        }
      ]
    };

    setSimuladoJSON(JSON.stringify(template, null, 2));
    setEditingSimulado(null);
  }

  /**
   * Duplicar simulado
   */
  async function duplicateSimulado(simulado) {
    if (!confirm(`Duplicar o simulado "${simulado.title}"?`)) return;

    const duplicate = {
      title: `${simulado.title} (Cópia)`,
      description: simulado.description,
      questions: simulado.questions,
      total_time_seconds: simulado.total_time_seconds
    };

    setSimuladoJSON(JSON.stringify(duplicate, null, 2));
    setEditingSimulado(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ============================================================================
  // PARTICIPANTES
  // ============================================================================

  async function loadAttempts() {
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select(`
          *,
          simulados (
            title
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setAttempts(data || []);
    } catch (err) {
      console.error("Erro loadAttempts:", err);
      setAttempts([]);
    }
  }

  function exportAttemptsCSV() {
    if (!attempts.length) return alert("Sem dados para exportar.");
    
    const headers = ["ID", "Simulado", "Nome", "Email", "Pontuação", "Data"];
    const rows = attempts.map(a => [
      a.id,
      a.simulados?.title || "N/A",
      a.user_name || "—",
      a.user_email || "—",
      a.score,
      new Date(a.created_at).toLocaleString()
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `participantes_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================================
  // LOGIN SCREEN
  // ============================================================================

  if (!autenticado) {
    const handleKeyPress = (e) => {
      if (e.key === "Enter" && senha === ADMIN_PASSWORD) {
        setAutenticado(true);
      }
    };
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1020] text-white p-6">
        <div className="w-full max-w-lg bg-[#111827] p-8 rounded-xl shadow-xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Painel Administrativo</h2>
          <input
            type="password"
            placeholder="Digite a senha..."
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-full p-3 mb-4 rounded-md bg-[#1f2937] border border-gray-600 focus:border-brandGreen outline-none"
          />
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (senha === ADMIN_PASSWORD) setAutenticado(true);
                else alert("Senha incorreta");
              }}
              className="flex-1 bg-brandGreen text-black py-3 rounded-md font-semibold hover:bg-green-400 transition"
            >
              Entrar
            </button>
            <button
              onClick={() => setSenha("")}
              className="flex-1 bg-gray-600 text-white py-3 rounded-md font-semibold hover:bg-gray-500 transition"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PAINEL PRINCIPAL
  // ============================================================================

  return (
    <div className="min-h-screen flex bg-[#0b1020] text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111827] p-6 flex flex-col">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brandGreen">Enfermagem URNM+</h1>
          <p className="text-sm text-gray-400">Painel de gestão</p>
        </div>

        <nav className="flex-1">
          {["posts", "simulados", "participants", "config"].map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`w-full text-left px-4 py-2 rounded mb-2 transition ${
                section === s ? "bg-brandGreen text-black" : "hover:bg-[#1f2937]"
              }`}
            >
              {s === "posts" && "📄 Posts"}
              {s === "simulados" && "🧾 Simulados"}
              {s === "participants" && "👥 Participantes"}
              {s === "config" && "⚙️ Configurações"}
            </button>
          ))}
        </nav>

        <button
          onClick={() => {
            setAutenticado(false);
            setSenha("");
          }}
          className="mt-auto bg-red-600 py-2 rounded-md hover:bg-red-500"
        >
          Sair
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold capitalize">{section}</h2>
          <p className="text-gray-400 text-sm">
            {posts.length} posts • {simulados.length} simulados • {attempts.length} participações
          </p>
        </header>

        {/* POSTS SECTION (mantido como original) */}
        {section === "posts" && (
          <>
            <div className="mb-4 flex gap-3 items-center">
              <button onClick={loadPosts} className="bg-brandBlue px-3 py-2 rounded text-white">
                Atualizar posts
              </button>
              <button onClick={syncAllLocal} className="bg-brandGreen text-black px-3 py-2 rounded">
                Sincronizar posts locais
              </button>
              <div className="text-sm text-gray-400 ml-auto">
                {loading ? "Carregando..." : `${posts.length} remotos • ${localOnly.length} locais não sincronizados`}
              </div>
            </div>

            <form onSubmit={savePost} className="bg-[#111827] p-6 rounded-lg mb-6 space-y-4">
              <div className="flex gap-3">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Título"
                  className="flex-1 p-3 rounded bg-[#1f2937] border border-gray-700 focus:border-brandGreen outline-none"
                />
                <input
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                  placeholder="Resumo"
                  className="w-72 p-3 rounded bg-[#1f2937] border border-gray-700 focus:border-brandGreen outline-none"
                />
              </div>

              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={6}
                placeholder="Conteúdo (HTML/Markdown)"
                className="w-full p-3 rounded bg-[#1f2937] border border-gray-700 focus:border-brandGreen outline-none"
              />

              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setForm({ ...form, imageFile: e.target.files[0] })}
                  className="text-sm"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  />
                  Destacar
                </label>
                <div className="ml-auto flex gap-2">
                  {editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setForm({ title: "", excerpt: "", content: "", imageFile: null, featured: false });
                      }}
                      className="bg-gray-600 px-3 py-2 rounded"
                    >
                      Cancelar
                    </button>
                  )}
                  <button type="submit" className="bg-brandGreen text-black px-4 py-2 rounded font-semibold">
                    {editing ? "Atualizar" : "Criar post"}
                  </button>
                </div>
              </div>
            </form>

            <div className="grid gap-4">
              {posts.map((p) => (
                <div key={p.id} className="bg-[#111827] p-4 rounded flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <img
                      src={p.image_url || p.image || "https://via.placeholder.com/150x90?text=Sem+Imagem"}
                      alt=""
                      className="w-24 h-16 object-cover rounded-md border border-gray-700"
                    />
                    <div>
                      <h3 className="font-semibold">{p.title}</h3>
                      <p className="text-gray-400 text-sm">{p.excerpt}</p>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(p.created_at || p.date).toLocaleString()}
                      </div>
                      {p.featured && (
                        <span className="inline-block mt-1 bg-yellow-400 text-black px-2 py-0.5 text-xs rounded">
                          Destaque
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => startEdit(p)} className="bg-brandBlue text-white px-3 py-1 rounded text-sm">
                      Editar
                    </button>
                    <button
                      onClick={() => toggleFeatured(p)}
                      className="bg-yellow-400 text-black px-3 py-1 rounded text-sm"
                    >
                      {p.featured ? "Remover destaque" : "Destacar"}
                    </button>
                    <button onClick={() => deletePost(p.id)} className="bg-red-600 px-3 py-1 rounded text-sm">
                      Excluir
                    </button>
                  </div>
                </div>
              ))}

              {localOnly.length > 0 && (
                <>
                  <h3 className="mt-6 text-lg font-semibold">Posts locais não sincronizados</h3>
                  {localOnly.map((lp, idx) => (
                    <div key={`local-${idx}`} className="bg-[#0f1724] p-4 rounded flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{lp.title}</h3>
                        <p className="text-gray-400 text-sm">{lp.excerpt}</p>
                        <div className="text-xs text-gray-500 mt-1">{lp.date || "Sem data"}</div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => addLocalToSupabase(lp)}
                          className="bg-brandGreen text-black px-3 py-1 rounded text-sm"
                        >
                          Adicionar ao Supabase
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}

        {/* SIMULADOS SECTION - NOVA IMPLEMENTAÇÃO */}
        {section === "simulados" && (
          <div className="space-y-6">
            {/* Formulário de JSON */}
            <div className="bg-[#111827] p-6 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">
                  {editingSimulado ? `Editar: ${editingSimulado.title}` : "Criar Novo Simulado"}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={generateTemplate}
                    className="bg-brandBlue text-white px-4 py-2 rounded text-sm hover:bg-brandBlue/90"
                  >
                    📋 Gerar Template
                  </button>
                  {editingSimulado && (
                    <button
                      onClick={() => {
                        setEditingSimulado(null);
                        setSimuladoJSON("");
                        setJsonPreview(null);
                        setJsonError(null);
                      }}
                      className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-500"
                    >
                      ✕ Cancelar Edição
                    </button>
                  )}
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Editor JSON */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-300">
                      JSON do Simulado
                    </label>
                    <button
                      onClick={() => {
                        setSimuladoJSON("");
                        setJsonPreview(null);
                        setJsonError(null);
                      }}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Limpar
                    </button>
                  </div>
                  
                  <textarea
                    value={simuladoJSON}
                    onChange={(e) => setSimuladoJSON(e.target.value)}
                    rows={20}
                    placeholder="Cole aqui o JSON do simulado..."
                    className="w-full p-4 rounded-lg bg-[#1f2937] border border-gray-700 focus:border-brandGreen outline-none font-mono text-sm"
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={saveSimulado}
                      disabled={loading || !simuladoJSON.trim() || !!jsonError}
                      className={`flex-1 py-3 rounded-lg font-semibold transition ${
                        loading || !simuladoJSON.trim() || !!jsonError
                          ? "bg-gray-600 cursor-not-allowed"
                          : "bg-brandGreen text-black hover:bg-green-400"
                      }`}
                    >
                      {loading ? "Guardando..." : editingSimulado ? "💾 Atualizar Simulado" : "✓ Criar Simulado"}
                    </button>
                  </div>
                </div>

                {/* Preview / Erro */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-300">
                    Pré-visualização
                  </label>

                  <div className="bg-[#1f2937] rounded-lg p-4 min-h-[400px] max-h-[600px] overflow-auto">
                    {jsonError && (
                      <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                        <div className="font-semibold text-red-400 mb-2">❌ Erro de Validação</div>
                        <div className="text-sm text-red-300">{jsonError}</div>
                      </div>
                    )}

                    {!jsonError && jsonPreview && (
                      <div className="space-y-4">
                        <div className="bg-brandGreen/20 border border-brandGreen/50 rounded-lg p-4">
                          <div className="font-semibold text-brandGreen mb-2">✓ JSON Válido</div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Título</div>
                            <div className="font-semibold text-white">{jsonPreview.title}</div>
                          </div>

                          {jsonPreview.description && (
                            <div>
                              <div className="text-xs text-gray-400 mb-1">Descrição</div>
                              <div className="text-sm text-gray-300">{jsonPreview.description}</div>
                            </div>
                          )}

                          <div>
                            <div className="text-xs text-gray-400 mb-1">Duração</div>
                            <div className="text-sm text-gray-300">
                              {Math.round(jsonPreview.total_time_seconds / 60)} minutos
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-400 mb-2">
                              Questões ({jsonPreview.questions.length})
                            </div>
                            <div className="space-y-3">
                              {jsonPreview.questions.map((q, idx) => (
                                <div key={idx} className="bg-[#0f1724] p-3 rounded-lg">
                                  <div className="flex items-start gap-2 mb-2">
                                    <span className="text-xs font-mono bg-brandBlue/30 text-brandBlue px-2 py-0.5 rounded">
                                      Q{idx + 1}
                                    </span>
                                    <span className="text-xs font-mono bg-gray-700 px-2 py-0.5 rounded">
                                      {q.type === "mcq" ? "Múltipla Escolha" : "Aberta"}
                                    </span>
                                    <span className="text-xs font-mono bg-brandGreen/30 text-brandGreen px-2 py-0.5 rounded ml-auto">
                                      {q.points} pts
                                    </span>
                                  </div>
                                  <div className="text-sm text-white mb-2">{q.question}</div>
                                  {q.type === "mcq" && (
                                    <div className="space-y-1">
                                      {q.choices.map((choice, cIdx) => (
                                        <div
                                          key={cIdx}
                                          className={`text-xs p-2 rounded ${
                                            cIdx === q.correct
                                              ? "bg-brandGreen/20 text-brandGreen border border-brandGreen/50"
                                              : "bg-[#111827] text-gray-400"
                                          }`}
                                        >
                                          {cIdx === q.correct && "✓ "}{choice}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {!jsonError && !jsonPreview && (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <div className="text-4xl mb-3">📝</div>
                        <div className="text-sm">Cole o JSON à esquerda para ver a pré-visualização</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Instruções e Exemplo */}
              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-semibold text-gray-300 hover:text-white">
                  📖 Ver Instruções e Formato JSON
                </summary>
                <div className="mt-4 p-4 bg-[#0f1724] rounded-lg space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold text-white mb-2">Formato JSON Aceite:</h4>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                      <li><code>title</code> ou <code>titulo</code> - Título do simulado (obrigatório)</li>
                      <li><code>description</code> ou <code>descricao</code> - Descrição breve (opcional)</li>
                      <li><code>total_time_seconds</code> - Duração em segundos (padrão: 1200 = 20 min)</li>
                      <li><code>questions</code> ou <code>perguntas</code> - Array de questões (obrigatório)</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-white mb-2">Formato de cada questão:</h4>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                      <li><code>question</code> ou <code>pergunta</code> - Texto da questão</li>
                      <li><code>type</code> - "mcq" (múltipla escolha) ou "open" (aberta)</li>
                      <li><code>choices</code>, <code>options</code> ou <code>opcoes</code> - Array de opções (para MCQ)</li>
                      <li><code>correct</code> ou <code>correctIndex</code> - Índice da resposta correta (0, 1, 2...)</li>
                      <li><code>points</code> ou <code>pontos</code> - Pontos da questão (padrão: 1)</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-white mb-2">Exemplo Completo:</h4>
                    <pre className="bg-[#111827] p-3 rounded overflow-x-auto text-xs">
{`{
  "title": "Fundamentos de Enfermagem",
  "description": "Teste seus conhecimentos básicos",
  "total_time_seconds": 1800,
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question": "Qual é a via de administração mais rápida?",
      "choices": ["Oral", "Intravenosa", "Intramuscular", "Subcutânea"],
      "correct": 1,
      "points": 2
    },
    {
      "id": "q2",
      "type": "open",
      "question": "Descreva os 5 certos da administração de medicamentos.",
      "points": 3
    }
  ]
}`}
                    </pre>
                  </div>

                  <div className="bg-brandBlue/20 border border-brandBlue/50 rounded p-3">
                    <div className="font-semibold text-brandBlue mb-1">💡 Dica:</div>
                    <div className="text-gray-300">
                      Pode usar qualquer IA (ChatGPT, Claude, etc.) para gerar o JSON. 
                      Basta pedir: "Gera um JSON de simulado sobre [tema] com 10 questões no formato acima"
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {/* Lista de Simulados */}
            <div className="bg-[#111827] p-6 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Simulados Criados ({simulados.length})</h3>
                <button
                  onClick={loadSimulados}
                  className="bg-brandBlue text-white px-4 py-2 rounded text-sm hover:bg-brandBlue/90"
                >
                  🔄 Atualizar
                </button>
              </div>

              {simulados.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-5xl mb-3">📚</div>
                  <div>Nenhum simulado criado ainda.</div>
                  <div className="text-sm mt-2">Use o formulário acima para criar o primeiro.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {simulados.map((sim) => (
                    <div key={sim.id} className="bg-[#1f2937] p-4 rounded-lg">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white text-lg mb-1">{sim.title}</h4>
                          {sim.description && (
                            <p className="text-sm text-gray-400 mb-2">{sim.description}</p>
                          )}
                          
                          <div className="flex gap-4 text-xs text-gray-500">
                            <span>📝 {sim.questions.length} questões</span>
                            <span>⏱️ {Math.round((sim.total_time_seconds || 1200) / 60)} min</span>
                            <span>📅 {new Date(sim.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <a
                            href={`/simulados`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 bg-brandGreen text-black rounded text-sm font-semibold hover:bg-green-400 text-center"
                          >
                            👁️ Ver no Site
                          </a>
                          <button
                            onClick={() => startEditSimulado(sim)}
                            className="px-4 py-2 bg-brandBlue text-white rounded text-sm hover:bg-brandBlue/90"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => duplicateSimulado(sim)}
                            className="px-4 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-500"
                          >
                            📋 Duplicar
                          </button>
                          <button
                            onClick={() => deleteSimulado(sim.id)}
                            className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-500"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>

                      {/* Preview rápido das questões */}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-gray-400 hover:text-white">
                          Ver questões ({sim.questions.length})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {sim.questions.slice(0, 3).map((q, idx) => (
                            <div key={idx} className="bg-[#0f1724] p-2 rounded text-xs">
                              <div className="flex gap-2 items-center mb-1">
                                <span className="bg-gray-700 px-2 py-0.5 rounded">Q{idx + 1}</span>
                                <span className="bg-gray-700 px-2 py-0.5 rounded">{q.type}</span>
                              </div>
                              <div className="text-gray-300">{q.question}</div>
                            </div>
                          ))}
                          {sim.questions.length > 3 && (
                            <div className="text-xs text-gray-500 text-center">
                              ... e mais {sim.questions.length - 3} questões
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PARTICIPANTES */}
        {section === "participants" && (
          <div className="bg-[#111827] p-6 rounded-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Participações ({attempts.length})</h3>
              <div className="flex gap-2">
                <button
                  onClick={loadAttempts}
                  className="bg-brandBlue text-white px-4 py-2 rounded text-sm hover:bg-brandBlue/90"
                >
                  🔄 Atualizar
                </button>
                <button
                  onClick={exportAttemptsCSV}
                  disabled={attempts.length === 0}
                  className={`px-4 py-2 rounded text-sm font-semibold ${
                    attempts.length === 0
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-brandGreen text-black hover:bg-green-400"
                  }`}
                >
                  📥 Exportar CSV
                </button>
              </div>
            </div>

            {attempts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-5xl mb-3">👥</div>
                <div>Nenhuma participação registada ainda.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Simulado</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Nome</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Pontuação</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((attempt) => (
                      <tr key={attempt.id} className="border-b border-gray-800 hover:bg-[#1f2937]">
                        <td className="py-3 px-4 text-sm">
                          {attempt.simulados?.title || "Simulado removido"}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {attempt.user_name || <span className="text-gray-500">—</span>}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {attempt.user_email || <span className="text-gray-500">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-3 py-1 rounded text-sm font-semibold ${
                            attempt.score >= 15
                              ? "bg-brandGreen/20 text-brandGreen"
                              : attempt.score >= 10
                              ? "bg-yellow-500/20 text-yellow-500"
                              : "bg-red-500/20 text-red-500"
                          }`}>
                            {attempt.score.toFixed(2)} / 20
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {new Date(attempt.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CONFIG */}
        {section === "config" && (
          <div className="bg-[#111827] p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Configurações</h3>
            <p className="text-sm text-gray-400 mb-6">
              Ferramentas e utilitários para gestão do sistema.
            </p>

            <div className="space-y-4">
              <div className="bg-[#1f2937] p-4 rounded-lg">
                <h4 className="font-semibold mb-2">URL do Site</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={window.location.origin}
                    readOnly
                    className="flex-1 p-2 rounded bg-[#111827] border border-gray-700 text-gray-400"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin);
                      alert("URL copiada!");
                    }}
                    className="bg-brandGreen text-black px-4 py-2 rounded font-semibold hover:bg-green-400"
                  >
                    📋 Copiar
                  </button>
                </div>
              </div>

              <div className="bg-[#1f2937] p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Dados</h4>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (confirm("Recarregar todos os dados do Supabase?")) {
                        loadAll();
                      }
                    }}
                    className="bg-brandBlue text-white px-4 py-2 rounded hover:bg-brandBlue/90"
                  >
                    🔄 Recarregar Tudo
                  </button>
                  <button
                    onClick={() => {
                      const stats = {
                        posts: posts.length,
                        simulados: simulados.length,
                        attempts: attempts.length,
                        totalQuestions: simulados.reduce((sum, s) => sum + s.questions.length, 0)
                      };
                      alert(`Estatísticas:\n\n${JSON.stringify(stats, null, 2)}`);
                    }}
                    className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500"
                  >
                    📊 Ver Estatísticas
                  </button>
                </div>
              </div>

              <div className="bg-[#1f2937] p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Informações do Sistema</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-400">Posts</div>
                    <div className="text-xl font-bold text-white">{posts.length}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Simulados</div>
                    <div className="text-xl font-bold text-white">{simulados.length}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Participações</div>
                    <div className="text-xl font-bold text-white">{attempts.length}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Total de Questões</div>
                    <div className="text-xl font-bold text-white">
                      {simulados.reduce((sum, s) => sum + s.questions.length, 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}