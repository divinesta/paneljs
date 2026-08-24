declare global {
  interface Window {
    __PANELJS_BASE_PATH__?: string;
  }
}

/** Set by the server in index.html so one UI build works at any base path. */
export const adminBasePath = window.__PANELJS_BASE_PATH__ ?? "/admin";

export const joinAdminPath = (basePath: string, path: string): string =>
  `${basePath === "/" ? "" : basePath}${path}`;
