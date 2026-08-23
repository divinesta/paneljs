import { renderToStaticMarkup } from "react-dom/server";
import { blogPaths } from "./blog/posts";
import { Site } from "./Site";

export function render(url = "/") {
   return renderToStaticMarkup(<Site path={url} />);
}

export { blogPaths };
