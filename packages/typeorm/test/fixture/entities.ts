import { EntitySchema } from "typeorm";

export type ContractRole = "USER" | "ADMIN";
export type ContractAdminRole = "ADMIN" | "SUPER_ADMIN";

export interface TenantFixture {
  id: string;
  name: string;
  users: UserFixture[];
  posts: PostFixture[];
  cascadeChildren: CascadeChildFixture[];
  nullableChildren: NullableChildFixture[];
  protectedChildren: ProtectedChildFixture[];
}

export interface UserFixture {
  id: string;
  email: string;
  fullName: string;
  role: ContractRole;
  isActive: boolean;
  tenantId: string;
  tenant: TenantFixture;
  posts: PostFixture[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PostFixture {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
  authorId: string;
  author: UserFixture;
  tenantId: string;
  tenant: TenantFixture;
  createdAt: Date;
  updatedAt: Date;
}

export interface CascadeChildFixture {
  id: string;
  label: string;
  tenantId: string;
  tenant: TenantFixture;
}

export interface NullableChildFixture {
  id: string;
  label: string;
  tenantId: string | null;
  tenant: TenantFixture | null;
}

export interface ProtectedChildFixture {
  id: string;
  label: string;
  tenantId: string;
  tenant: TenantFixture;
}

export interface ExpressAdminUserFixture {
  id: string;
  email: string | null;
  username: string | null;
  passwordHash: string;
  role: ContractAdminRole;
  isActive: boolean;
  tenantId: string | null;
  sessions: ExpressAdminSessionFixture[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpressAdminSessionFixture {
  id: string;
  tokenHash: string;
  userId: string;
  user: ExpressAdminUserFixture;
  expiresAt: Date;
  createdAt: Date;
}

export const TenantEntity = new EntitySchema<TenantFixture>({
  name: "Tenant",
  tableName: "contract_tenants",
  columns: {
    id: { type: "varchar", primary: true },
    name: { type: "varchar", unique: true },
  },
  relations: {
    users: { type: "one-to-many", target: "User", inverseSide: "tenant" },
    posts: { type: "one-to-many", target: "Post", inverseSide: "tenant" },
    cascadeChildren: {
      type: "one-to-many",
      target: "CascadeChild",
      inverseSide: "tenant",
    },
    nullableChildren: {
      type: "one-to-many",
      target: "NullableChild",
      inverseSide: "tenant",
    },
    protectedChildren: {
      type: "one-to-many",
      target: "ProtectedChild",
      inverseSide: "tenant",
    },
  },
});

export const UserEntity = new EntitySchema<UserFixture>({
  name: "User",
  tableName: "contract_users",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    email: { type: "varchar", unique: true },
    fullName: { type: "varchar" },
    role: { type: "enum", enum: ["USER", "ADMIN"], default: "USER" },
    isActive: { type: "boolean", default: true },
    tenantId: { type: "varchar" },
    createdAt: { type: "timestamptz", createDate: true },
    updatedAt: { type: "timestamptz", updateDate: true },
  },
  indices: [{ columns: ["tenantId"] }],
  relations: {
    tenant: {
      type: "many-to-one",
      target: "Tenant",
      inverseSide: "users",
      joinColumn: { name: "tenantId" },
      onDelete: "CASCADE",
    },
    posts: { type: "one-to-many", target: "Post", inverseSide: "author" },
  },
});

export const PostEntity = new EntitySchema<PostFixture>({
  name: "Post",
  tableName: "contract_posts",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    title: { type: "varchar" },
    content: { type: "text", nullable: true },
    published: { type: "boolean", default: false },
    authorId: { type: "uuid" },
    tenantId: { type: "varchar" },
    createdAt: { type: "timestamptz", createDate: true },
    updatedAt: { type: "timestamptz", updateDate: true },
  },
  indices: [{ columns: ["authorId"] }, { columns: ["tenantId"] }],
  relations: {
    author: {
      type: "many-to-one",
      target: "User",
      inverseSide: "posts",
      joinColumn: { name: "authorId" },
      onDelete: "RESTRICT",
    },
    tenant: {
      type: "many-to-one",
      target: "Tenant",
      inverseSide: "posts",
      joinColumn: { name: "tenantId" },
      onDelete: "CASCADE",
    },
  },
});

export const CascadeChildEntity = new EntitySchema<CascadeChildFixture>({
  name: "CascadeChild",
  tableName: "contract_cascade_children",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    label: { type: "varchar" },
    tenantId: { type: "varchar" },
  },
  indices: [{ columns: ["tenantId"] }],
  relations: {
    tenant: {
      type: "many-to-one",
      target: "Tenant",
      inverseSide: "cascadeChildren",
      joinColumn: { name: "tenantId" },
      onDelete: "CASCADE",
    },
  },
});

export const NullableChildEntity = new EntitySchema<NullableChildFixture>({
  name: "NullableChild",
  tableName: "contract_nullable_children",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    label: { type: "varchar" },
    tenantId: { type: "varchar", nullable: true },
  },
  indices: [{ columns: ["tenantId"] }],
  relations: {
    tenant: {
      type: "many-to-one",
      target: "Tenant",
      inverseSide: "nullableChildren",
      joinColumn: { name: "tenantId" },
      nullable: true,
      onDelete: "SET NULL",
    },
  },
});

export const ProtectedChildEntity = new EntitySchema<ProtectedChildFixture>({
  name: "ProtectedChild",
  tableName: "contract_protected_children",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    label: { type: "varchar" },
    tenantId: { type: "varchar" },
  },
  indices: [{ columns: ["tenantId"] }],
  relations: {
    tenant: {
      type: "many-to-one",
      target: "Tenant",
      inverseSide: "protectedChildren",
      joinColumn: { name: "tenantId" },
      onDelete: "RESTRICT",
    },
  },
});

export const ExpressAdminUserEntity = new EntitySchema<ExpressAdminUserFixture>(
  {
    name: "ExpressAdminUser",
    tableName: "contract_admin_users",
    columns: {
      id: { type: "uuid", primary: true, generated: "uuid" },
      email: { type: "varchar", nullable: true, unique: true },
      username: { type: "varchar", nullable: true, unique: true },
      passwordHash: { type: "varchar" },
      role: {
        type: "enum",
        enum: ["ADMIN", "SUPER_ADMIN"],
        default: "ADMIN",
      },
      isActive: { type: "boolean", default: true },
      tenantId: { type: "varchar", nullable: true },
      createdAt: { type: "timestamptz", createDate: true },
      updatedAt: { type: "timestamptz", updateDate: true },
    },
    relations: {
      sessions: {
        type: "one-to-many",
        target: "ExpressAdminSession",
        inverseSide: "user",
      },
    },
  },
);

export const ExpressAdminSessionEntity =
  new EntitySchema<ExpressAdminSessionFixture>({
    name: "ExpressAdminSession",
    tableName: "contract_admin_sessions",
    columns: {
      id: { type: "uuid", primary: true, generated: "uuid" },
      tokenHash: { type: "varchar", unique: true },
      userId: { type: "uuid" },
      expiresAt: { type: "timestamptz" },
      createdAt: { type: "timestamptz", createDate: true },
    },
    indices: [{ columns: ["userId"] }, { columns: ["expiresAt"] }],
    relations: {
      user: {
        type: "many-to-one",
        target: "ExpressAdminUser",
        inverseSide: "sessions",
        joinColumn: { name: "userId" },
        onDelete: "CASCADE",
      },
    },
  });

export const contractEntities = [
  TenantEntity,
  UserEntity,
  PostEntity,
  CascadeChildEntity,
  NullableChildEntity,
  ProtectedChildEntity,
  ExpressAdminUserEntity,
  ExpressAdminSessionEntity,
] as const;
