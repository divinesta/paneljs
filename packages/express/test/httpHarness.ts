import express, { type Express } from "express";
import {
  createAdmin,
  hashAdminPassword,
  type AdminAuthStore,
  type AdminModelMeta,
  type AdminUser,
  type BuiltInSessionRecord,
  type BuiltInUserRecord,
  type DataAdapter,
  type FieldFilters,
  type FieldSelect,
  type ModelResource,
} from "paneljs";

import { mount } from "../src/index.js";

export const transportAdminUser: AdminUser = {
  id: "transport-admin",
  email: "admin@paneljs.test",
  role: "ADMIN",
  isSuperAdmin: false,
  tenantId: "tenant-a",
};

const postMeta: AdminModelMeta = {
  name: "Post",
  pluralName: "posts",
  clientKey: "Post",
  idField: "id",
  displayField: "title",
  searchableFields: ["title"],
  filterableFields: ["published"],
  timestamps: {},
  fields: [
    {
      name: "id",
      type: "number",
      nativeType: "Int",
      isId: true,
      isRequired: true,
      isUnique: true,
      isReadOnly: true,
      isList: false,
      isFilterable: false,
      isSearchable: false,
      defaultValue: null,
      relation: null,
    },
    {
      name: "title",
      type: "string",
      nativeType: "String",
      isId: false,
      isRequired: true,
      isUnique: false,
      isReadOnly: false,
      isList: false,
      isFilterable: false,
      isSearchable: true,
      defaultValue: null,
      relation: null,
    },
    {
      name: "published",
      type: "boolean",
      nativeType: "Boolean",
      isId: false,
      isRequired: true,
      isUnique: false,
      isReadOnly: false,
      isList: false,
      isFilterable: true,
      isSearchable: false,
      defaultValue: false,
      relation: null,
    },
    {
      name: "tenantId",
      type: "string",
      nativeType: "String",
      isId: false,
      isRequired: true,
      isUnique: false,
      isReadOnly: false,
      isList: false,
      isFilterable: false,
      isSearchable: false,
      defaultValue: null,
      relation: null,
    },
  ],
};

type PostRecord = Record<string, unknown> & {
  id: number;
  title: string;
  published: boolean;
  tenantId: string;
};

function matches(
  record: PostRecord,
  scope: Record<string, unknown>,
  filters: FieldFilters = {},
): boolean {
  if (!Object.entries(scope).every(([key, value]) => record[key] === value)) {
    return false;
  }
  return Object.entries(filters).every(([key, filter]) => {
    if ("equals" in filter) return record[key] === filter.equals;
    if ("in" in filter) return filter.in.includes(record[key] as never);
    const value = record[key];
    if (typeof value !== "number" && !(value instanceof Date)) return false;
    if (filter.gte !== undefined && value < filter.gte) return false;
    if (filter.lte !== undefined && value > filter.lte) return false;
    return true;
  });
}

function project(record: PostRecord, select: FieldSelect) {
  return Object.fromEntries(
    select.fields
      .filter((field) => field in record)
      .map((field) => [field, record[field]]),
  );
}

export class TransportMemoryAdapter implements DataAdapter {
  readonly client = this;
  private records: PostRecord[] = [];
  private nextId = 3;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.nextId = 3;
    this.records = [
      { id: 1, title: "First post", published: true, tenantId: "tenant-a" },
      { id: 2, title: "Second post", published: false, tenantId: "tenant-a" },
      { id: 99, title: "Other tenant", published: true, tenantId: "tenant-b" },
    ];
  }

  async introspect() {
    return new Map([[postMeta.name, structuredClone(postMeta)]]);
  }

  resource(meta: AdminModelMeta): ModelResource {
    if (meta.name !== "Post") throw new Error(`Unknown model ${meta.name}`);
    return {
      findMany: async (query) => {
        let rows = this.records.filter(
          (record) =>
            matches(record, query.scope, query.filters) &&
            (query.ids === undefined || query.ids.includes(record.id)) &&
            (!query.search ||
              query.search.fields.some((field) =>
                String(record[field] ?? "")
                  .toLowerCase()
                  .includes(query.search!.text.toLowerCase()),
              )),
        );
        if (query.sort) {
          const { field, direction } = query.sort;
          rows = [...rows].sort((left, right) => {
            const a = left[field];
            const b = right[field];
            if (a === b) return 0;
            const order = String(a) < String(b) ? -1 : 1;
            return direction === "asc" ? order : -order;
          });
        }
        return rows
          .slice(
            query.skip ?? 0,
            (query.skip ?? 0) + (query.take ?? rows.length),
          )
          .map((record) => project(record, query.select));
      },
      findFirst: async (query) => {
        const row = this.records.find(
          (record) => record.id === query.id && matches(record, query.scope),
        );
        return row ? project(row, query.select) : null;
      },
      count: async (query) =>
        this.records.filter((record) =>
          matches(record, query.scope, query.filters),
        ).length,
      create: async (query) => {
        if (query.data.title === "explode") {
          throw new Error("private adapter details");
        }
        const row = {
          id: this.nextId++,
          ...structuredClone(query.data),
        } as PostRecord;
        this.records.push(row);
        return project(row, query.select);
      },
      updateMany: async (query) => {
        const selected = this.records.filter(
          (record) =>
            matches(record, query.scope) &&
            (query.id !== undefined
              ? record.id === query.id
              : query.ids?.includes(record.id) === true),
        );
        selected.forEach((record) => Object.assign(record, query.data));
        return { count: selected.length };
      },
      deleteMany: async (query) => {
        const selected = new Set(
          this.records
            .filter(
              (record) =>
                matches(record, query.scope) &&
                (query.id !== undefined
                  ? record.id === query.id
                  : query.ids?.includes(record.id) === true),
            )
            .map((record) => record.id),
        );
        this.records = this.records.filter(
          (record) => !selected.has(record.id),
        );
        return { count: selected.size };
      },
    };
  }
}

function registerPost(admin: ReturnType<typeof createAdmin>): void {
  admin.register("Post", {
    listDisplay: ["title", "published"],
    listFilter: ["published"],
    searchFields: ["title"],
    defaultSort: { field: "id", direction: "asc" },
    perPage: 25,
    permissions: {
      list: ["ADMIN"],
      view: ["ADMIN"],
      create: ["ADMIN"],
      update: ["ADMIN"],
      delete: ["ADMIN"],
      actions: { announce: ["ADMIN"] },
    },
    scope: async (user) => ({ tenantId: user.tenantId ?? "__none__" }),
    actions: [
      {
        name: "announce",
        label: "Announce",
        allowedRoles: ["ADMIN"],
        handler: async ({ ids }) => ({ message: `Announced ${ids.length}.` }),
      },
    ],
  });
}

export async function createExternalHttpHarness(
  options: { basePath?: string; siteName?: string } = {},
): Promise<{ app: Express; adapter: TransportMemoryAdapter }> {
  const adapter = new TransportMemoryAdapter();
  const admin = createAdmin({
    adapter,
    basePath: options.basePath,
    siteName: options.siteName,
    auth: {
      getCurrentUser: async (request) => {
        const value = request.headers["x-test-auth"];
        if (value === "throw") throw new Error("private auth error");
        if (value === "malformed") return {} as AdminUser;
        return value === "admin" ? transportAdminUser : null;
      },
    },
  });
  registerPost(admin);
  const app = express();
  await mount(app, admin);
  return { app, adapter };
}

export class MemoryAuthStore implements AdminAuthStore {
  private sessions = new Map<string, BuiltInSessionRecord>();

  constructor(readonly user: BuiltInUserRecord) {}

  async findUserByIdentifier(identifier: string) {
    return this.user.email === identifier || this.user.username === identifier
      ? this.user
      : null;
  }

  async findSessionWithUser(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    return session && session.expiresAt > new Date() ? session : null;
  }

  async createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }) {
    this.sessions.set(input.tokenHash, {
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      user: this.user,
    });
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }
}

export async function createBuiltInHttpHarness(
  options: {
    basePath?: string;
    rateLimit?: false | { windowMs: number; maxAttempts: number };
    secureCookies?: boolean;
  } = {},
): Promise<{ app: Express; store: MemoryAuthStore }> {
  const adapter = new TransportMemoryAdapter();
  const store = new MemoryAuthStore({
    id: "built-in-admin",
    email: "built-in@paneljs.test",
    passwordHash: await hashAdminPassword("correct-password"),
    role: "ADMIN",
    isActive: true,
    tenantId: "tenant-a",
  });
  const admin = createAdmin({
    adapter,
    basePath: options.basePath,
    auth: {
      mode: "built-in",
      identifier: "email",
      store,
      secureCookies: options.secureCookies ?? false,
      loginRateLimit: options.rateLimit ?? false,
    },
  });
  registerPost(admin);
  const app = express();
  await mount(app, admin);
  return { app, store };
}
