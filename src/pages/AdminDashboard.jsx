// src/pages/AdminDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { posts as localPosts } from "../data/posts";

/**
 * Painel administrativo (posts + simulados + participantes)
 * Mantém o layout e visual escuro já aprovado.
 */

export default function AdminDashboard() {
  const [autenticado, setAutenticado] = useState(false);
  const [senha, setSenha] = useState("");
  const ADMIN_PASSWORD = "admin3000";

  const [section, setSection] = useState("posts"); // posts | simulados | participants | config
  const [loading, setLoading] = useState(false);

  // POSTS
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", excerpt: "", content: "", imageFile: null, featured: false });

  // SIMULADOS
  const [simulados, setSimulados] = useState([]);
  const [simForm, setSimForm] = useState({
    title: "",
    description: "",
    // questionsText is the raw JSON textarea (for advanced paste)
    questionsText: "",
    // simple mode add single question fields:
    q_text: "",
    q_options: "",
    q_correctIndex: 0,
    q_type: "mcq", // mcq | open
  });

  // PARTICIPANTES / ATTEMPTS
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    if (autenticado) loadAll();
    // eslint-disable-next-line
  }, [autenticado]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadPosts(), loadSimulados(), loadAttempts()]);
    setLoading(false);
  }

  // ---------- POSTS ----------
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
      if (upErr) {
        console.warn("upload image warning:", upErr);
        // continue: sometimes file exists => still try getPublicUrl
      }
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

  // ---------- SIMULADOS ----------
  async function loadSimulados() {
    try {
      const { data, error } = await supabase.from("simulados").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      // Normalize: ensure questions is parsed JSON
      const norm = (data || []).map((s) => ({
        ...s,
        questions: typeof s.questions === "string" ? JSON.parse(s.questions || "[]") : s.questions || [],
      }));
      setSimulados(norm);
    } catch (err) {
      console.error("Erro loadSimulados:", err);
      setSimulados([]);
    }
  }

  async function loadAttempts() {
    try {
      const { data, error } = await supabase.from("attempts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setAttempts(data || []);
    } catch (err) {
      console.error("Erro loadAttempts:", err);
      setAttempts([]);
    }
  }

  // validate questions array
  function validateQuestions(qs) {
    if (!Array.isArray(qs)) return "Questions deve ser um array.";
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (!q.pergunta && !q.question) return `Questão ${i + 1} sem texto (campo 'pergunta' ou 'question').`;
      // for mcq require options array and correctIndex
      if ((q.type === "mcq" || q.options) && (!Array.isArray(q.options) || q.options.length < 2)) {
        return `Questão ${i + 1}: 'options' deve ser array com pelo menos 2 itens.`;
      }
    }
    return null;
  }

  // Add simulado from textarea JSON or from simple-builder
  async function addSimuladoFromJSON(jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      const qErr = validateQuestions(parsed.perguntas || parsed.questions || []);
      if (qErr) {
        alert("Erro no formato das perguntas: " + qErr);
        return;
      }
      // Normalize structure: store as `questions`
      const payload = {
        title: parsed.titulo || parsed.title || simForm.title,
        description: parsed.descricao || parsed.description || simForm.description || "",
        questions: parsed.perguntas || parsed.questions || [],
      };
      const { error } = await supabase.from("simulados").insert([{ title: payload.title, description: payload.description, questions: payload.questions }]);
      if (error) throw error;
      await loadSimulados();
      alert("Simulado importado com sucesso!");
      setSimForm({ ...simForm, questionsText: "" });
    } catch (err) {
      console.error("Erro addSimuladoFromJSON:", err);
      alert("Erro ao importar JSON de simulado. Veja console.");
    }
  }

  // Add simulado built from simple UI (one question at a time)
  async function addSimuladoFromBuilder(e) {
    e?.preventDefault();
    try {
      // build questions array from stored temp fields (we support adding single question then saving)
      let parsedQs = [];
      // try parse simForm.questionsText first (if user pasted)
      if (simForm.questionsText && simForm.questionsText.trim()) {
        try {
          const p = JSON.parse(simForm.questionsText);
          if (Array.isArray(p)) parsedQs = p;
          else if (p.perguntas || p.questions) parsedQs = p.perguntas || p.questions;
        } catch (_) {
          // ignore, will continue with builder state if any
        }
      }
      // If builder fields have values, add them
      if (simForm.q_text && simForm.q_text.trim()) {
        const opts = simForm.q_options.split("|").map((s) => s.trim()).filter(Boolean);
        const q = {
          pergunta: simForm.q_text,
          type: simForm.q_type,
          options: simForm.q_type === "mcq" ? opts : [],
          correctIndex: simForm.q_type === "mcq" ? Number(simForm.q_correctIndex) || 0 : null,
        };
        parsedQs.push(q);
      }
      if (!simForm.title || !parsedQs.length) {
        alert("Preencha título e adicione pelo menos 1 questão (ou cole um JSON válido).");
        return;
      }
      const payload = {
        title: simForm.title,
        description: simForm.description || "",
        questions: parsedQs,
      };
      const { error } = await supabase.from("simulados").insert([{ title: payload.title, description: payload.description, questions: payload.questions }]);
      if (error) throw error;
      await loadSimulados();
      setSimForm({ title: "", description: "", questionsText: "", q_text: "", q_options: "", q_correctIndex: 0, q_type: "mcq" });
      alert("Simulado criado com sucesso!");
    } catch (err) {
      console.error("Erro addSimuladoFromBuilder:", err);
      alert("Erro ao criar simulado. Veja console.");
    }
  }

  async function deleteSimulado(id) {
    if (!confirm("Eliminar este simulado?")) return;
    try {
      const { error } = await supabase.from("simulados").delete().eq("id", id);
      if (error) throw error;
      await loadSimulados();
    } catch (err) {
      console.error("Erro deleteSimulado:", err);
      alert("Erro ao eliminar simulado.");
    }
  }

  // ---------- Sincronização posts locais ----------
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

  // ---------- Export attempts CSV ----------
  function exportAttemptsCSV() {
    if (!attempts.length) return alert("Sem dados para exportar.");
    const keys = Object.keys(attempts[0]);
    const csv = [keys.join(",")]
      .concat(attempts.map(a => keys.map(k => `"${String(a[k] ?? "")}"`).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "participantes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Login screen (Enter funciona) ----------
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
              onClick={() => { setSenha(""); }}
              className="flex-1 bg-gray-600 text-white py-3 rounded-md font-semibold hover:bg-gray-500 transition"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Painel principal ----------
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
              className={`w-full text-left px-4 py-2 rounded mb-2 transition ${section === s ? "bg-brandGreen text-black" : "hover:bg-[#1f2937]"}`}
            >
              {s === "posts" && "📄 Posts"}
              {s === "simulados" && "🧾 Simulados"}
              {s === "participants" && "👥 Participantes"}
              {s === "config" && "⚙️ Configurações"}
            </button>
          ))}
        </nav>

        <button onClick={() => { setAutenticado(false); setSenha(""); }} className="mt-auto bg-red-600 py-2 rounded-md hover:bg-red-500">
          Sair
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold capitalize">{section}</h2>
          <p className="text-gray-400 text-sm">{posts.length} posts • {simulados.length} simulados • {attempts.length} participações</p>
        </header>

        {/* POSTS */}
        {section === "posts" && (
          <>
            <div className="mb-4 flex gap-3 items-center">
              <button onClick={loadPosts} className="bg-brandBlue px-3 py-2 rounded text-white">Atualizar posts</button>
              <button onClick={syncAllLocal} className="bg-brandGreen text-black px-3 py-2 rounded">Sincronizar posts locais</button>
              <div className="text-sm text-gray-400 ml-auto">{loading ? "Carregando..." : `${posts.length} remotos • ${localOnly.length} locais não sincronizados`}</div>
            </div>

            <form onSubmit={savePost} className="bg-[#111827] p-6 rounded-lg mb-6 space-y-4">
              <div className="flex gap-3">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título" className="flex-1 p-3 rounded bg-[#1f2937] border border-gray-700 focus:border-brandGreen outline-none" />
                <input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Resumo" className="w-72 p-3 rounded bg-[#1f2937] border border-gray-700 focus:border-brandGreen outline-none" />
              </div>

              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} placeholder="Conteúdo (HTML/Markdown)" className="w-full p-3 rounded bg-[#1f2937] border border-gray-700 focus:border-brandGreen outline-none" />

              <div className="flex items-center gap-4">
                <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, imageFile: e.target.files[0] })} className="text-sm" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Destacar
                </label>
                <div className="ml-auto flex gap-2">
                  {editing && <button type="button" onClick={() => { setEditing(null); setForm({ title: "", excerpt: "", content: "", imageFile: null, featured: false }); }} className="bg-gray-600 px-3 py-2 rounded">Cancelar</button>}
                  <button type="submit" className="bg-brandGreen text-black px-4 py-2 rounded font-semibold">{editing ? "Atualizar" : "Criar post"}</button>
                </div>
              </div>
            </form>

            <div className="grid gap-4">
              {posts.map((p) => (
                <div key={p.id} className="bg-[#111827] p-4 rounded flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <img src={p.image_url || p.image || "https://via.placeholder.com/150x90?text=Sem+Imagem"} alt="" className="w-24 h-16 object-cover rounded-md border border-gray-700" />
                    <div>
                      <h3 className="font-semibold">{p.title}</h3>
                      <p className="text-gray-400 text-sm">{p.excerpt}</p>
                      <div className="text-xs text-gray-500 mt-1">{new Date(p.created_at || p.date).toLocaleString()}</div>
                      {p.featured && <span className="inline-block mt-1 bg-yellow-400 text-black px-2 py-0.5 text-xs rounded">Destaque</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => startEdit(p)} className="bg-brandBlue text-white px-3 py-1 rounded text-sm">Editar</button>
                    <button onClick={() => toggleFeatured(p)} className="bg-yellow-400 text-black px-3 py-1 rounded text-sm">{p.featured ? "Remover destaque" : "Destacar"}</button>
                    <button onClick={() => deletePost(p.id)} className="bg-red-600 px-3 py-1 rounded text-sm">Excluir</button>
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
                        <button onClick={() => addLocalToSupabase(lp)} className="bg-brandGreen text-black px-3 py-1 rounded text-sm">Adicionar ao Supabase</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}

        {/* SIMULADOS */}
        {section === "simulados" && (
          <div className="bg-[#111827] p-6 rounded-lg">
            <h3 className="font-semibold mb-2">Simulados</h3>
            <p className="text-sm text-gray-400 mb-4">Cria, importa (JSON) e gerencia simulados. As perguntas são guardadas em JSON na coluna `questions`.</p>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* Builder: add single question + save */}
              <form onSubmit={addSimuladoFromBuilder} className="p-4 rounded bg-[#0f1724] space-y-3">
                <div>
                  <input value={simForm.title} onChange={(e) => setSimForm({ ...simForm, title: e.target.value })} placeholder="Título do simulado" className="w-full p-2 rounded bg-[#1f2937] border border-gray-700 outline-none" />
                </div>
                <div>
                  <input value={simForm.description} onChange={(e) => setSimForm({ ...simForm, description: e.target.value })} placeholder="Descrição" className="w-full p-2 rounded bg-[#1f2937] border border-gray-700 outline-none" />
                </div>

                <div className="p-2 bg-[#111827] rounded">
                  <div className="mb-2 text-sm text-gray-400">Adicionar 1 questão (modo rápido)</div>
                  <input value={simForm.q_text} onChange={(e) => setSimForm({ ...simForm, q_text: e.target.value })} placeholder="Texto da questão" className="w-full p-2 rounded bg-[#1f2937] border border-gray-700 outline-none mb-2" />
                  <select value={simForm.q_type} onChange={(e) => setSimForm({ ...simForm, q_type: e.target.value })} className="p-2 rounded bg-[#1f2937] border border-gray-700 outline-none mb-2">
                    <option value="mcq">Múltipla escolha (MCQ)</option>
                    <option value="open">Resposta aberta</option>
                  </select>
                  {simForm.q_type === "mcq" && (
                    <>
                      <input value={simForm.q_options} onChange={(e) => setSimForm({ ...simForm, q_options: e.target.value })} placeholder="Opções separadas por | (ex: A|B|C|D)" className="w-full p-2 rounded bg-[#1f2937] border border-gray-700 outline-none mb-2" />
                      <input type="number" value={simForm.q_correctIndex} onChange={(e) => setSimForm({ ...simForm, q_correctIndex: e.target.value })} placeholder="Índice da opção correta (0,1,...)" className="w-full p-2 rounded bg-[#1f2937] border border-gray-700 outline-none" />
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="bg-brandGreen text-black px-3 py-2 rounded">Criar simulado (modo rápido)</button>
                  <button type="button" onClick={() => {
                    // quick-add question to questionsText as JSON array element (helpful)
                    const opts = simForm.q_options.split("|").map(s => s.trim()).filter(Boolean);
                    const q = { pergunta: simForm.q_text, type: simForm.q_type, options: simForm.q_type === "mcq" ? opts : [], correctIndex: simForm.q_type === "mcq" ? Number(simForm.q_correctIndex) : null };
                    // append to questionsText JSON array
                    try {
                      const existing = simForm.questionsText ? JSON.parse(simForm.questionsText) : [];
                      if (!Array.isArray(existing)) throw new Error("questionsText não é array");
                      existing.push(q);
                      setSimForm({ ...simForm, questionsText: JSON.stringify(existing, null, 2), q_text: "", q_options: "", q_correctIndex: 0 });
                      alert("Questão adicionada ao JSON (à direita). Agora pode salvar tudo de uma vez usando 'Importar JSON'.");
                    } catch (err) {
                      // initialize new array
                      setSimForm({ ...simForm, questionsText: JSON.stringify([q], null, 2), q_text: "", q_options: "", q_correctIndex: 0 });
                      alert("JSON inicializado com a questão. Pode editar à direita e importar.");
                    }
                  }} className="bg-brandBlue px-3 py-2 rounded text-white">Adicionar ao JSON</button>
                </div>
              </form>

              {/* JSON importer */}
              <div className="p-4 rounded bg-[#0f1724]">
                <div className="text-sm text-gray-400 mb-2">Ou cole aqui o JSON do simulado (formato abaixo) e clique em Importar:</div>
                <textarea value={simForm.questionsText} onChange={(e) => setSimForm({ ...simForm, questionsText: e.target.value })} rows={10} className="w-full p-2 rounded bg-[#1f2937] border border-gray-700 outline-none mb-2" placeholder='Exemplo: {"titulo":"X","descricao":"Y","perguntas":[{"pergunta":"...","type":"mcq","options":["a","b"],"correctIndex":0}]}' />
                <div className="flex gap-2">
                  <button onClick={() => addSimuladoFromJSON(simForm.questionsText || "{}")} className="bg-brandGreen text-black px-3 py-2 rounded">Importar JSON</button>
                  <button onClick={() => { setSimForm({ title: "", description: "", questionsText: "", q_text: "", q_options: "", q_correctIndex: 0, q_type: "mcq" }); }} className="bg-gray-600 px-3 py-2 rounded text-white">Limpar</button>
                </div>
              </div>
            </div>

            {/* lista de simulados */}
            <div className="space-y-3">
              {simulados.map((s) => (
                <div key={s.id} className="bg-[#1f2937] p-3 rounded flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{s.title}</div>
                    <div className="text-sm text-gray-400">{s.description}</div>
                    <div className="text-xs text-gray-500 mt-1">{(s.created_at || s.date) && new Date(s.created_at || s.date).toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">Questões: {(s.questions || []).length}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <a target="_blank" rel="noreferrer" href={`${window.location.origin}/simulados?id=${s.id}`} className="px-3 py-1 bg-brandBlue rounded text-white text-sm">Abrir (site)</a>
                    <button onClick={() => deleteSimulado(s.id)} className="px-3 py-1 bg-red-600 rounded text-white text-sm">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PARTICIPANTES */}
        {section === "participants" && (
          <div className="bg-[#111827] p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Participações</h3>
              <button onClick={exportAttemptsCSV} className="bg-brandGreen text-black px-3 py-1 rounded text-sm">Exportar CSV</button>
            </div>
            {attempts.map((a) => (
              <div key={a.id} className="bg-[#1f2937] p-3 rounded mb-2 flex justify-between">
                <span>{a.user_name || a.user_email || "Anônimo"}</span>
                <span className="text-gray-400 text-sm">Nota: {a.score}</span>
              </div>
            ))}
          </div>
        )}

        {/* CONFIG */}
        {section === "config" && (
          <div className="bg-[#111827] p-6 rounded-lg">
            <h3 className="font-semibold mb-3">Configurações</h3>
            <p className="text-sm text-gray-400 mb-4">Aqui podes copiar a URL do site, recarregar dados, etc.</p>
            <div className="flex gap-3">
              <button onClick={() => { navigator.clipboard.writeText(window.location.origin); alert("URL copiada!"); }} className="bg-brandGreen text-black px-4 py-2 rounded font-semibold">Copiar URL do site</button>
              <button onClick={() => { if (confirm("Recarregar tudo do Supabase?")) loadAll(); }} className="bg-brandBlue text-white px-4 py-2 rounded">Recarregar dados</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
