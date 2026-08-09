"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOptionalTripNavigation } from "@/components/layout/trip-navigation-context";
import { tripPaths } from "@/lib/trips/trip-paths";
import { isScheduledTrip } from "@/lib/trips/types";
import { cn } from "@/lib/ui/styles";

type TabItem = {
  href: string;
  label: string;
  matchPrefixes: string[];
  icon: (active: boolean) => React.ReactNode;
};

const hiddenPrefixes = ["/login"];

export function BottomTabBar() {
  const pathname = usePathname();
  const tripNavigation = useOptionalTripNavigation();

  if (
    hiddenPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === "/" ||
    !tripNavigation
  ) {
    return null;
  }

  const paths = tripPaths(tripNavigation.tripId);
  const scheduled = isScheduledTrip(tripNavigation.tripType);

  const tabs: TabItem[] = scheduled
    ? [
        {
          href: paths.hoy,
          label: "Hoy",
          matchPrefixes: [paths.hoy],
          icon: (active) => <IconToday active={active} />,
        },
        {
          href: paths.planificar,
          label: "Planificar",
          matchPrefixes: [paths.planificar],
          icon: (active) => <IconPlan active={active} />,
        },
        {
          href: paths.map,
          label: "Mapa",
          matchPrefixes: [paths.map],
          icon: (active) => <IconMap active={active} />,
        },
        {
          href: paths.import,
          label: "Importar",
          matchPrefixes: [paths.import],
          icon: (active) => <IconImport active={active} />,
        },
        {
          href: paths.preferencias,
          label: "Ajustes",
          matchPrefixes: [paths.preferencias, paths.dashboard],
          icon: (active) => <IconSettings active={active} />,
        },
      ]
    : [
        {
          href: paths.lugares,
          label: "Lugares",
          matchPrefixes: [paths.lugares],
          icon: (active) => <IconPlaces active={active} />,
        },
        {
          href: paths.map,
          label: "Mapa",
          matchPrefixes: [paths.map],
          icon: (active) => <IconMap active={active} />,
        },
        {
          href: paths.import,
          label: "Importar",
          matchPrefixes: [paths.import],
          icon: (active) => <IconImport active={active} />,
        },
        {
          href: paths.preferencias,
          label: "Ajustes",
          matchPrefixes: [paths.preferencias, paths.dashboard],
          icon: (active) => <IconSettings active={active} />,
        },
      ];

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul
        className={cn(
          "mx-auto grid max-w-lg",
          scheduled ? "grid-cols-5" : "grid-cols-4",
        )}
      >
        {tabs.map((tab) => {
          const active = tab.matchPrefixes.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
          );

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition",
                  active ? "text-blue-400" : "text-slate-500 hover:text-slate-300",
                )}
              >
                {tab.icon(active)}
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function IconToday({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="4" className={active ? "fill-blue-500/20" : undefined} />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M5 19l1.5-1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPlan({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
      {active ? <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none" /> : null}
    </svg>
  );
}

function IconPlaces({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" className={active ? "fill-blue-500/20" : undefined} />
    </svg>
  );
}

function IconMap({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 18 3 20V6l6-2 6 2 6-2v14l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" className={active ? "stroke-blue-400" : undefined} />
    </svg>
  );
}

function IconImport({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3v10M8 9l4 4 4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
      {active ? <path d="M5 17h14" className="stroke-blue-400" /> : null}
    </svg>
  );
}

function IconSettings({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        className={active ? "fill-blue-500/20" : undefined}
      />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 12 4.2V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
