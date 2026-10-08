import { useState, type ReactNode } from "react";
import {
  BookOpen,
  Clock3,
  FolderKanban,
  Menu,
  Plus,
  Settings2,
  Star,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";

type NavigationItem = {
  id: "workspace" | "history" | "projects" | "favorites" | "settings";
  label: string;
  icon: typeof BookOpen;
  available: boolean;
};

const navigationItems: NavigationItem[] = [
  { id: "workspace", label: "Workspace", icon: BookOpen, available: true },
  { id: "history", label: "Historial", icon: Clock3, available: true },
  { id: "projects", label: "Proyectos", icon: FolderKanban, available: false },
  { id: "favorites", label: "Favoritos", icon: Star, available: false },
  { id: "settings", label: "Ajustes", icon: Settings2, available: false },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/nexor-mark.svg" alt="" aria-hidden="true" className="h-8 w-8" />
      <div>
        <p className="text-sm font-semibold tracking-[0.22em] text-foreground">NEXOR</p>
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Math laboratory</p>
      </div>
    </div>
  );
}

function Navigation({
  historyId,
  history,
  onNavigate,
  onUseExpression,
}: {
  /** Sidebar and mobile drawer both render this; ids must stay unique. */
  historyId: string;
  history: string[];
  onNavigate: (item: NavigationItem) => void;
  onUseExpression: (expression: string) => void;
}) {
  return (
    <>
      <nav aria-label="Navegación principal" className="space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              disabled={!item.available}
              aria-current={item.id === "workspace" ? "page" : undefined}
              onClick={() => onNavigate(item)}
              className={cn(
                "nexor-nav-item",
                item.id === "workspace" && "nexor-nav-item-active",
                !item.available && "nexor-nav-item-disabled",
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <span>{item.label}</span>
              {!item.available && <span className="ml-auto text-[11px] text-muted-foreground/70">Próximamente</span>}
            </button>
          );
        })}
      </nav>

      <section id={historyId} aria-labelledby={`${historyId}-title`} className="nexor-history mt-6" tabIndex={-1}>
        <p id={`${historyId}-title`} className="nexor-eyebrow mb-2 px-3">Historial reciente</p>
        {history.length === 0 ? (
          <p className="px-3 text-xs leading-5 text-muted-foreground">Las expresiones válidas que escribas aparecerán aquí.</p>
        ) : (
          <ul className="space-y-0.5">
            {history.slice(0, 8).map((expression) => (
              <li key={expression}>
                <button
                  type="button"
                  onClick={() => onUseExpression(expression)}
                  className="nexor-history-item"
                  title={expression}
                >
                  {expression}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export function AppShell({
  context,
  history,
  onUseExpression,
  onNewAnalysis,
  children,
}: {
  /** Mathematical context of the working equation, shown in the topbar. */
  context: ReactNode;
  history: string[];
  onUseExpression: (expression: string) => void;
  onNewAnalysis: () => void;
  children: ReactNode;
}) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  const handleNavigate = (item: NavigationItem) => {
    if (item.id === "workspace") {
      setMobileNavigationOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (item.id === "history") {
      document.getElementById(mobileNavigationOpen ? "nexor-history-mobile" : "nexor-history")?.focus();
    }
  };

  const pickExpression = (expression: string) => {
    setMobileNavigationOpen(false);
    onUseExpression(expression);
  };

  return (
    <div className="nexor-shell">
      <aside className="nexor-sidebar hidden lg:flex" aria-label="NEXOR">
        <Brand />
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <Navigation historyId="nexor-history" history={history} onNavigate={handleNavigate} onUseExpression={pickExpression} />
        </div>
        <p className="mt-4 border-t border-border/80 px-3 pt-4 text-xs leading-5 text-muted-foreground">
          Análisis local, sin cuentas y sin enviar tus ecuaciones.
        </p>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="nexor-topbar">
          <button
            type="button"
            className="nexor-icon-button nexor-menu-button"
            aria-label={mobileNavigationOpen ? "Cerrar navegación" : "Abrir navegación"}
            aria-expanded={mobileNavigationOpen}
            onClick={() => setMobileNavigationOpen((open) => !open)}
          >
            {mobileNavigationOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <div className="min-w-0 flex-1">{context}</div>
          <button type="button" className="nexor-new-analysis" onClick={onNewAnalysis} aria-label="Nuevo análisis">
            <Plus aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo análisis</span>
          </button>
        </header>

        {mobileNavigationOpen && (
          <div className="nexor-mobile-nav lg:hidden">
            <div className="mb-5"><Brand /></div>
            <Navigation historyId="nexor-history-mobile" history={history} onNavigate={handleNavigate} onUseExpression={pickExpression} />
          </div>
        )}

        <main id="nexor-workspace" className="nexor-content">
          {children}
        </main>
      </div>
    </div>
  );
}
