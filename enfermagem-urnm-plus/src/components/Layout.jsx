import Navbar from "./Navbar";

export default function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-brandBlue via-brandGreen to-brandOrange dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-all text-white">
      
      {/* Navbar com gradiente */}
      <Navbar />

      {/* Conteúdo principal */}
      <main className="flex-grow pt-24 text-white">
        {children}
      </main>

      {/* Footer menor e com gradiente sutil */}
      <footer className="bg-gradient-to-r from-brandBlue via-brandGreen to-brandOrange dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-white py-3 px-4 text-center text-sm">
        <p>🏥 Enfermagem URNM+ | Simulados & Blog — Universidade Rainha Nginga a Mbande</p>
        <p className="mt-1 text-xs opacity-80">© {new Date().getFullYear()} Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
