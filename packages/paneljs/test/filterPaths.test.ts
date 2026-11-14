import { describe, expect, it } from "vitest";

import {
  AdminRegistry,
  buildSchemaResponse,
  resolveFilter,
  resolveSearchFields,
  type AdminModelMeta,
  type FilterNode,
  type FullRegisteredModel,
  type ModelConfig,
  resolveSort,
  withIdTiebreaker,
} from "../src/index.js";
import { adminUser, field, tenantMeta, userMeta } from "./fixtures.js";

// User ─belongsTo→ Tenant ─hasMany→ User, and Post ─belongsTo→ User.
const tenantWithUsers: AdminModelMeta = {
  ...tenantMeta,
  fields: [
    ...tenantMeta.fields,
    field("users", {
      type: "relation",
      nativeType: "User",
      isList: true,
      isReadOnly: true,
      relation: {
        model: "User",
        kind: "hasMany",
        relationName: "TenantToUser",
        foreignKeyFields: [],
        displayField: "email",
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
  searchableFields: ["title"],
  filterableFields: ["authorId"],
  timestamps: {},
  fields: [
    field("id", { isId: true, isUnique: true, isReadOnly: true }),
    field("title"),
    field("views", { type: "number", nativeType: "Int" }),
    field("authorId", { isReadOnly: true }),
    field("author", {
      type: "relation",
      nativeType: "User",
      isReadOnly: true,
      relation: {
        model: "User",
        kind: "belongsTo",
        relationName: "UserToPost",
        foreignKeyFields: ["authorId"],
        displayField: "email",
      },
    }),
  ],
};

async function setup(configs: Partial<Record<string, ModelConfig>> = {}) {
  const registry = new AdminRegistry();
  for (const name of ["User", "Tenant", "Post"])
    registry.register(name, configs[name] ?? {});
  await registry.initialize(
    new Map([
      ["User", userMeta],
      ["Tenant", tenantWithUsers],
      ["Post", postMeta],
    ]),
  );
  const models = new Map(
    registry.getAll().map((model) => [model.meta.name, model]),
  );
  return { registry, models, post: models.get("Post") as FullRegisteredModel };
}

describe("filter paths", () => {
  it("annotates each relation crossed, and whether it is a list", async () => {
    const { models, post } = await setup();
    expect(
      resolveFilter(
        {
          path: ["author", "tenant", "users", "email"],
          op: "contains",
          value: "ada",
        },
        post,
        models,
      ),
    ).toEqual({
      kind: "condition",
      relations: [
        { field: "author", many: false },
        { field: "tenant", many: false },
        { field: "users", many: true },
      ],
      field: "email",
      target: "scalar",
      op: "contains",
      value: "ada",
    });
  });

  it("supports and, or, not and isNull on a relation", async () => {
    const { models, post } = await setup();
    const filter: FilterNode = {
      or: [
        { not: { path: ["views"], op: "gt", value: "10" } },
        { path: ["author"], op: "isNull", value: true },
      ],
    };
    expect(resolveFilter(filter, post, models)).toEqual({
      kind: "or",
      nodes: [
        {
          kind: "not",
          node: expect.objectContaining({
            field: "views",
            op: "gt",
            value: 10,
          }),
        },
        expect.objectContaining({
          field: "author",
          target: "toOne",
          op: "isNull",
          value: true,
        }),
      ],
    });
  });

  it("resolves some/every/none relative to the related model", async () => {
    const { models } = await setup();
    const tenant = models.get("Tenant")!;
    expect(
      resolveFilter(
        {
          path: ["users"],
          quantifier: "every",
          where: { path: ["isActive"], op: "equals", value: true },
        },
        tenant,
        models,
      ),
    ).toEqual({
      kind: "relation",
      relations: [],
      field: "users",
      quantifier: "every",
      where: expect.objectContaining({ field: "isActive", value: true }),
    });
  });

  it.each([
    [
      { path: ["author", "missing"], op: "equals", value: "x" },
      "is not a field on User",
    ],
    [
      { path: ["title", "length"], op: "equals", value: "x" },
      "is not a relation",
    ],
    [
      { path: ["author", "passwordHash"], op: "equals", value: "x" },
      "is not a field on User",
    ],
    [
      {
        path: ["author", "tenant", "users", "tenant", "name"],
        op: "equals",
        value: "x",
      },
      "more than 3 relations",
    ],
    [{ path: ["title"], op: "gt", value: "x" }, 'does not support "gt"'],
    [{ path: ["title"], op: "equals", value: null }, 'Use "isNull"'],
    [
      { path: ["author"], quantifier: "some", where: { and: [] } },
      "must end at a list relation",
    ],
    [{ path: ["title"], op: "between", value: 1 }, "unknown operator"],
  ] as Array<[FilterNode, string]>)(
    "rejects an invalid filter %#",
    async (filter, message) => {
      const { models, post } = await setup();
      expect(() => resolveFilter(filter, post, models)).toThrow(message);
    },
  );

  it("rejects paths through a model the administrator can't list", async () => {
    const { models, post } = await setup({
      User: { permissions: { list: ["SUPER_ADMIN"] } },
    });
    const filter: FilterNode = {
      path: ["author", "email"],
      op: "equals",
      value: "x",
    };
    expect(() => resolveFilter(filter, post, models, adminUser)).toThrow(
      "is not available",
    );
    // Without an administrator (trusted server code) the path is allowed.
    expect(() => resolveFilter(filter, post, models)).not.toThrow();
  });

  it("caps the number of conditions", async () => {
    const { models, post } = await setup();
    const many: FilterNode = {
      and: Array.from({ length: 51 }, () => ({
        path: ["title"],
        op: "equals" as const,
        value: "x",
      })),
    };
    expect(() => resolveFilter(many, post, models)).toThrow("at most 50");
  });
});

describe("search fields across relations", () => {
  it("resolves relation paths and drops ones the administrator can't use", async () => {
    const { models, post } = await setup({
      Post: {
        searchFields: ["title", "^author__email", "author__tenant__name"],
      },
      Tenant: { permissions: { list: ["SUPER_ADMIN"] } },
    });
    expect(
      resolveSearchFields(post, post.resolved.searchFields, models, adminUser),
    ).toEqual([
      { relations: [], field: "title", mode: "contains" },
      {
        relations: [{ field: "author", many: false }],
        field: "email",
        mode: "startsWith",
      },
    ]);
  });
});

describe("startup validation of paths", () => {
  it.each([
    [{ listFilter: ["author__missing"] }, "is invalid"],
    [{ listFilter: ["author"] }, "cannot be used as a filter"],
    [{ searchFields: ["author__isActive"] }, "not a String field"],
  ] as Array<[ModelConfig, string]>)(
    "rejects bad config %#",
    async (config, message) => {
      await expect(setup({ Post: config })).rejects.toThrow(message);
    },
  );

  it("accepts relation paths", async () => {
    const { post } = await setup({
      Post: {
        listFilter: ["author__role", "author__email"],
        searchFields: ["=author__email"],
      },
    });
    expect(post.resolved.listFilter).toEqual(["author__role", "author__email"]);
  });
});

describe("schema for path filters", () => {
  it("sends the end field of each usable filter path, per administrator", async () => {
    const { registry } = await setup({
      Post: {
        listFilter: ["authorId", "author__role", "author__tenant__name"],
        searchFields: ["title", "^author__tenant__name"],
      },
      Tenant: { permissions: { list: ["SUPER_ADMIN"] } },
    });
    const schema = buildSchemaResponse(registry, {
      adminUser,
      siteName: "PanelJS",
      basePath: "/admin",
      authMode: "external",
    });
    const post = schema.models.find((model) => model.meta.name === "Post")!;

    // The Tenant hop is dropped: this administrator can't list tenants.
    expect(post.config.listFilter).toEqual(["authorId", "author__role"]);
    expect(post.config.filterFields).toEqual([
      { key: "authorId", field: expect.objectContaining({ name: "authorId" }) },
      {
        key: "author__role",
        field: expect.objectContaining({ name: "role", type: "enum" }),
      },
    ]);
    expect(post.config.searchFields).toEqual(["title"]);
  });
});

describe("sorting through relations", () => {
  it("resolves own fields and single-record relation paths", async () => {
    const { models, post } = await setup();
    expect(
      resolveSort(
        [
          { field: "views", direction: "desc" },
          { field: "author__tenant__name", direction: "asc" },
        ],
        post,
        models,
      ),
    ).toEqual([
      { relations: [], field: "views", direction: "desc" },
      {
        relations: [
          { field: "author", many: false },
          { field: "tenant", many: false },
        ],
        field: "name",
        direction: "asc",
      },
    ]);
  });

  it.each([
    ["author__tenant__users__email", "list relation"],
    ["author", "cannot be used for sorting"],
    ["author__passwordHash", "is not a field on User"],
    ["author__missing", "is not a field on User"],
  ])("rejects %s", async (field, message) => {
    const { models, post } = await setup();
    expect(() =>
      resolveSort([{ field, direction: "asc" }], post, models),
    ).toThrow(message);
  });

  it("rejects duplicates, too many keys and forbidden models", async () => {
    const { models, post } = await setup({
      User: { permissions: { list: ["SUPER_ADMIN"] } },
    });
    expect(() =>
      resolveSort(
        [
          { field: "title", direction: "asc" },
          { field: "title", direction: "desc" },
        ],
        post,
        models,
      ),
    ).toThrow("more than once");
    expect(() =>
      resolveSort(
        [
          "id",
          "title",
          "views",
          "authorId",
          "author__email",
          "author__role",
        ].map((field) => ({ field, direction: "asc" as const })),
        post,
        models,
      ),
    ).toThrow("at most 5");
    expect(() =>
      resolveSort(
        [{ field: "author__email", direction: "asc" }],
        post,
        models,
        {
          adminUser,
        },
      ),
    ).toThrow("is not available");
  });

  it("adds the id last, in the last column's direction, unless present", () => {
    const title = { relations: [], field: "title", direction: "asc" as const };
    expect(withIdTiebreaker([title], "id")).toEqual([
      title,
      { relations: [], field: "id", direction: "asc" },
    ]);
    expect(withIdTiebreaker([], "id")).toEqual([
      { relations: [], field: "id", direction: "desc" },
    ]);
    const byId = { relations: [], field: "id", direction: "desc" as const };
    expect(withIdTiebreaker([byId, title], "id")).toEqual([byId, title]);
  });
});

describe("schema for sorting", () => {
  it("offers each column's sort key the administrator can use", async () => {
    const { registry } = await setup({
      Post: {
        listDisplay: ["title", "author", "views"],
        defaultSort: ["-views", "author__email"],
      },
    });
    const schemaFor = (user: typeof adminUser) =>
      buildSchemaResponse(registry, {
        adminUser: user,
        siteName: "PanelJS",
        basePath: "/admin",
        authMode: "external",
      }).models.find((model) => model.meta.name === "Post")!.config;

    expect(schemaFor(adminUser)).toMatchObject({
      sortKeys: { title: "title", author: "author__email", views: "views" },
      defaultSort: [
        { field: "views", direction: "desc" },
        { field: "author__email", direction: "asc" },
      ],
    });
  });

  it("drops relation columns through a model the administrator can't list", async () => {
    const { registry } = await setup({
      Post: { listDisplay: ["title", "author"], defaultSort: "author__email" },
      User: { permissions: { list: ["SUPER_ADMIN"] } },
    });
    const config = buildSchemaResponse(registry, {
      adminUser,
      siteName: "PanelJS",
      basePath: "/admin",
      authMode: "external",
    }).models.find((model) => model.meta.name === "Post")!.config;
    expect(config.sortKeys).toEqual({ title: "title" });
    expect(config.defaultSort).toEqual([]);
  });
});
