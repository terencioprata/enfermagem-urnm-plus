// src/components/SimuladoCard.jsx
import { Link } from "react-router-dom";

export default function SimuladoCard({ sim, onStart }) {
  const qCount = (sim.questions || []).length;
  const durationMin = sim.duration ?? Math.round((sim.total_time_seconds ?? sim.time_seconds ?? 20*60) / 60);
  return (
    <div className="bg-white/5 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
      <div>
        <img src={sim.image_url || sim.image || "https://via.placeholder.com/600x300?text=Simulado"} alt={sim.title} className="w-full h-36 object-cover rounded-lg mb-3" />
        <h3 className="text-lg font-semibold mb-1">{sim.title}</h3>
        <p className="text-sm text-white/80 mb-2 line-clamp-3">{sim.description}</p>
        <div className="text-xs text-white/70">Questões: {qCount} • Duração: {durationMin} min</div>
      </div>

      <div className="mt-4 flex gap-3">
        <button onClick={onStart} className="flex-1 bg-brandBlue px-3 py-2 rounded font-semibold hover:bg-brandBlue/90">Iniciar Simulado</button>
        <Link to={`/simulados/${sim.id}`} className="px-3 py-2 rounded border border-white/20">Detalhes</Link>
      </div>
    </div>
  );
}
