import { Outlet, NavLink } from "react-router-dom";
import { MessageSquare, BarChart2, Settings, Zap, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const navItems = [
  { to: "/", icon: MessageSquare, label: "CRM" },
  { to: "/broadcast", icon: Megaphone, label: "Расилка" },
  { to: "/analytics", icon: BarChart2, label: "Аналитика" },
  { to: "/settings", icon: Settings, label: "Танзимот" },
];

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-16 border-r border-border bg-sidebar items-center py-4 gap-2 shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary mb-4">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>

        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-150 cursor-pointer group",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )
            }
            title={label}
          >
            <Icon className="w-5 h-5" />
          </NavLink>
        ))}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top bar mobile */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground">21ASR CRM</span>
          <div className="ml-auto flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-center w-9 h-9 rounded-lg transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )
                }
                title={label}
              >
                <Icon className="w-4 h-4" />
              </NavLink>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
