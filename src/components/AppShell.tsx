import React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "1D CLT" },
  { to: "/multivariate", label: "2D Multivariate CLT" },
  { to: "/manual-drawing", label: "Draw a Distribution" },
];

interface AppShellProps {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

// Shared page frame: nav bar, page heading, content column.
// Solid colours only, so the text stays readable even where CSS gradients don't render.
const AppShell: React.FC<AppShellProps> = ({ title, subtitle, children }) => (
  <div className="min-h-screen bg-slate-100 text-slate-900">
    <header className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 flex h-14 items-center gap-6 overflow-x-auto">
        <span className="font-semibold whitespace-nowrap">
          SOCR <span className="text-indigo-300">CLT</span>
        </span>
        <nav className="flex gap-1 text-sm">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 whitespace-nowrap transition-colors",
                  isActive ? "bg-white/15 text-white" : "text-slate-300 hover:text-white hover:bg-white/10"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>

    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-600 max-w-3xl">{subtitle}</p>}
      </div>
      {children}
    </main>
  </div>
);

export default AppShell;
