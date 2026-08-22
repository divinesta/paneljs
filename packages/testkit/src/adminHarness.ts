import {
  AdminRegistry,
  AdminService,
  type DataAdapter,
  type FullRegisteredModel,
  type ModelConfig,
} from "paneljs";

export type ContractAdminService = {
  service: AdminService;
  models: Map<string, FullRegisteredModel>;
  postModel: FullRegisteredModel;
};

const permissions: NonNullable<ModelConfig["permissions"]> = {
  list: ["ADMIN", "VIEWER"],
  view: ["ADMIN", "VIEWER"],
  create: ["ADMIN"],
  update: ["ADMIN"],
  delete: ["ADMIN"],
};

async function tenantScope(
  adminUser: Parameters<NonNullable<ModelConfig["scope"]>>[0],
) {
  return adminUser.isSuperAdmin
    ? {}
    : { tenantId: adminUser.tenantId ?? "__no_tenant__" };
}

/** Build the canonical real AdminService configuration for any adapter. */
export async function createContractAdminService(
  adapter: DataAdapter,
): Promise<ContractAdminService> {
  const registry = new AdminRegistry();
  registry.register("Tenant", {
    permissions,
    scope: async (adminUser) =>
      adminUser.isSuperAdmin
        ? {}
        : { id: adminUser.tenantId ?? "__no_tenant__" },
  });
  registry.register("User", { permissions, scope: tenantScope });
  registry.register("Post", {
    permissions,
    scope: tenantScope,
    listDisplay: ["title", "published", "tenantId"],
    searchFields: ["title", "content"],
    defaultSort: { field: "id", direction: "asc" },
    perPage: 50,
  });
  for (const modelName of ["CascadeChild", "NullableChild", "ProtectedChild"]) {
    registry.register(modelName, { permissions, scope: tenantScope });
  }
  await registry.initialize(await adapter.introspect());

  const models = new Map(
    registry.getAll().map((model) => [model.meta.name, model]),
  );
  const postModel = registry.get("Post");
  if (!postModel) throw new Error("Canonical Post model was not registered.");

  return {
    service: new AdminService({ models, adapter }),
    models,
    postModel,
  };
}
