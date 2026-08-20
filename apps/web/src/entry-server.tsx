import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";

export function render() {
   return renderToStaticMarkup(<App />);
}
