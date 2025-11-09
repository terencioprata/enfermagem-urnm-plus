// src/pages/Post.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { posts as localPosts } from "../data/posts";
import { supabase } from "../supabaseClient";

export default function Post() {
  const { id } = useParams(); // expected format: "remote-42" or "local-3"
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
          // fetch from supabase by numeric id
          const numericId = Number(rawId);
          const { data, error } = await supabase
            .from("posts")
            .select("*")
            .eq("id", numericId)
            .single();
          if (error) throw error;
          // try to resolve public URL if image path stored
          let image = data.image_url || data.image || null;
          if (image && image.startsWith("posts/")) {
            const res = supabase.storage.from("posts").getPublicUrl(image);
            image = res?.data?.publicUrl || res?.publicURL || image;
          }
          if (mounted) setPost({ ...data, image });
        } else {
          // local fallback — find by numeric id in localPosts
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
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="min-h-screen pt-24 text-center">Carregando...</div>;
  if (!post) return (
    <div className="min-h-screen pt-24 px-6 text-center">
      <h1 className="text-2xl font-bold mb-4">Post não encontrado</h1>
      <Link to="/blog" className="underline">Voltar ao blog</Link>
    </div>
  );

  return (
    <div className="min-h-screen pt-24 pb-20 px-6 bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange text-white">
      <div className="max-w-4xl mx-auto">
        <img src={post.image || "https://via.placeholder.com/1200x600?text=Sem+Imagem"} alt={post.title} className="w-full h-64 object-cover rounded-2xl shadow-lg mb-8" />
        <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
        <p className="text-sm text-white/80 mb-6">📅 {new Date(post.created_at || post.date).toLocaleDateString()}</p>
        <div className="prose dark:prose-invert max-w-none leading-relaxed text-white" dangerouslySetInnerHTML={{ __html: (post.content || "").replace(/\n/g, "<br/>") }} />
        <div className="mt-8">
          <Link to="/blog" className="inline-block bg-white/20 text-white py-2 px-4 rounded-lg">← Voltar ao Blog</Link>
        </div>
      </div>
    </div>
  );
}
