import type {
  AdminFieldMeta,
  AdminModelMeta,
  CountQuery,
  CreateQuery,
  DataAdapter,
  DeleteManyQuery,
  FieldSelect,
  FindFirstQuery,
  FindManyQuery,
  ModelResource,
  UpdateManyQuery,
} from "paneljs";

import type {
  AdapterContractEnvironment,
  AdapterContractSeed,
  ContractId,
} from "../src/index.js";

function field(
  name: string,
  overrides: Partial<AdminFieldMeta> = {},
): AdminFieldMeta {
  return {
    name,
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
    ...overrides,
  };
}

const tenantMeta: AdminModelMeta = {
  name: "Tenant",
  pluralName: "tenants",
  clientKey: "tenant",
  idField: "id",
  displayField: "name",
  searchableFields: ["name"],
  filterableFields: [],
  timestamps: {},
  fields: [
    field("id", {
      isId: true,
      isUnique: true,
      isReadOnly: true,
      isSearchable: false,
      defaultValue: { name: "generated" },
    }),
    field("name", { isUnique: true }),
    field("users", {
      type: "relation",
      nativeType: "User",
      isRequired: false,
      isReadOnly: true,
      isList: true,
      isSearchable: false,
      relation: {
        model: "User",
        kind: "hasMany",
        relationName: "TenantUsers",
        foreignKeyFields: [],
        displayField: "email",
      },
    }),
  ],
};

const userMeta: AdminModelMeta = {
  name: "User",
  pluralName: "users",
  clientKey: "user",
  idField: "id",
  displayField: "email",
  searchableFields: ["email", "fullName"],
  filterableFields: ["role", "isActive", "tenantId", "createdAt"],
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  fields: [
    field("id", {
      isId: true,
      isUnique: true,
      isReadOnly: true,
      isSearchable: false,
      defaultValue: { name: "generated" },
    }),
    field("email", { isUnique: true }),
    field("fullName"),
    field("role", {
      type: "enum",
      nativeType: "Role",
      enumValues: ["USER", "ADMIN"],
      isFilterable: true,
      isSearchable: false,
      defaultValue: "USER",
    }),
    field("isActive", {
      type: "boolean",
      nativeType: "Boolean",
      isFilterable: true,
      isSearchable: false,
      defaultValue: true,
    }),
    field("tenantId", { isFilterable: true, isSearchable: false }),
    field("createdAt", {
      type: "datetime",
      nativeType: "DateTime",
      isReadOnly: true,
      isFilterable: true,
      isSearchable: false,
      defaultValue: { name: "now" },
    }),
    field("updatedAt", {
      type: "datetime",
      nativeType: "DateTime",
      isReadOnly: true,
      isSearchable: false,
      defaultValue: { name: "updatedAt" },
    }),
    field("tenant", {
      type: "relation",
      nativeType: "Tenant",
      isReadOnly: true,
      isSearchable: false,
      relation: {
        model: "Tenant",
        kind: "belongsTo",
        relationName: "TenantUsers",
        foreignKeyFields: ["tenantId"],
        onDelete: "Cascade",
        displayField: "name",
      },
    }),
    field("posts", {
      type: "relation",
      nativeType: "Post",
      isRequired: false,
      isReadOnly: true,
      isList: true,
      isSearchable: false,
      relation: {
        model: "Post",
        kind: "hasMany",
        relationName: "UserPosts",
        foreignKeyFields: [],
        displayField: "title",
      },
    }),
  ],
};

const postMeta: AdminModelMeta = {
  name: "Post",
  pluralName: "posts",
  clientKey: "post",
  idField: "id",
  displayField: "title",
  searchableFields: ["title", "content"],
  filterableFields: ["published", "tenantId", "createdAt"],
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  fields: [
    field("id", {
      isId: true,
      isUnique: true,
      isReadOnly: true,
      isSearchable: false,
      defaultValue: { name: "generated" },
    }),
    field("title"),
    field("content", { isRequired: false }),
    field("published", {
      type: "boolean",
      nativeType: "Boolean",
      isFilterable: true,
      isSearchable: false,
      defaultValue: false,
    }),
    field("authorId", { isSearchable: false }),
    field("tenantId", { isFilterable: true, isSearchable: false }),
    field("createdAt", {
      type: "datetime",
      nativeType: "DateTime",
      isReadOnly: true,
      isFilterable: true,
      isSearchable: false,
      defaultValue: { name: "now" },
    }),
    field("updatedAt", {
      type: "datetime",
      nativeType: "DateTime",
      isReadOnly: true,
      isSearchable: false,
      defaultValue: { name: "updatedAt" },
    }),
    field("author", {
      type: "relation",
      nativeType: "User",
      isReadOnly: true,
      isSearchable: false,
      relation: {
        model: "User",
        kind: "belongsTo",
        relationName: "UserPosts",
        foreignKeyFields: ["authorId"],
        onDelete: "Restrict",
        displayField: "email",
      },
    }),
    field("tenant", {
      type: "relation",
      nativeType: "Tenant",
      isReadOnly: true,
      isSearchable: false,
      relation: {
        model: "Tenant",
        kind: "belongsTo",
        relationName: "TenantPosts",
        foreignKeyFields: ["tenantId"],
        onDelete: "Cascade",
        displayField: "name",
      },
    }),
  ],
};

const metadata = new Map([
  [tenantMeta.name, tenantMeta],
  [userMeta.name, userMeta],
  [postMeta.name, postMeta],
]);

type Row = Record<string, unknown>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class FakeAdapterEnvironment implements AdapterContractEnvironment {
  private rows = new Map<string, Row[]>();
  private nextId = 1;

  readonly adapter: DataAdapter = {
    client: this,
    introspect: async () => metadata,
    resource: (meta) => this.resource(meta),
  };

  async reset(): Promise<AdapterContractSeed> {
    const seed: AdapterContractSeed = {
      tenantA: "tenant-a",
      tenantB: "tenant-b",
      userA: "user-a",
      userB: "user-b",
      postA1: "post-a-1",
      postA2: "post-a-2",
      postB1: "post-b-1",
    };
    const createdAt = new Date("2026-08-01T00:00:00.000Z");
    const updatedAt = new Date("2026-08-02T00:00:00.000Z");
    this.nextId = 1;
    this.rows = new Map([
      [
        "Tenant",
        [
          { id: seed.tenantA, name: "Tenant A" },
          { id: seed.tenantB, name: "Tenant B" },
        ],
      ],
      [
        "User",
        [
          {
            id: seed.userA,
            email: "ada@paneljs.test",
            fullName: "Ada Lovelace",
            role: "ADMIN",
            isActive: true,
            tenantId: seed.tenantA,
            createdAt,
            updatedAt,
          },
          {
            id: seed.userB,
            email: "grace@paneljs.test",
            fullName: "Grace Hopper",
            role: "ADMIN",
            isActive: true,
            tenantId: seed.tenantB,
            createdAt,
            updatedAt,
          },
        ],
      ],
      [
        "Post",
        [
          {
            id: seed.postA1,
            title: "Quarterly Report",
            content: "Tenant A quarterly numbers",
            published: true,
            authorId: seed.userA,
            tenantId: seed.tenantA,
            createdAt,
            updatedAt,
          },
          {
            id: seed.postA2,
            title: "Launch Notes",
            content: null,
            published: false,
            authorId: seed.userA,
            tenantId: seed.tenantA,
            createdAt: new Date("2026-08-03T00:00:00.000Z"),
            updatedAt,
          },
          {
            id: seed.postB1,
            title: "Quarterly Secret",
            content: "Tenant B private numbers",
            published: true,
            authorId: seed.userB,
            tenantId: seed.tenantB,
            createdAt,
            updatedAt,
          },
        ],
      ],
    ]);
    return seed;
  }

  async readRecord(modelName: string, id: ContractId): Promise<Row | null> {
    const row = this.table(modelName).find((candidate) => candidate.id === id);
    return row ? clone(row) : null;
  }

  async dispose(): Promise<void> {}

  private table(modelName: string): Row[] {
    const rows = this.rows.get(modelName);
    if (!rows) throw new Error(`Unknown fake model ${modelName}`);
    return rows;
  }

  private matches(
    row: Row,
    query:
      | FindManyQuery
      | CountQuery
      | FindFirstQuery
      | UpdateManyQuery
      | DeleteManyQuery,
  ): boolean {
    for (const [name, value] of Object.entries(query.scope)) {
      if (row[name] !== value) return false;
    }
    if ("id" in query && query.id !== undefined && row.id !== query.id)
      return false;
    if (
      "ids" in query &&
      query.ids !== undefined &&
      !query.ids.includes(row.id as ContractId)
    )
      return false;
    if ("filters" in query) {
      for (const [name, filter] of Object.entries(query.filters)) {
        const value = row[name];
        if ("equals" in filter && value !== filter.equals) return false;
        if ("in" in filter && !filter.in.includes(value as string | number))
          return false;
        if (
          "gte" in filter &&
          filter.gte !== undefined &&
          (value as Date | number) < filter.gte
        )
          return false;
        if (
          "lte" in filter &&
          filter.lte !== undefined &&
          (value as Date | number) > filter.lte
        )
          return false;
      }
    }
    if ("search" in query && query.search) {
      const text = query.search.text.toLowerCase();
      if (
        !query.search.fields.some((name) =>
          String(row[name] ?? "")
            .toLowerCase()
            .includes(text),
        )
      )
        return false;
    }
    return true;
  }

  private relationValue(row: Row, relationField: string): Row | null {
    if (relationField === "tenant") {
      return (
        this.table("Tenant").find(
          (candidate) => candidate.id === row.tenantId,
        ) ?? null
      );
    }
    if (relationField === "author") {
      return (
        this.table("User").find((candidate) => candidate.id === row.authorId) ??
        null
      );
    }
    return null;
  }

  private project(row: Row, select: FieldSelect): Row {
    const result: Row = {};
    for (const name of select.fields) {
      if (name in row) result[name] = clone(row[name]);
    }
    for (const relation of select.relations) {
      const related = this.relationValue(row, relation.field);
      result[relation.field] = related
        ? { [relation.displayField]: clone(related[relation.displayField]) }
        : null;
    }
    return result;
  }

  private resource(meta: AdminModelMeta): ModelResource {
    return {
      findMany: async (query) => {
        let rows = this.table(meta.name).filter((row) =>
          this.matches(row, query),
        );
        if (query.sort) {
          const { field: sortField, direction } = query.sort;
          rows = [...rows].sort((left, right) => {
            const result = String(left[sortField]).localeCompare(
              String(right[sortField]),
            );
            return direction === "asc" ? result : -result;
          });
        }
        if (query.skip !== undefined) rows = rows.slice(query.skip);
        if (query.take !== undefined) rows = rows.slice(0, query.take);
        return rows.map((row) => this.project(row, query.select));
      },
      findFirst: async (query) => {
        const row = this.table(meta.name).find((candidate) =>
          this.matches(candidate, query),
        );
        return row ? this.project(row, query.select) : null;
      },
      count: async (query) =>
        this.table(meta.name).filter((row) => this.matches(row, query)).length,
      create: async (query: CreateQuery) => {
        const now = new Date("2026-08-22T00:00:00.000Z");
        const row = {
          id: `${meta.clientKey}-generated-${this.nextId++}`,
          createdAt: now,
          updatedAt: now,
          ...clone(query.data),
        };
        this.table(meta.name).push(row);
        return this.project(row, query.select);
      },
      updateMany: async (query: UpdateManyQuery) => {
        this.assertTarget(query);
        let count = 0;
        for (const row of this.table(meta.name)) {
          if (!this.matches(row, query)) continue;
          Object.assign(row, clone(query.data));
          count += 1;
        }
        return { count };
      },
      deleteMany: async (query: DeleteManyQuery) => {
        this.assertTarget(query);
        const rows = this.table(meta.name);
        const kept = rows.filter((row) => !this.matches(row, query));
        const count = rows.length - kept.length;
        this.rows.set(meta.name, kept);
        return { count };
      },
    };
  }

  private assertTarget(query: { id?: ContractId; ids?: ContractId[] }): void {
    if (query.id === undefined && query.ids === undefined) {
      throw new Error("A fake update/delete requires id or ids");
    }
  }
}
