import { Footer, Header, useTheme } from "../chrome";
import { getPost, listPosts } from "./posts";

function formatDate(iso: string): string {
   const [year, month, day] = iso.split("-").map(Number);
   if (!year || !month || !day) return iso;
   return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
   });
}

function useSolidHeader() {
   const { theme, setTheme } = useTheme();
   return { theme, setTheme, scrolled: true };
}

export function BlogIndex() {
   const { theme, setTheme, scrolled } = useSolidHeader();
   const posts = listPosts();

   return (
      <>
         <a href="#main" className="skip-link">
            Skip to main content
         </a>
         <Header theme={theme} scrolled={scrolled} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
         <main id="main" className="blog-page">
            <div className="container blog-wrap">
               <h1>Blog</h1>
               <p className="lede">Notes on PanelJS: releases, adapters, and how the admin is meant to be used.</p>
               {posts.length === 0 ? (
                  <p className="blog-empty">Nothing published yet.</p>
               ) : (
                  <ul className="blog-list">
                     {posts.map((post) => (
                        <li key={post.slug}>
                           <a href={`/blog/${post.slug}`}>
                              {post.image ? <img src={post.image} alt="" className="blog-cover" /> : null}
                              {post.date ? <time dateTime={post.date}>{formatDate(post.date)}</time> : null}
                              <strong>{post.title}</strong>
                              {post.description ? <span>{post.description}</span> : null}
                           </a>
                        </li>
                     ))}
                  </ul>
               )}
            </div>
         </main>
         <Footer theme={theme} />
      </>
   );
}

export function BlogPost({ slug }: { slug: string }) {
   const { theme, setTheme, scrolled } = useSolidHeader();
   const post = getPost(slug);

   if (!post) {
      return (
         <>
            <a href="#main" className="skip-link">
               Skip to main content
            </a>
            <Header theme={theme} scrolled={scrolled} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
            <main id="main" className="blog-page">
               <div className="container blog-wrap">
                  <h1>Not found</h1>
                  <p className="lede">
                     That post does not exist. <a href="/blog">Back to the blog</a>.
                  </p>
               </div>
            </main>
            <Footer theme={theme} />
         </>
      );
   }

   return (
      <>
         <a href="#main" className="skip-link">
            Skip to main content
         </a>
         <Header theme={theme} scrolled={scrolled} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
         <main id="main" className="blog-page">
            <article className="container blog-wrap">
               <p className="blog-back">
                  <a href="/blog">Blog</a>
               </p>
               {post.date ? <time dateTime={post.date}>{formatDate(post.date)}</time> : null}
               <h1>{post.title}</h1>
               {post.description ? <p className="lede">{post.description}</p> : null}
               {post.image ? (
                  <img src={post.image} alt="" className="blog-hero" />
               ) : null}
               <div className="post-body" dangerouslySetInnerHTML={{ __html: post.html }} />
            </article>
         </main>
         <Footer theme={theme} />
      </>
   );
}
