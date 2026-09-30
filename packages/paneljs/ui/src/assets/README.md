# Login assets

- `paneljs-logo-dark.svg` and `paneljs-mark.svg` are copied from `apps/web/public/brand`. Only the root viewBox and intrinsic dimensions are adjusted to remove the export's empty artboard; the artwork is unchanged.

Assets are imported by `LoginPage.tsx` so Vite bundles them and the Express host can serve them under any configured admin base path.

`login-architecture.png` is an AI-generated architectural photograph created for this login page using the PanelJS brand as a color reference. The logo and headline are rendered separately for clarity.
