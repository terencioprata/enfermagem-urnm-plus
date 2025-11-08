import React, { useState } from "react";

function NewsletterForm() {
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [email, setEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");

    try {
      const response = await fetch("https://formspree.io/f/movyajdg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStatus("success");
        setEmail("");
      } else {
        throw new Error("Erro ao enviar");
      }
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <section className="max-w-3xl mx-auto px-6 py-10 text-center">
      <h4 className="text-xl font-bold text-white mb-3">
        Receba novidades por email
      </h4>
      <p className="text-white/85 mb-4">
        Inscreve-te para receber avisos sobre novos simulados e formações.
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-3 justify-center"
      >
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teuemail@exemplo.com"
          required
          className="px-4 py-3 rounded-lg w-full sm:w-auto min-w-[220px] text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brandGreen"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="bg-brandGreen hover:bg-brandGreen/90 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-60"
        >
          {status === "sending" ? "A enviar..." : "Inscrever"}
        </button>
      </form>

      {/* Mensagem de sucesso ou erro */}
      {status === "success" && (
        <p className="text-green-400 mt-4 font-medium animate-fade-in">
          ✅ Subscrição enviada com sucesso! Obrigado por te inscreveres.
        </p>
      )}
      {status === "error" && (
        <p className="text-red-400 mt-4 font-medium animate-fade-in">
          ❌ Ocorreu um erro ao enviar. Tenta novamente.
        </p>
      )}
    </section>
  );
}

export default NewsletterForm;
