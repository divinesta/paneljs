import { useEffect, useState } from "react";
import { Footer, Header, docsStart, github, useTheme } from "./chrome";

const packageManagers = [
  { id: "pnpm", label: "pnpm", command: "pnpm dlx paneljs@latest init" },
  { id: "npm", label: "npm", command: "npx paneljs@latest init" },
  { id: "yarn", label: "yarn", command: "yarn dlx paneljs@latest init" },
  { id: "bun", label: "bun", command: "bunx paneljs@latest init" },
] as const;

type PackageManagerId = (typeof packageManagers)[number]["id"];
type AdapterId = "prisma" | "typeorm" | "mikroorm";

const snippets: Record<AdapterId, string> = {
  prisma: `import express from "express";
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
app.listen(3000);`,
  typeorm: `import express from "express";
import { createAdmin } from "paneljs";
import { typeormAdapter } from "@paneljs/typeorm";
import { mount } from "@paneljs/express";
import { dataSource } from "./data-source.js";

await dataSource.initialize();

const app = express();

const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
  auth: { getCurrentUser },
});

admin
  .register("User")
  .register("Post", { listDisplay: ["title", "published"] });

await mount(app, admin);
app.listen(3000);`,
  mikroorm: `import express from "express";
import { createAdmin } from "paneljs";
import { mikroormAdapter } from "@paneljs/mikroorm";
import { mount } from "@paneljs/express";
import { orm } from "./orm.js";

const app = express();

const admin = createAdmin({
  adapter: mikroormAdapter({ orm }),
  auth: { getCurrentUser },
});

admin
  .register("User")
  .register("Post", { listDisplay: ["title", "published"] });

await mount(app, admin);
app.listen(3000);`,
};

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

export default function App() {
  const { theme, setTheme } = useTheme();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [copied, setCopied] = useState<"cli" | "snippet" | null>(null);
  const [manager, setManager] = useState<PackageManagerId>("pnpm");
  const [adapter, setAdapter] = useState<AdapterId>("prisma");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const hero = document.querySelector(".hero-copy");
    if (!hero || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => setScrolled(!entries[0]?.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" },
    );
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
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % slides.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [playing, theme]);

  const slide = slides[index] ?? slides[0]!;
  const src = theme === "light" ? slide.light : slide.dark;

  const selectedManager =
    packageManagers.find((item) => item.id === manager) ?? packageManagers[0];
  const installSource = snippets[adapter];

  const copy = async (key: "cli" | "snippet", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* ignore */
    }
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Header
        theme={theme}
        scrolled={scrolled}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />

      <main id="main">
        <section className="hero" aria-label="Introduction">
          <div className="hero-stack-orbit" aria-hidden="true">
            <span className="stack-token stack-token-express">
              <img src="/images/express.svg" width={46} height={46} alt="" />
            </span>
            <span className="stack-token stack-token-prisma">
              <img src="/images/prisma.svg" width={46} height={46} alt="" />
            </span>
            <span className="stack-token stack-token-typeorm">
              <img src="/images/typeorm.svg" width={46} height={46} alt="" />
            </span>
            <span className="stack-token stack-token-mikroorm">
              <img src="/images/mikroorm.svg" width={46} height={46} alt="" />
            </span>
          </div>

          <div className="hero-copy">
            <h1>
              The admin panel
              <br />
              for JavaScript ORMs.
            </h1>
            <p className="hero-sub">
              Register models, keep your auth, and get a guarded admin from the
              schema you already have.
            </p>
            <div className="hero-ctas">
              <a href={docsStart} className="btn btn-primary btn-lg">
                See Docs
              </a>
              <a href={github} className="btn btn-secondary btn-lg">
                View source
              </a>
            </div>
          </div>
        </section>

        <section className="product-showcase" aria-label="Product preview">
          <div
            className="product-stage"
            onMouseEnter={() => setPlaying(false)}
            onMouseLeave={() => setPlaying(true)}
            onFocus={() => setPlaying(false)}
            onBlur={() => setPlaying(true)}
          >
            <div
              className="slider"
              role="region"
              aria-roledescription="carousel"
              aria-label="Product screenshots"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setIndex(
                    (current) => (current + slides.length - 1) % slides.length,
                  );
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
                  <img
                    src={src}
                    width={1913}
                    height={924}
                    alt={`PanelJS ${slide.label}`}
                  />
                </figure>
              </div>
            </div>
            <div className="slider-bar">
              <button
                type="button"
                className="slider-arrow"
                aria-label="Previous screenshot"
                onClick={() =>
                  setIndex(
                    (current) => (current + slides.length - 1) % slides.length,
                  )
                }
              >
                <ChevronLeftIcon />
              </button>
              <div className="slider-dots" aria-label="Choose screenshot">
                {slides.map((item, i) => (
                  <button
                    key={item.label}
                    type="button"
                    aria-current={i === index}
                    aria-label={item.label}
                    onClick={() => setIndex(i)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="slider-arrow"
                aria-label="Next screenshot"
                onClick={() =>
                  setIndex((current) => (current + 1) % slides.length)
                }
              >
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
            <p className="lede">
              PanelJS does not replace your app. You keep the HTTP server, the
              ORM, and your auth. The packages read the schema and serve the
              panel.
            </p>

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
                <img src="/images/typeorm.svg" alt="" width={28} height={28} />
                <strong>TypeORM</strong>
                <span>DataSource</span>
              </li>
              <li>
                <img src="/images/mikroorm.svg" alt="" width={28} height={28} />
                <strong>MikroORM</strong>
                <span>MikroORM instance</span>
              </li>
              <li>
                <img
                  src="/images/typescript.svg"
                  alt=""
                  width={28}
                  height={28}
                />
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
                You register models. At mount, PanelJS introspects your Prisma
                schema, TypeORM entities, or MikroORM metadata and serves a
                React admin at <code>/admin</code> plus a JSON API at{" "}
                <code>/admin/api/*</code>.
              </p>
              <p>
                Learn how to <a href="/docs/guide/installation">get started</a>,{" "}
                <a href="/docs/guide/register">register models</a>, and
                configure <a href="/docs/guide/auth">authentication</a>.
              </p>
            </div>
            <ul className="feature-list">
              <li className="reveal">
                <h3>Schema is the source of truth</h3>
                <p>
                  <code>admin.register("User")</code> with no extra config still
                  produces a list, search, filters, and a create/edit form.
                </p>
              </li>
              <li className="reveal">
                <h3>Built-in or your own auth</h3>
                <p>
                  Use the admin-only login, or map an existing session onto{" "}
                  <code>getCurrentUser</code>. If that returns null, the API is
                  401.
                </p>
              </li>
              <li className="reveal">
                <h3>Permissions and tenant scope</h3>
                <p>
                  Role checks decide the verb. <code>scope()</code> decides the
                  rows. Same role does not mean the same records.
                </p>
              </li>
              <li className="reveal">
                <h3>Operations the team can use today</h3>
                <p>
                  Search, filters, pagination, relation display fields, and
                  custom actions on selected list records.
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
                <p>
                  Pass a Prisma, TypeORM, or MikroORM adapter, plus auth. The
                  library never ships a development backdoor.
                </p>
              </li>
              <li className="reveal">
                <span>register</span>
                <p>
                  Choose the models operators may touch. Add list columns,
                  permissions, or actions only when you need them.
                </p>
              </li>
              <li className="reveal">
                <span>mount</span>
                <p>
                  Attach the UI and API to your Express app. Fastify and Nest
                  are next. Deploy wherever that app already runs.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="code-section" id="install">
          <div className="container code-layout">
            <div className="code-copy reveal">
              <h2>One command. Then mount.</h2>
              <p>
                <code>init</code> asks for your framework and ORM, then installs
                the packages. It does not rewrite your source. Paste{" "}
                <code>createAdmin</code> next to the server you already have.
              </p>
              <ul className="install-notes">
                <li>Express 4 and 5 today. Fastify and Nest next.</li>
                <li>Prisma 7.5.x, TypeORM 0.3, or MikroORM 6.4+</li>
                <li>Node 20.19+ or Bun 1.3+</li>
              </ul>
            </div>
            <div className="code-stack reveal">
              <div className="code-panel">
                <div className="code-panel-header">
                  <div
                    className="code-tabs"
                    role="tablist"
                    aria-label="Package manager"
                  >
                    {packageManagers.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={manager === item.id}
                        onClick={() => setManager(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`copy-btn${copied === "cli" ? " copied" : ""}`}
                    onClick={() => void copy("cli", selectedManager.command)}
                    aria-label="Copy init command"
                  >
                    {copied === "cli" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="code-block cli-command">
                  <code>{selectedManager.command}</code>
                </pre>
              </div>
              <div className="code-panel">
                <div className="code-panel-header">
                  <div
                    className="code-tabs"
                    role="tablist"
                    aria-label="ORM snippet"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={adapter === "prisma"}
                      onClick={() => setAdapter("prisma")}
                    >
                      Prisma
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={adapter === "typeorm"}
                      onClick={() => setAdapter("typeorm")}
                    >
                      TypeORM
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={adapter === "mikroorm"}
                      onClick={() => setAdapter("mikroorm")}
                    >
                      MikroORM
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`copy-btn${copied === "snippet" ? " copied" : ""}`}
                    onClick={() => void copy("snippet", installSource)}
                    aria-label="Copy mount snippet"
                  >
                    {copied === "snippet" ? "Copied" : "Copy"}
                  </button>
                </div>
                <InstallSnippet adapter={adapter} />
              </div>
            </div>
          </div>
        </section>

        <section className="close">
          <div className="container close-inner reveal">
            <h2>Your operators deserve better than a custom dashboard.</h2>
            <p>Init, register your models, and let the schema do the rest.</p>
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

      <Footer theme={theme} />
    </>
  );
}

function InstallSnippet({ adapter }: { adapter: AdapterId }) {
  if (adapter === "mikroorm") {
    return (
      <pre className="code-block">
        <code>
          <span className="tok-k">import</span> express{" "}
          <span className="tok-k">from</span>{" "}
          <span className="tok-s">"express"</span>
          {"\n"}
          <span className="tok-k">import</span> {"{ createAdmin }"}{" "}
          <span className="tok-k">from</span>{" "}
          <span className="tok-s">"paneljs"</span>
          {"\n"}
          <span className="tok-k">import</span> {"{ mikroormAdapter }"}{" "}
          <span className="tok-k">from</span>{" "}
          <span className="tok-s">"@paneljs/mikroorm"</span>
          {"\n"}
          <span className="tok-k">import</span> {"{ mount }"}{" "}
          <span className="tok-k">from</span>{" "}
          <span className="tok-s">"@paneljs/express"</span>
          {"\n"}
          <span className="tok-k">import</span> {"{ orm }"}{" "}
          <span className="tok-k">from</span>{" "}
          <span className="tok-s">"./orm.js"</span>
          {"\n\n"}
          <span className="tok-k">const</span> app = express()
          {"\n\n"}
          <span className="tok-k">const</span> admin = createAdmin({"{"}
          {"\n  "}adapter: mikroormAdapter({"{"} orm {"}"}),
          {"\n  "}auth: {"{"} getCurrentUser {"}"},{"\n"}
          {"}"}){"\n\n"}admin{"\n  "}.register(
          <span className="tok-s">"User"</span>){"\n  "}.register(
          <span className="tok-s">"Post"</span>, {"{"} listDisplay: [
          <span className="tok-s">"title"</span>,{" "}
          <span className="tok-s">"published"</span>] {"}"}){"\n\n"}
          <span className="tok-k">await</span> mount(app, admin){"\n"}
          app.listen(<span className="tok-n">3000</span>)
        </code>
      </pre>
    );
  }

  if (adapter === "typeorm") {
    return (
      <pre className="code-block">
        <code>
          <span className="tok-k">import</span> express{" "}
          <span className="tok-k">from</span>{" "}
          <span className="tok-s">"express"</span>
          {"\n"}
          <span className="tok-k">import</span> {"{ createAdmin }"}{" "}
          <span className="tok-k">from</span>{" "}
          <span className="tok-s">"paneljs"</span>
          {"\n"}
          <span className="tok-k">import</span> {"{ typeormAdapter }"}{" "}
          <span className="tok-k">from</span>{" "}
          <span className="tok-s">"@paneljs/typeorm"</span>
          {"\n"}
          <span className="tok-k">import</span> {"{ mount }"}{" "}
          <span className="tok-k">from</span>{" "}
          <span className="tok-s">"@paneljs/express"</span>
          {"\n"}
          <span className="tok-k">import</span> {"{ dataSource }"}{" "}
          <span className="tok-k">from</span>{" "}
          <span className="tok-s">"./data-source.js"</span>
          {"\n\n"}
          <span className="tok-k">await</span> dataSource.initialize()
          {"\n\n"}
          <span className="tok-k">const</span> app = express()
          {"\n\n"}
          <span className="tok-k">const</span> admin = createAdmin({"{"}
          {"\n  "}adapter: typeormAdapter({"{"} dataSource {"}"}),
          {"\n  "}auth: {"{"} getCurrentUser {"}"},{"\n"}
          {"}"}){"\n\n"}admin{"\n  "}.register(
          <span className="tok-s">"User"</span>){"\n  "}.register(
          <span className="tok-s">"Post"</span>, {"{"} listDisplay: [
          <span className="tok-s">"title"</span>,{" "}
          <span className="tok-s">"published"</span>] {"}"}){"\n\n"}
          <span className="tok-k">await</span> mount(app, admin){"\n"}
          app.listen(<span className="tok-n">3000</span>)
        </code>
      </pre>
    );
  }

  return (
    <pre className="code-block">
      <code>
        <span className="tok-k">import</span> express{" "}
        <span className="tok-k">from</span>{" "}
        <span className="tok-s">"express"</span>
        {"\n"}
        <span className="tok-k">import</span> {"{ createAdmin }"}{" "}
        <span className="tok-k">from</span>{" "}
        <span className="tok-s">"paneljs"</span>
        {"\n"}
        <span className="tok-k">import</span> {"{ prismaAdapter }"}{" "}
        <span className="tok-k">from</span>{" "}
        <span className="tok-s">"@paneljs/prisma"</span>
        {"\n"}
        <span className="tok-k">import</span> {"{ mount }"}{" "}
        <span className="tok-k">from</span>{" "}
        <span className="tok-s">"@paneljs/express"</span>
        {"\n"}
        <span className="tok-k">import</span> {"{ prisma }"}{" "}
        <span className="tok-k">from</span>{" "}
        <span className="tok-s">"./prisma.js"</span>
        {"\n\n"}
        <span className="tok-k">const</span> app = express()
        {"\n\n"}
        <span className="tok-k">const</span> admin = createAdmin({"{"}
        {"\n  "}adapter: prismaAdapter({"{"} prisma {"}"}),
        {"\n  "}auth: {"{"} getCurrentUser {"}"},{"\n"}
        {"}"}){"\n\n"}admin{"\n  "}.register(
        <span className="tok-s">"User"</span>){"\n  "}.register(
        <span className="tok-s">"Post"</span>, {"{"} listDisplay: [
        <span className="tok-s">"title"</span>,{" "}
        <span className="tok-s">"published"</span>] {"}"}){"\n\n"}
        <span className="tok-k">await</span> mount(app, admin){"\n"}
        app.listen(<span className="tok-n">3000</span>)
      </code>
    </pre>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
