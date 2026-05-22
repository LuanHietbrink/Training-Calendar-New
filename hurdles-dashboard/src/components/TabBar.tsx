import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/training", label: "Training" },
  { to: "/speed", label: "Speed" },
  { to: "/weight", label: "Weight" },
  { to: "/programs", label: "Programs" },
];

export default function TabBar() {
  return (
    <nav className="flex gap-1 sm:gap-2 overflow-x-auto">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            [
              "px-3 sm:px-4 py-2 text-sm rounded-md whitespace-nowrap transition-colors",
              isActive
                ? "bg-slate-900 text-white font-semibold"
                : "text-slate-600 hover:bg-slate-200",
            ].join(" ")
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
