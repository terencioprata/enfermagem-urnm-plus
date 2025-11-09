// src/pages/Post.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { posts as localPosts } from "../data/posts";
import { supabase } from "../supabaseClient";

export default function Post() {
  const { id } = useParams(); // formato "remote-42" ou "local-3"
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        if (!id) return;
        const [source, rawId] = id.split("-");
        if (source === "remote") {
          const numericId = Number(rawId);
          const { data, error } = await supabase
            .from("posts")
            .select("*")
            .eq("id", numericId)
            .single();
          if (error) throw error;

          // resolve imagem pública corretamente (se estiver armazenada como "posts/xxx")
          let image = data.image_url || data.image || null;
          if (image && image.startsWith("posts/")) {
            const res = supabase.storage.from("posts").getPublicUrl(image);
            // supabase v1/v2 diferem; tentamos ambos caminhos
            image = res?.data?.publicUrl || res?.publicURL || image;
          }
          if (mounted) setPost({ ...data, image });
        } else {
          // fallback local
          const numericId = Number(rawId);
          const p = localPosts.find((x) => x.id === numericId);
          if (p && mounted) setPost(p);
        }
      } catch (err) {
        console.error("Erro ao carregar post:", err);
        if (mounted) setPost(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) return <div className="min-h-screen pt-24 text-center">Carregando...</div>;
  if (!post)
    return (
      <div className="min-h-screen pt-24 px-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Post não encontrado</h1>
        <Link to="/blog" className="underline">
          Voltar ao blog
        </Link>
      </div>
    );

  // --- lógica para decidir mostrar botão Comprar / Reservar ---
  const textToCheck = `${post.title || ""} ${post.excerpt || ""} ${post.content || ""}`.toLowerCase();

  const reserveKeywords = ["curso", "formação", "formacao", "vaga", "reservar", "inscrição", "inscricao", "inscrever"];
  const buyKeywords = ["comprar", "venda", "vender", "pagamento", "preço", "preco", "checkout"];

  const hasReserve = reserveKeywords.some((k) => textToCheck.includes(k));
  const hasBuy = buyKeywords.some((k) => textToCheck.includes(k));

  // prioridade: se detecta termos de reserva -> Reservar; senão se detecta termos de compra -> Comprar; senão nada.
  let actionType = null;
  if (hasReserve) actionType = "reserve";
  else if (hasBuy) actionType = "buy";

  const whatsappLink = "https://wa.me/244921639010";

  return (
    <div className="relative min-h-screen pt-24 pb-20 px-6 bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange text-white">
      {/* Voltar no canto superior esquerdo */}
      <Link
        to="/blog"
        className="absolute top-6 left-6 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg shadow-md backdrop-blur-md transition-all duration-300"
      >
        ← Voltar ao Blog
      </Link>

      <div className="max-w-4xl mx-auto mt-12">
        <img
          src={post.image || "https://via.placeholder.com/1200x600?text=Sem+Imagem"}
          alt={post.title}
          className="w-full h-64 object-cover rounded-2xl shadow-lg mb-8"
        />

        <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
        <p className="text-sm text-white/80 mb-6">📅 {new Date(post.created_at || post.date).toLocaleDateString()}</p>

        <div className="prose dark:prose-invert max-w-none leading-relaxed text-white" dangerouslySetInnerHTML={{ __html: (post.content || "").replace(/\n/g, "<br/>") }} />

        {/* Botão condicional (aparece somente se keywords detectadas) */}
        {actionType && (
          <div className="mt-10 text-center">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className={
                "inline-block font-semibold px-8 py-3 rounded-lg shadow-lg transition-all duration-300 " +
                (actionType === "reserve"
                  ? "bg-yellow-400 text-black hover:scale-105"
                  : "bg-white text-brandBlue hover:scale-105 hover:bg-brandGreen hover:text-white")
              }
            >
              {actionType === "reserve" ? "Reservar Vaga" : "Comprar"}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
