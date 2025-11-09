// src/pages/AdminDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { posts as localPosts } from "../data/posts"; // ajuste se o caminho for diferente

export default function AdminDashboard() {
  const [autenticado, setAutenticado] = useState(false);
  const [senha, setSenha] = useState("");
  const ADMIN_PASSWORD = "admin3000";
  const [section, setSection] = useState("posts");

  const [posts, setPosts] = useState([]); // posts remotos (supabase)
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", excerpt: "", content: "", imageFile: null, featured: false });

  const [simulados, setSimulados] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (autenticado) loadAll();
    // eslint-disable-next-line
  }, [autenticado]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadPosts(), loadSimulados(), loadAttempts()]);
    setLoading(false);
  }

  async function loadPosts() {
    const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("Erro loadPosts:", error);
      setPosts([]);
      return;
    }
    setPosts(data || []);
  }

  async function loadSimulados() {
    const { data, error } = await supabase.from("simulados").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("Erro loadSimulados:", error);
      setSimulados([]);
      return;
    }
    setSimulados(data || []);
  }

  async function loadAttempts() {
    const { data, error } = await supabase.from("attempts").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("Erro loadAttempts:", error);
      setAttempts([]);
      return;
    }
    setAttempts(data || []);
  }

  // Upload imagem e retorna URL pública (compatível com SDK supabase storage)
  async function uploadImage(file) {
    if (!file) return null;
    try {
      const ext = file.name.split(".").pop();
      const filename = `${Date.now()}.${ext}`;
      const bucket = "posts"; // usa o bucket 'posts' (cria no supabase storage se necessário)
      // upload
      const uploadResult = await supabase.storage.from(bucket).upload(filename, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadResult.error) {
        // se houver erro e for "file already exists", tentar getPublicUrl mesmo assim
        console.error("Erro upload:", uploadResult.error);
        return null;
      }
      // obter URL pública
      const { data: publicUrlData, error: publicErr } = supabase.storage.from(bucket).getPublicUrl(filename);
      if (publicErr) {
        console.error("Erro publicUrl:", publicErr);
        return null;
      }
      // dependendo da versão, pode ser publicUrlData.publicUrl ou publicUrlData.publicURL
      return publicUrlData?.publicUrl || publicUrlData?.publicURL || null;
    } catch (err) {
      console.error("Erro uploadImage catch:", err);
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
        featured: form.featured,
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
      alert("Erro ao guardar.");
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
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      console.error("Erro deletePost:", error);
      alert("Erro ao eliminar.");
      return;
    }
    await loadPosts();
  }

  async function toggleFeatured(p) {
    const { error } = await supabase.from("posts").update({ featured: !p.featured }).eq("id", p.id);
    if (error) {
      console.error("Erro toggleFeatured:", error);
      alert("Erro ao atualizar destaque.");
      return;
    }
    await loadPosts();
  }

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

  // ---------- Novas funções: sincronização / comparação ----------
  // posts locais do arquivo data/posts (localPosts)
  const localOnly = useMemo(() => {
    // considerar local como não presentes no supabase quando não existe post remoto com mesmo title (ou image/excerpt)
    const remoteTitles = new Set((posts || []).map((p) => (p.title || "").trim().toLowerCase()));
    return (localPosts || []).filter((lp) => !remoteTitles.has((lp.title || "").trim().toLowerCase()));
  }, [posts]);

  // adiciona um post local ao supabase
  async function addLocalToSupabase(local) {
    try {
      // imagem local pode ser URL (se for string) -> inserimos diretamente
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

  // sincroniza todos locais que não existem
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

  // tela de login com Enter funcional
  if (!autenticado) {
    const handleKeyPress = (e) => {
      if (e.key === "Enter" && senha === ADMIN_PASSWORD) setAutenticado(true);
    };
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1020] text-white">
        <div className="bg-[#111827] p-8 rounded-xl shadow-xl w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center">Painel Administrativo</h2>
          <input
            type="password"
            placeholder="Digite a senha..."
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-full p-3 mb-4 rounded-md bg-[#1f2937] border border-gray-600 focus:border-brandGreen outline-none"
          />
          <button
            onClick={() => {
              if (senha === ADMIN_PASSWORD) setAutenticado(true);
              else alert("Senha incorreta");
            }}
            className="w-full bg-brandGreen text-black py-3 rounded-md font-semibold hover:bg-green-400 transition"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  // === Painel principal ===
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
          onClick={() => setAutenticado(false)}
          className="mt-auto bg-red-600 py-2 rounded-md hover:bg-red-500"
        >
          Sair
        </button>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 p-8 overflow-auto">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold capitalize">{section}</h2>
          <p className="text-gray-400 text-sm">
            {posts.length} posts • {simulados.length} simulados • {attempts.length} participações
          </p>
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
              {/* Lista de posts remotos */}
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
                      <div className="text-xs text-gray-500 mt-1">{new Date(p.created_at || p.date).toLocaleString()}</div>
                      {p.featured && (
                        <span className="inline-block mt-1 bg-yellow-400 text-black px-2 py-0.5 text-xs rounded">
                          Destaque
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => startEdit(p)} className="bg-brandBlue text-white px-3 py-1 rounded text-sm">Editar</button>
                    <button onClick={() => toggleFeatured(p)} className="bg-yellow-400 text-black px-3 py-1 rounded text-sm">{p.featured ? "Remover destaque" : "Destacar"}</button>
                    <button onClick={() => deletePost(p.id)} className="bg-red-600 px-3 py-1 rounded text-sm">Excluir</button>
                  </div>
                </div>
              ))}

              {/* Lista de posts locais não sincronizados */}
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
            <p className="text-sm text-gray-400 mb-4">Gestão de simulados em breve... (aqui vamos adicionar criação/edição de simulados com perguntas)</p>
            {simulados.map((s) => (
              <div key={s.id} className="bg-[#1f2937] p-3 rounded mb-2 flex justify-between">
                <span>{s.title}</span>
                <span className="text-gray-400 text-sm">{new Date(s.created_at || s.date).toLocaleString()}</span>
              </div>
            ))}
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

        {/* CONFIGURAÇÕES */}
        {section === "config" && (
          <div className="bg-[#111827] p-6 rounded-lg">
            <h3 className="font-semibold mb-3">Configurações</h3>
            <p className="text-sm text-gray-400 mb-4">Aqui podes alterar opções gerais (ex: mudar senha, API keys, etc.).</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin);
                  alert("URL copiada!");
                }}
                className="bg-brandGreen text-black px-4 py-2 rounded font-semibold"
              >
                Copiar URL do site
              </button>
              <button
                onClick={() => {
                  if (!confirm("Tem a certeza que deseja re-carregar dados do Supabase?")) return;
                  loadAll();
                }}
                className="bg-brandBlue text-white px-4 py-2 rounded font-semibold"
              >
                Recarregar dados
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
