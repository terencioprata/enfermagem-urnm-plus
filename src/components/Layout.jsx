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
    </div>
  );
}
