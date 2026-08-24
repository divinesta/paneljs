import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

export const docsStart = "/docs/guide/installation";
export const github = "https://github.com/divinesta/paneljs";
export const sponsor = "https://github.com/sponsors/divinesta";

export function readTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  try {
    const query = new URLSearchParams(window.location.search).get("theme");
    if (query === "light" || query === "dark") return query;
    const saved = window.localStorage.getItem("paneljs-landing-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.add("js");
    try {
      window.localStorage.setItem("paneljs-landing-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return { theme, setTheme };
}

export function Header({
  theme,
  onToggleTheme,
  scrolled,
}: {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  scrolled: boolean;
}) {
  return (
    <header className={`header${scrolled ? " scrolled" : ""}`} role="banner">
      <div className="container header-inner">
        <a href="/" className="brand" aria-label="PanelJS home">
          <BrandLogo theme={theme} />
        </a>
        <nav className="header-nav" aria-label="Main">
          <a href="/blog">Blog</a>
          <a href="/#how-it-works">How it works</a>
          <a href="/#install">Install</a>
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={onToggleTheme}
          >
            <SunIcon />
            <MoonIcon />
            <span className="sr-only">
              Switch to {theme === "dark" ? "light" : "dark"} theme
            </span>
          </button>
          <a
            href={sponsor}
            className="btn btn-sponsor"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Sponsor PanelJS on GitHub"
          >
            <span className="sponsor-heart" aria-hidden="true">
              <Heart size={16} fill="currentColor" strokeWidth={2.5} />
            </span>
            <span className="btn-label">Sponsor</span>
          </a>
          <a
            href={github}
            className="btn-github"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="PanelJS on GitHub"
          >
            <GitHubIcon />
          </a>
          <a href={docsStart} className="btn btn-primary">
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}

export function Footer({ theme }: { theme: "dark" | "light" }) {
  return (
    <footer className="footer" role="contentinfo">
      <div className="container footer-inner">
        <div className="footer-brand">
          <BrandLogo theme={theme} />
          <small>MIT licensed</small>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href={github}>GitHub</a>
          <a href="/blog">Blog</a>
          <a href="/#install">Install</a>
          <a href={docsStart}>Docs</a>
        </nav>
      </div>
    </footer>
  );
}

export function BrandLogo({ theme }: { theme: "dark" | "light" }) {
  return (
    <span className="brand-logo" aria-hidden="true">
      <img
        src={`/brand/paneljs-logo-${theme === "dark" ? "light" : "dark"}.svg`}
        alt=""
      />
    </span>
  );
}

function SunIcon() {
  return (
    <svg
      className="theme-icon theme-icon-sun"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="theme-icon theme-icon-moon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
