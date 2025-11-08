// src/pages/Painel.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Painel() {
  const [autenticado, setAutenticado] = useState(false);
  const [senha, setSenha] = useState("");
  const [posts, setPosts] = useState([]);
  const [novoPost, setNovoPost] = useState({
    title: "",
    excerpt: "",
    content: "",
    imageFile: null,
    date: new Date().toISOString().slice(0, 10),
  });
  const ADMIN_PASSWORD = "admin3000"; // podes mudar

  useEffect(() => {
    if (autenticado) {
      carregarPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autenticado]);

  async function carregarPosts() {
    // busca posts do Supabase (ordem decrescente)
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar posts:", error);
      return;
    }
    setPosts(data || []);
  }

  async function handleUploadImage(file) {
    if (!file) return null;
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
      .from("posts")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Erro ao enviar imagem:", error);
      return null;
    }

    // obter URL pública
    const { publicURL } = supabase.storage.from("posts").getPublicUrl(filePath);
    return publicURL;
  }

  async function adicionarPost() {
    if (!novoPost.title.trim() || !novoPost.content.trim()) {
      alert("Preenche título e conteúdo.");
      return;
    }

    try {
      let image_url = null;
      if (novoPost.imageFile) {
        image_url = await handleUploadImage(novoPost.imageFile);
      }

      const { data, error } = await supabase.from("posts").insert([
        {
          title: novoPost.title,
          excerpt: novoPost.excerpt,
          content: novoPost.content,
          image_url,
          created_at: novoPost.date + "T00:00:00Z",
        },
      ]);

      if (error) throw error;
      // atualiza lista local
      carregarPosts();
      // limpa form
      setNovoPost({
        title: "",
        excerpt: "",
        content: "",
        imageFile: null,
        date: new Date().toISOString().slice(0, 10),
      });
      alert("Post adicionado!");
    } catch (err) {
      console.error(err);
      alert("Erro ao adicionar post.");
    }
  }

  async function excluirPost(id) {
    if (!confirm("Deseja eliminar este post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("Erro ao excluir.");
      return;
    }
    carregarPosts();
  }

  if (!autenticado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-brandBlue to-brandGreen text-white p-6">
        <div className="max-w-md w-full bg-white/5 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Painel de Administração</h2>
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full p-3 mb-3 rounded text-black"
          />
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (senha === ADMIN_PASSWORD) {
                  setAutenticado(true);
                } else {
                  alert("Senha incorreta");
                }
              }}
              className="bg-brandGreen px-4 py-2 rounded text-white"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Painel de Administração</h1>

        <div className="bg-white/5 p-4 rounded-lg mb-6">
          <h2 className="font-semibold mb-3">Criar novo post</h2>

          <input
            type="text"
            placeholder="Título"
            value={novoPost.title}
            onChange={(e) => setNovoPost({ ...novoPost, title: e.target.value })}
            className="w-full p-3 mb-2 rounded text-black"
          />

          <input
            type="text"
            placeholder="Resumo (excerpt)"
            value={novoPost.excerpt}
            onChange={(e) => setNovoPost({ ...novoPost, excerpt: e.target.value })}
            className="w-full p-3 mb-2 rounded text-black"
          />

          <textarea
            placeholder="Conteúdo"
            value={novoPost.content}
            onChange={(e) => setNovoPost({ ...novoPost, content: e.target.value })}
            rows={6}
            className="w-full p-3 mb-2 rounded text-black"
          />

          <input
            type="date"
            value={novoPost.date}
            onChange={(e) => setNovoPost({ ...novoPost, date: e.target.value })}
            className="p-2 mb-2 rounded text-black"
          />

          <label className="block mb-2">
            <span className="text-sm">Imagem (opcional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNovoPost({ ...novoPost, imageFile: e.target.files[0] })}
              className="mt-1"
            />
          </label>

          <div className="flex gap-3">
            <button onClick={adicionarPost} className="bg-brandBlue text-white px-4 py-2 rounded">
              Guardar no Supabase
            </button>
            <button
              onClick={() => {
                setNovoPost({
                  title: "",
                  excerpt: "",
                  content: "",
                  imageFile: null,
                  date: new Date().toISOString().slice(0, 10),
                });
              }}
              className="bg-gray-400 text-white px-4 py-2 rounded"
            >
              Limpar
            </button>
          </div>
        </div>

        <h2 className="font-semibold mb-3">Posts no Supabase</h2>
        <div className="grid gap-4">
          {posts.map((p) => (
            <div key={p.id} className="bg-white/5 p-4 rounded shadow flex justify-between items-start">
              <div>
                <div className="font-bold">{p.title}</div>
                <div className="text-sm opacity-80 mb-2">{p.excerpt}</div>
                <div className="text-xs text-gray-500">{new Date(p.created_at).toLocaleString()}</div>
              </div>
              <div className="flex flex-col gap-2">
                <a href={p.image_url} target="_blank" rel="noreferrer" className="text-sm underline">
                  Ver imagem
                </a>
                <button onClick={() => excluirPost(p.id)} className="bg-red-500 px-3 py-1 rounded text-white text-sm">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
