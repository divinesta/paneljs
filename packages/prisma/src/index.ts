import type {
  AdminModelMeta,
  DataAdapter,
} from "@paneljs/paneljs";
import {
  getSchemaProvider,
  introspect,
  usesInsensitiveSearch,
  type IntrospectOptions,
} from "./introspector.js";
import {
  prismaResource,
  type PrismaDelegate,
} from "./resource.js";
import { prismaAuthStore } from "./authStore.js";

export type PrismaClientLike = object;

function getDelegate(
  prisma: PrismaClientLike,
  meta: AdminModelMeta,
): PrismaDelegate {
  const delegate = (prisma as Record<string, PrismaDelegate | undefined>)[
    meta.clientKey
  ];
  if (!delegate)
    throw new Error(
      `[paneljs] Prisma client has no delegate for model "${meta.name}".`,
    );
  return delegate;
}

export interface PrismaAdapterOptions extends IntrospectOptions {
  prisma: PrismaClientLike;
}

export function prismaAdapter(options: PrismaAdapterOptions): DataAdapter {
  const { prisma, schemaPath } = options;
  return {
    client: prisma,
    introspect: () => introspect({ schemaPath }),
    resource: (meta) =>
      prismaResource(getDelegate(prisma, meta), meta, {
        caseInsensitiveSearch: usesInsensitiveSearch(
          getSchemaProvider(schemaPath),
        ),
      }),
    createAuthStore: (auth) => prismaAuthStore(prisma, auth),
  };
}

export {
  introspect,
  clearIntrospectionCache,
  getSchemaProvider,
  usesInsensitiveSearch,
} from "./introspector.js";
export type { IntrospectOptions } from "./introspector.js";
export { getDelegate };
export { prismaActionWhere, prismaResource } from "./resource.js";
export type { PrismaDelegate } from "./resource.js";
export { prismaAuthStore } from "./authStore.js";
