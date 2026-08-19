import { useEffect, useState } from "react";

const docsStart = "/docs/guide/getting-started";
const github = "https://github.com/divinesta/paneljs";
const installSource = `import express from "express";
import { createAdmin } from "paneljs";
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
   { label: "Overview", dark: "/images/product-dark-overview.png", light: "/images/product-light-overview.png" },
   { label: "User list", dark: "/images/product-dark-users.png", light: "/images/product-light-users.png" },
   { label: "Create user", dark: "/images/product-dark-create-user.png", light: "/images/product-light-create-user.png" },
];

function readTheme(): "dark" | "light" {
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
   const [playing, setPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
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
                  <Mark />
                  PanelJS
               </a>
               <nav className="header-nav" aria-label="Main">
                  <a href="#features">Features</a>
                  <a href="#how-it-works">How it works</a>
                  <a href="#install">Install</a>
               </nav>
               <div className="header-actions">
                  <button
                     type="button"
                     className="theme-toggle"
                     aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                     onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                     Theme
                  </button>
                  <a href={github} className="btn btn-ghost btn-github">
                     GitHub
                  </a>
                  <a href={docsStart} className="btn btn-primary">
                     Get started
                  </a>
               </div>
            </div>
         </header>

         <main id="main">
            <section className="hero" aria-label="Introduction">
               <div className="hero-copy">
                  <h1>
                     The control plane
                     <br />
                     for Express and Prisma.
                  </h1>
                  <p className="hero-sub">Register models, keep your auth, and give operators a guarded UI and API from the Prisma schema you already trust.</p>
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
               <div className="product-stage" onMouseEnter={() => setPlaying(false)} onMouseLeave={() => setPlaying(true)}>
                  <div className="slider" role="region" aria-roledescription="carousel" aria-label="Product screenshots">
                     <p className="sr-only" aria-live="polite">
                        {slide.label}
                     </p>
                     <figure className="slide is-active">
                        <img src={src} width={1913} height={924} alt={`PanelJS ${slide.label}`} />
                     </figure>
                  </div>
                  <div className="slider-bar">
                     <button type="button" className="slider-arrow" aria-label="Previous screenshot" onClick={() => setIndex((current) => (current + slides.length - 1) % slides.length)}>
                        ‹
                     </button>
                     <div className="slider-dots" aria-label="Choose screenshot">
                        {slides.map((item, i) => (
                           <button key={item.label} type="button" aria-current={i === index} aria-label={item.label} onClick={() => setIndex(i)} />
                        ))}
                     </div>
                     <button type="button" className="slider-arrow" aria-label="Next screenshot" onClick={() => setIndex((current) => (current + 1) % slides.length)}>
                        ›
                     </button>
                     <button type="button" className="slider-toggle" aria-pressed={!playing} onClick={() => setPlaying((value) => !value)}>
                        {playing ? "Pause" : "Play"}
                     </button>
                  </div>
               </div>
            </section>

            <section className="features" id="features">
               <div className="container feature-layout">
                  <div className="feature-intro reveal">
                     <h2>Built from the schema. Guarded by your auth.</h2>
                     <p>
                        You register models. At mount, PanelJS introspects <code>schema.prisma</code> and serves a React admin at <code>/admin</code>.
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
                        <h3>Adapters, not a stack lock</h3>
                        <p>
                           Core is <code>paneljs</code>. Host with <code>@paneljs/express</code>. Data from <code>@paneljs/prisma</code>.
                        </p>
                     </li>
                     <li className="reveal">
                        <h3>Permissions and tenant scope</h3>
                        <p>
                           Role checks decide the verb. <code>scope()</code> decides the rows.
                        </p>
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
                        <p>Pass a Prisma adapter and a getCurrentUser function.</p>
                     </li>
                     <li className="reveal">
                        <span>register</span>
                        <p>Choose the models operators may touch.</p>
                     </li>
                     <li className="reveal">
                        <span>mount</span>
                        <p>Attach the UI and API to your Express app.</p>
                     </li>
                  </ol>
               </div>
            </section>

            <section className="code-section" id="install">
               <div className="container code-layout">
                  <div className="code-copy reveal">
                     <h2>Install, register, mount.</h2>
                     <p>Point it at the Prisma client you already generate.</p>
                  </div>
                  <div className="code-panel reveal">
                     <div className="code-panel-header">
                        <span>server.ts</span>
                        <button type="button" className="copy-btn" onClick={() => void copy()} aria-label="Copy install snippet">
                           {copied ? "Copied" : "Copy"}
                        </button>
                     </div>
                     <pre className="code-block">
                        <code>{installSource}</code>
                     </pre>
                  </div>
               </div>
            </section>
         </main>

         <footer className="footer" role="contentinfo">
            <div className="container footer-inner">
               <div className="footer-brand">
                  <Mark />
                  <span>PanelJS</span>
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

function Mark() {
   return (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
         <rect width="32" height="32" rx="6" fill="#dbf27c" />
         <path d="M8 10h16M8 16h12M8 22h8" stroke="#0a0a0b" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
   );
}
