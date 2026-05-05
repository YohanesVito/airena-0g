"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Maps the side-nav items to section ids on the landing page. Order top→bottom
// matches the visual stacking order of the sections so scroll-spy lights the
// expected item as the user moves down the page.
const PRIMARY = [
  { id: "arena",   label: "Arena" },
  { id: "flow",    label: "Flow" },
  { id: "economy", label: "Economy" },
  { id: "modes",   label: "Modes" },
  { id: "stack",   label: "Stack" },
];

const SECONDARY = [
  { id: "top",     label: "Top" },
  { id: "roadmap", label: "Roadmap" },
];

const ALL_IDS = [...SECONDARY.map((i) => i.id), ...PRIMARY.map((i) => i.id)];

export function SideNav() {
  const pathname = usePathname();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Scroll-spy via IntersectionObserver. The rootMargin shrinks the
  // observation band to the middle 40% of the viewport so the active link
  // tracks roughly what's at eye level instead of flipping the moment a
  // section's edge crosses the viewport.
  useEffect(() => {
    if (pathname !== "/") return;

    const elements = ALL_IDS
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const visibility = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.intersectionRatio);
        }
        let best: { id: string; ratio: number } | null = null;
        for (const [id, ratio] of visibility) {
          if (ratio > 0 && (!best || ratio > best.ratio)) best = { id, ratio };
        }
        setActiveId(best?.id ?? null);
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: "-30% 0px -30% 0px",
      }
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [pathname]);

  if (pathname !== "/") return null;

  return (
    <nav className="side-nav" aria-label="Page sections">
      <ul className="side-nav-list">
        {PRIMARY.map((item) => (
          <SideNavLink key={item.id} {...item} active={activeId === item.id} />
        ))}
      </ul>

      <ul className="side-nav-list side-nav-list-secondary">
        {SECONDARY.map((item) => (
          <SideNavLink
            key={item.id}
            {...item}
            active={activeId === item.id}
            secondary
          />
        ))}
      </ul>
    </nav>
  );
}

function SideNavLink({
  id,
  label,
  active,
  secondary = false,
}: {
  id: string;
  label: string;
  active: boolean;
  secondary?: boolean;
}) {
  return (
    <li>
      <a
        href={`#${id}`}
        className={[
          "side-nav-link",
          secondary ? "side-nav-link-secondary" : "",
          active ? "active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="side-nav-label">{label}</span>
        {active && !secondary && (
          <span className="side-nav-halftone" aria-hidden="true" />
        )}
      </a>
    </li>
  );
}
