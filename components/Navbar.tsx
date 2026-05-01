"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/arena", label: "Arena" },
    { href: "/create", label: "Build" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-brand neon-flicker">
        <img
          src="/logo-icon.svg"
          alt=""
          aria-hidden="true"
          style={{ height: 32, width: 32, display: "block" }}
        />
        AIRENA
      </Link>

      <ul className="navbar-links">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={pathname === link.href ? "active" : ""}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="navbar-actions">
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus="address"
        />
      </div>
    </nav>
  );
}
