// src/components/FiltroSimulados.jsx
export default function FiltroSimulados({ temas = [], disciplinas = [], tema, disciplina, onTema, onDisciplina, search, onSearch, order, onOrder }) {
  return (
    <div className="bg-white/5 p-4 rounded-lg flex flex-col md:flex-row gap-3 items-center">
      <input value={search} onChange={(e)=>onSearch(e.target.value)} placeholder="Pesquisar simulados..." className="flex-1 p-2 rounded bg-[#0f1724] outline-none" />
      <select value={tema} onChange={(e)=>onTema(e.target.value)} className="p-2 rounded bg-[#0f1724]">
        <option value="">Todos os temas</option>
        {temas.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={disciplina} onChange={(e)=>onDisciplina(e.target.value)} className="p-2 rounded bg-[#0f1724]">
        <option value="">Todas disciplinas</option>
        {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={order} onChange={(e)=>onOrder(e.target.value)} className="p-2 rounded bg-[#0f1724]">
        <option value="newest">Mais recentes</option>
        <option value="oldest">Mais antigos</option>
        <option value="custom">Ordem personalizada</option>
      </select>
    </div>
  );
}
