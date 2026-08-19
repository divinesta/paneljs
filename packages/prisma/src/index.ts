import type {
  AdminModelMeta,
  DataAdapter,
  ModelResource,
} from "@paneljs/paneljs";
import { introspect, type IntrospectOptions } from "./introspector.js";

export type PrismaClientLike = object;

type PrismaModelDelegate = ModelResource & {
  findUnique?(args: unknown): Promise<unknown>;
  create?(args: unknown): Promise<unknown>;
};

function getDelegate(
  prisma: PrismaClientLike,
  meta: AdminModelMeta,
): PrismaModelDelegate {
  const delegate = (prisma as Record<string, PrismaModelDelegate | undefined>)[
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
    resource: (meta) => getDelegate(prisma, meta),
  };
}

export { introspect, clearIntrospectionCache } from "./introspector.js";
export type { IntrospectOptions } from "./introspector.js";
export { getDelegate };
