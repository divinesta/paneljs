import App from "./App";
import { BlogIndex, BlogPost } from "./blog/BlogPages";

export function normalizePath(path: string): string {
   const clean = path.split("?")[0]?.split("#")[0] ?? "/";
   if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
   return clean || "/";
}

export function Site({ path }: { path: string }) {
   const pathname = normalizePath(path);
   if (pathname === "/blog") return <BlogIndex />;
   if (pathname.startsWith("/blog/")) return <BlogPost slug={pathname.slice("/blog/".length)} />;
   return <App />;
}
