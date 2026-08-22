import DefaultTheme from "vitepress/theme";
import ChooserGrid from "./ChooserGrid.vue";
import "./custom.css";

export default {
   extends: DefaultTheme,
   enhanceApp({ app }) {
      app.component("ChooserGrid", ChooserGrid);
   },
};
