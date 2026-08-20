import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

const docsStart = "/docs/guide/getting-started";
const github = "https://github.com/divinesta/paneljs";
const sponsor = "https://github.com/sponsors/divinesta";
const installSource = `import express from "express";
import { createAdmin } from "@paneljs/paneljs";
import { prismaAdapter } from "@paneljs/prisma";
import { mount } from "@paneljs/express";
import { prisma } from "./prisma.js";

const app = express();

const admin = createAdmin({
  adapter: prismaAdapter({ prisma }),
  auth: { getCurrentUser },
});

admin
  .register("User")
  .register("Post", { listDisplay: ["title", "published"] });

await mount(app, admin);
app.listen(3000);`;

const slides = [
   {
      label: "Overview",
      dark: "/images/product-dark-overview.png",
      light: "/images/product-light-overview.png",
   },
   {
      label: "User list",
      dark: "/images/product-dark-users.png",
      light: "/images/product-light-users.png",
   },
   {
      label: "Create user",
      dark: "/images/product-dark-create-user.png",
      light: "/images/product-light-create-user.png",
   },
];

function readTheme(): "dark" | "light" {
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

export default function App() {
   const [theme, setTheme] = useState<"dark" | "light">(readTheme);
   const [index, setIndex] = useState(0);
   const [playing, setPlaying] = useState(() => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const [copied, setCopied] = useState(false);
   const [scrolled, setScrolled] = useState(false);

   useEffect(() => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.add("js");
      try {
         window.localStorage.setItem("paneljs-landing-theme", theme);
      } catch {
         /* ignore */
      }
   }, [theme]);

   useEffect(() => {
      const hero = document.querySelector(".hero-copy");
      if (!hero || !("IntersectionObserver" in window)) return;
      const observer = new IntersectionObserver((entries) => setScrolled(!entries[0]?.isIntersecting), { threshold: 0, rootMargin: "-64px 0px 0px 0px" });
      observer.observe(hero);
      return () => observer.disconnect();
   }, []);

   useEffect(() => {
      const nodes = document.querySelectorAll(".reveal");
      if (!("IntersectionObserver" in window)) {
         nodes.forEach((el) => el.classList.add("revealed"));
         return;
      }
      const observer = new IntersectionObserver(
         (entries) => {
            for (const entry of entries) {
               if (entry.isIntersecting) {
                  entry.target.classList.add("revealed");
                  observer.unobserve(entry.target);
               }
            }
         },
         { threshold: 0.12, rootMargin: "0px 0px -32px 0px" },
      );
      nodes.forEach((el) => observer.observe(el));
      return () => observer.disconnect();
   }, []);

   useEffect(() => {
      if (!playing || slides.length < 2) return;
      const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 6000);
      return () => window.clearInterval(timer);
   }, [playing, theme]);

   const slide = slides[index] ?? slides[0]!;
   const src = theme === "light" ? slide.light : slide.dark;

   const copy = async () => {
      try {
         await navigator.clipboard.writeText(installSource);
      } catch {
         /* ignore */
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
   };

   return (
      <>
         <a href="#main" className="skip-link">
            Skip to main content
         </a>
         <header className={`header${scrolled ? " scrolled" : ""}`} role="banner">
            <div className="container header-inner">
               <a href="/" className="brand" aria-label="PanelJS home">
                  <BrandLogo theme={theme} />
               </a>
               <nav className="header-nav" aria-label="Main">
                  <a href="#features">Features</a>
                  <a href="#how-it-works">How it works</a>
                  <a href="#install">Install</a>
               </nav>
               <div className="header-actions">
                  <button type="button" className="theme-toggle" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                     <SunIcon />
                     <MoonIcon />
                     <span className="sr-only">Switch to {theme === "dark" ? "light" : "dark"} theme</span>
                  </button>
                  <a href={sponsor} className="btn btn-sponsor" target="_blank" rel="noopener noreferrer" aria-label="Sponsor PanelJS on GitHub">
                     <span className="sponsor-heart" aria-hidden="true">
                        <Heart size={16} fill="currentColor" strokeWidth={2.5} />
                     </span>
                     <span className="btn-label">Sponsor</span>
                  </a>
                  <a href={github} className="btn btn-ghost btn-github" aria-label="View source on GitHub">
                     <GitHubIcon />
                     <span className="btn-label">GitHub</span>
                  </a>
                  <a href={docsStart} className="btn btn-primary">
                     Get started
                  </a>
               </div>
            </div>
         </header>

         <main id="main">
            <section className="hero" aria-label="Introduction">
               <div className="hero-stack-orbit" aria-hidden="true">
                  <span className="stack-token stack-token-express">
                     <img src="/images/express.svg" width={46} height={46} alt="" />
                  </span>
                  <span className="stack-token stack-token-prisma">
                     <img src="/images/prisma.svg" width={46} height={46} alt="" />
                  </span>
                  <span className="stack-token stack-token-postgres">
                     <img src="/images/postgresql.svg" width={46} height={46} alt="" />
                  </span>
                  <span className="stack-token stack-token-typescript">
                     <img src="/images/typescript.svg" width={46} height={46} alt="" />
                  </span>
               </div>

               <div className="hero-copy">
                  <h1>
                     The admin panel
                     <br />
                     for JavaScript ORMs.
                  </h1>
                  <p className="hero-sub">Register models, keep your auth, and give operators a guarded UI and API from the schema your app already trusts.</p>
                  <div className="hero-ctas">
                     <a href={docsStart} className="btn btn-primary btn-lg">
                        Get started
                     </a>
                     <a href={github} className="btn btn-secondary btn-lg">
                        View source
                     </a>
                  </div>
               </div>
            </section>

            <section className="product-showcase" aria-label="Product preview">
               <div className="product-stage" onMouseEnter={() => setPlaying(false)} onMouseLeave={() => setPlaying(true)} onFocus={() => setPlaying(false)} onBlur={() => setPlaying(true)}>
                  <div
                     className="slider"
                     role="region"
                     aria-roledescription="carousel"
                     aria-label="Product screenshots"
                     tabIndex={0}
                     onKeyDown={(event) => {
                        if (event.key === "ArrowLeft") {
                           event.preventDefault();
                           setIndex((current) => (current + slides.length - 1) % slides.length);
                        }
                        if (event.key === "ArrowRight") {
                           event.preventDefault();
                           setIndex((current) => (current + 1) % slides.length);
                        }
                     }}
                  >
                     <p className="sr-only" aria-live="polite">
                        {slide.label}
                     </p>
                     <div className="slider-track">
                        <figure className="slide is-active">
                           <img src={src} width={1913} height={924} alt={`PanelJS ${slide.label}`} />
                        </figure>
                     </div>
                  </div>
                  <div className="slider-bar">
                     <button type="button" className="slider-arrow" aria-label="Previous screenshot" onClick={() => setIndex((current) => (current + slides.length - 1) % slides.length)}>
                        <ChevronLeftIcon />
                     </button>
                     <div className="slider-dots" aria-label="Choose screenshot">
                        {slides.map((item, i) => (
                           <button key={item.label} type="button" aria-current={i === index} aria-label={item.label} onClick={() => setIndex(i)} />
                        ))}
                     </div>
                     <button type="button" className="slider-arrow" aria-label="Next screenshot" onClick={() => setIndex((current) => (current + 1) % slides.length)}>
                        <ChevronRightIcon />
                     </button>
                     <button
                        type="button"
                        className="slider-toggle"
                        aria-pressed={!playing}
                        aria-label={`${playing ? "Pause" : "Play"} screenshot rotation`}
                        onClick={() => setPlaying((value) => !value)}
                     >
                        {playing ? "Pause" : "Play"}
                     </button>
                  </div>
               </div>
            </section>

            <section className="stack-section" aria-label="Works with your stack">
               <div className="container">
                  <h2>It mounts on the stack you already run.</h2>
                  <p className="lede">PanelJS does not replace your app. You keep Express, Prisma, and your auth. The packages read the schema and serve the panel.</p>

                  <ul className="stack-row">
                     <li>
                        <img src="/images/express.svg" alt="" width={28} height={28} />
                        <strong>Express</strong>
                        <span>mount(app, admin)</span>
                     </li>
                     <li>
                        <img src="/images/prisma.svg" alt="" width={28} height={28} />
                        <strong>Prisma</strong>
                        <span>schema.prisma</span>
                     </li>
                     <li>
                        <img src="/images/postgresql.svg" alt="" width={28} height={28} />
                        <strong>PostgreSQL</strong>
                        <span>your database</span>
                     </li>
                     <li>
                        <img src="/images/typescript.svg" alt="" width={28} height={28} />
                        <strong>TypeScript</strong>
                        <span>typed register()</span>
                     </li>
                     <li>
                        <img src="/images/bun.svg" alt="" width={28} height={28} />
                        <strong>Bun or Node</strong>
                        <span>Node 20+ / Bun 1.3</span>
                     </li>
                  </ul>

                  <ul className="proof-row">
                     <li>No second schema to maintain</li>
                     <li>No built-in login to rip out later</li>
                     <li>Scope applied on every query</li>
                  </ul>
               </div>
            </section>

            <section className="features" id="features">
               <div className="container feature-layout">
                  <div className="feature-intro reveal">
                     <h2>Built from the schema. Guarded by your auth.</h2>
                     <p>
                        You register models. At mount, PanelJS introspects <code>schema.prisma</code> and serves a React admin at <code>/admin</code> plus a JSON API at <code>/admin/api/*</code>.
                     </p>
                     <p>
                        Learn how to <a href="/docs/guide/getting-started">get started</a>, <a href="/docs/guide/register">register models</a>, and configure <a href="/docs/guide/auth">authentication</a>.
                     </p>
                  </div>
                  <ul className="feature-list">
                     <li className="reveal">
                        <h3>Schema is the source of truth</h3>
                        <p>
                           <code>admin.register("User")</code> with no extra config still produces a list, search, filters, and a create/edit form.
                        </p>
                     </li>
                     <li className="reveal">
                        <h3>Your identity adapter</h3>
                        <p>
                           There is no bundled login screen. If <code>getCurrentUser</code> returns null, the API is 401. Wire it to the session you already have.
                        </p>
                     </li>
                     <li className="reveal">
                        <h3>Permissions and tenant scope</h3>
                        <p>
                           Role checks decide the verb. <code>scope()</code> decides the rows. Same role does not mean the same records.
                        </p>
                     </li>
                     <li className="reveal">
                        <h3>Operations the team can use today</h3>
                        <p>Search, filters, pagination, relation display fields, and custom actions on selected list records.</p>
                     </li>
                  </ul>
               </div>
            </section>

            <section className="how-it-works" id="how-it-works">
               <div className="container">
                  <div className="reveal how-intro">
                     <h2>Three calls. Everything else is optional.</h2>
                  </div>
                  <ol className="calls">
                     <li className="reveal">
                        <span>createAdmin</span>
                        <p>
                           Pass a Prisma adapter and a <code>getCurrentUser</code> function. The library never ships a development backdoor.
                        </p>
                     </li>
                     <li className="reveal">
                        <span>register</span>
                        <p>Choose the models operators may touch. Add list columns, permissions, or actions only when you need them.</p>
                     </li>
                     <li className="reveal">
                        <span>mount</span>
                        <p>Attach the UI and API to your Express app. Deploy wherever that app already runs.</p>
                     </li>
                  </ol>
               </div>
            </section>

            <section className="code-section" id="install">
               <div className="container code-layout">
                  <div className="code-copy reveal">
                     <h2>Install, register, mount.</h2>
                     <p>
                        Point it at the Prisma client you already generate. Include <code>schema.prisma</code> in the deploy artifact, or pass <code>schemaPath</code>.
                     </p>
                     <ul className="install-notes">
                        <li>Works on Express 4 and 5</li>
                        <li>
                           Prisma and <code>@prisma/client</code> 7.5.x
                        </li>
                        <li>Node 20.19+ or Bun 1.3+</li>
                     </ul>
                  </div>
                  <div className="code-panel reveal">
                     <div className="code-panel-header">
                        <span>server.ts</span>
                        <button type="button" className={`copy-btn${copied ? " copied" : ""}`} onClick={() => void copy()} aria-label="Copy install snippet">
                           {copied ? "Copied" : "Copy"}
                        </button>
                     </div>
                     <pre className="code-block">
                        <code>
                           <span className="tok-k">import</span> express <span className="tok-k">from</span> <span className="tok-s">"express"</span>
                           {"\n"}
                           <span className="tok-k">import</span> {"{ createAdmin }"} <span className="tok-k">from</span> <span className="tok-s">"@paneljs/paneljs"</span>
                           {"\n"}
                           <span className="tok-k">import</span> {"{ prismaAdapter }"} <span className="tok-k">from</span> <span className="tok-s">"@paneljs/prisma"</span>
                           {"\n"}
                           <span className="tok-k">import</span> {"{ mount }"} <span className="tok-k">from</span> <span className="tok-s">"@paneljs/express"</span>
                           {"\n"}
                           <span className="tok-k">import</span> {"{ prisma }"} <span className="tok-k">from</span> <span className="tok-s">"./prisma.js"</span>
                           {"\n\n"}
                           <span className="tok-k">const</span> app = express()
                           {"\n\n"}
                           <span className="tok-k">const</span> admin = createAdmin({"{"}
                           {"\n  "}adapter: prismaAdapter({"{"} prisma {"}"}),
                           {"\n  "}auth: {"{"} getCurrentUser {"}"},{"\n"}
                           {"}"}){"\n\n"}admin{"\n  "}.register(
                           <span className="tok-s">"User"</span>){"\n  "}.register(
                           <span className="tok-s">"Post"</span>, {"{"} listDisplay: [<span className="tok-s">"title"</span>, <span className="tok-s">"published"</span>] {"}"}){"\n\n"}
                           <span className="tok-k">await</span> mount(app, admin){"\n"}
                           app.listen(<span className="tok-n">3000</span>)
                        </code>
                     </pre>
                  </div>
               </div>
            </section>

            <section className="close">
               <div className="container close-inner reveal">
                  <h2>Your operators deserve better than a custom dashboard.</h2>
                  <p>Install it, connect the auth you already have, and let the schema do the rest.</p>
                  <div className="hero-ctas">
                     <a href={docsStart} className="btn btn-primary btn-lg">
                        Get started
                     </a>
                     <a href={github} className="btn btn-secondary btn-lg">
                        View source
                     </a>
                  </div>
               </div>
            </section>
         </main>

         <footer className="footer" role="contentinfo">
            <div className="container footer-inner">
               <div className="footer-brand">
                  <BrandLogo theme={theme} />
                  <small>MIT licensed</small>
               </div>
               <nav className="footer-links" aria-label="Footer">
                  <a href={github}>GitHub</a>
                  <a href="#features">Features</a>
                  <a href="#install">Install</a>
                  <a href={docsStart}>Docs</a>
               </nav>
            </div>
         </footer>
      </>
   );
}

function BrandLogo({ theme }: { theme: "dark" | "light" }) {
   return (
      <span className="brand-logo" aria-hidden="true">
         <img src={`/brand/paneljs-logo-${theme === "dark" ? "light" : "dark"}.svg`} alt="" />
      </span>
   );
}

function SunIcon() {
   return (
      <svg className="theme-icon theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
         <circle cx="12" cy="12" r="3.5" />
         <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
   );
}

function MoonIcon() {
   return (
      <svg className="theme-icon theme-icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
         <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z" />
      </svg>
   );
}

function GitHubIcon() {
   return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
         <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
   );
}

function ChevronLeftIcon() {
   return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
         <path d="M15 6l-6 6 6 6" />
      </svg>
   );
}

function ChevronRightIcon() {
   return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
         <path d="M9 6l6 6-6 6" />
      </svg>
   );
}
