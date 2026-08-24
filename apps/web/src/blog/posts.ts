export interface Post {
  slug: string;
  title: string;
  date: string;
  description: string;
  image?: string;
  html: string;
}

const files = import.meta.glob("../../content/blog/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function parseFrontmatter(raw: string): {
  data: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw.trim() };
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const sep = line.indexOf(":");
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim();
    const value = line
      .slice(sep + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) data[key] = value;
  }
  return { data, body: match[2].trim() };
}

function slugFromPath(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.md$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(value: string): string {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const html: string[] = [];
  let index = 0;

  const takeList = (ordered: boolean) => {
    const items: string[] = [];
    const bullet = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
    while (index < lines.length && bullet.test(lines[index])) {
      items.push(`<li>${inline(lines[index].replace(bullet, ""))}</li>`);
      index += 1;
    }
    html.push(
      `<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`,
    );
  };

  while (index < lines.length) {
    const line = lines[index];
    if (line.startsWith("```")) {
      const buf: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        buf.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      html.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }
    if (line.startsWith("### ")) {
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
      index += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      html.push(`<h2>${inline(line.slice(2))}</h2>`);
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      takeList(false);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      takeList(true);
      continue;
    }
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(line.trim())) {
      html.push(inline(line.trim()));
      index += 1;
      continue;
    }
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    const para: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !lines[index].startsWith("#") &&
      !lines[index].startsWith("```") &&
      !/^[-*]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index]) &&
      !/^!\[[^\]]*\]\([^)]+\)$/.test(lines[index].trim())
    ) {
      para.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return html.join("");
}

function loadPosts(): Post[] {
  const posts: Post[] = [];
  for (const [path, raw] of Object.entries(files)) {
    const { data, body } = parseFrontmatter(raw);
    if (data.draft === "true") continue;
    const slug = data.slug || slugFromPath(path);
    if (slug === "README") continue;
    posts.push({
      slug,
      title: data.title || slug,
      date: data.date || "",
      description: data.description || "",
      image: data.image || undefined,
      html: renderMarkdown(body),
    });
  }
  return posts.sort(
    (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
  );
}

const posts = loadPosts();

export function listPosts(): Post[] {
  return posts;
}

export function getPost(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}

export function blogPaths(): string[] {
  return ["/blog", ...posts.map((post) => `/blog/${post.slug}`)];
}
