# Admin UI styling

The admin uses the existing React and plain CSS stack, with no runtime styling dependencies. `../styles.css` is the import entry point. Edit the owning stylesheet instead of adding an override layer.

- `tokens.css`: bundled font faces, semantic surface/text/action colors, light/dark themes, accent palettes, radii, sidebar width, easing.
- `base.css`: reset, shared page typography, headings, focus treatment, skip link.
- `shell.css`: sidebar, navigation, topbar, identity.
- `controls.css`: shared buttons and interaction states.
- `overview.css`: model directory.
- `table.css`: search, filters, selection, table, pagination, loading placeholders.
- `forms.css`: record forms, detail rows, relation controls, validation.
- `feedback.css`: deletion confirmation, empty/error/full-page states.
- `appearance.css`: theme and account controls.
- `login.css`: sign-in page.
- `responsive.css`: mobile overrides and reduced motion; imported last.

Use semantic variables for colors and shared radii. DM Sans is the interface font; DM Mono is reserved for compact metadata. Neutral is the default accent; saved appearance preferences remain valid. Both themes share the same component rules.

Keep frequent navigation immediate and control feedback short. Avoid font-size changes on hover, automatic page entrance motion, and decorative animation. Preserve visible keyboard focus, local horizontal scrolling for tables, and 44px mobile controls.

When changing styles, run `pnpm --filter @paneljs/ui build`, then inspect overview, lists, create/edit, deletion, login, appearance, and loading/empty/error states in both themes and at mobile widths. The host serves the built UI, so rebuild before refreshing an example app.
