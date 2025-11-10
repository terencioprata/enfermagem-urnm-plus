// src/components/BarraDeProgresso.jsx
export default function BarraDeProgresso({ value = 0, max = 100 }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="w-full bg-white/10 rounded h-3 overflow-hidden">
      <div style={{ width: `${pct}%` }} className="h-3 bg-brandGreen transition-all" />
    </div>
  );
}
