import React from "react";
import { Link, useLocation } from "react-router-dom";
import { CHAMBER_THEME } from "@/lib/chambers";

export const Layout = ({ children, accentChamber = null }) => {
  const location = useLocation();
  const accent = accentChamber ? CHAMBER_THEME[accentChamber] : null;

  return (
    <div
      className="relative min-h-screen text-bone"
      style={{
        backgroundColor: "#0A0A0F",
      }}
      data-testid="cortex-layout"
    >
      <header
        className="sticky top-0 z-30 border-b border-slate/70 backdrop-blur-2xl"
        style={{ backgroundColor: "rgba(10,10,15,0.72)" }}
        data-testid="cortex-header"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
          <Link
            to="/"
            className="group flex items-center gap-3"
            data-testid="header-home-link"
          >
            <CortexMark color={accent?.accent || "#D6C08A"} />
            <div className="leading-tight">
              <div
                className="cortex-display text-[1.05rem] tracking-tight text-pearl"
                style={{ fontWeight: 600 }}
              >
                Global War Room
              </div>
              <div className="smallcaps text-ash">Five commanders, one brief</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <NavLink to="/" label="War Room" current={location.pathname === "/"} testid="nav-warroom" />
            <NavLink to="/cortex" label="Cortex" current={location.pathname.startsWith("/cortex")} testid="nav-cortex" />
            <NavLink to="/forge" label="The Forge" current={location.pathname.startsWith("/forge")} testid="nav-forge" />
            <NavLink to="/receipts" label="Receipts" current={location.pathname.startsWith("/receipts")} testid="nav-receipts" />
            <NavLink to="/archive" label="Archive" current={location.pathname.startsWith("/archive")} testid="nav-archive" />
            <NavLink to="/about" label="About" current={location.pathname.startsWith("/about")} testid="nav-about" />
            <NavLink to="/pricing" label="Membership" current={location.pathname.startsWith("/pricing") || location.pathname.startsWith("/billing")} testid="nav-pricing" />
          </nav>
        </div>
      </header>

      <main className="relative">{children}</main>

      <footer className="border-t border-slate/60 mt-24">
        <div className="mx-auto max-w-7xl px-6 py-10 md:px-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <p className="cortex-display italic text-bone/70 text-base">
              Real wisdom is never one voice.
            </p>
            <div className="flex flex-wrap items-center gap-x-7 gap-y-3 smallcaps text-ash">
              <span style={{ color: "#D6C08A" }}>War Room</span>
              <span className="text-slate">·</span>
              <span>Senate</span>
              <span className="text-slate">·</span>
              <span>Boardroom</span>
              <span className="text-slate">·</span>
              <span>Court Room</span>
              <span className="text-slate">·</span>
              <span>Council</span>
              <span className="text-slate">·</span>
              <span style={{ color: "#FFE5B4" }}>Forge</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const NavLink = ({ to, label, current, testid }) => (
  <Link
    to={to}
    data-testid={testid}
    className={`smallcaps transition-colors duration-300 ${
      current ? "text-pearl" : "text-ash hover:text-bone"
    }`}
  >
    {label}
  </Link>
);

const CortexMark = ({ color }) => (
  <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
    <ellipse
      cx="20"
      cy="20"
      rx="15"
      ry="13"
      stroke={color}
      strokeWidth="1"
      opacity="0.7"
    />
    <path
      d="M20 7 V 33"
      stroke={color}
      strokeWidth="0.8"
      opacity="0.5"
    />
    <path d="M9 16 q 11 -3 22 0 M9 24 q 11 3 22 0" stroke={color} strokeWidth="0.8" opacity="0.6" />
    <circle cx="20" cy="20" r="2" fill={color} />
  </svg>
);

export default Layout;
