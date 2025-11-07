import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();

  const menuItems = [
    { name: "Início", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: "Simulados", path: "/simulados" },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-gradient-to-r from-brandBlue via-brandGreen to-brandOrange dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 backdrop-blur-md text-white shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center py-3 px-6">
        {/* Logo / Nome do site */}
        <Link to="/" className="text-xl font-bold drop-shadow-lg">
          Enfermagem URNM+
        </Link>

        {/* Menu */}
        <ul className="flex space-x-6">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    isActive
                      ? "bg-white/20 font-semibold"
                      : "hover:bg-white/10"
                  }`}
                >
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
