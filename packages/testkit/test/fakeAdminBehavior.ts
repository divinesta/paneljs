import {
  PermissionDeniedError,
  RecordNotFoundError,
  RequestValidationError,
  applyCreateScope,
  type AdminUser,
  type PaginatedResponse,
} from "paneljs";

import type {
  AdminBehaviorDriver,
  AdminBehaviorEnvironment,
  AdminBehaviorSeed,
  AdminListInput,
  ContractId,
} from "../src/index.js";

type Post = Record<string, unknown> & {
  id: ContractId;
  title: string;
  tenantId: ContractId;
};

export class FakeAdminBehaviorEnvironment implements AdminBehaviorEnvironment {
  private posts: Post[] = [];
  private nextId = 1;

  readonly driver: AdminBehaviorDriver = {
    listPosts: (input) => this.listPosts(input),
    getPost: (adminUser, id) => this.getPost(adminUser, id),
    createPost: (adminUser, data) => this.createPost(adminUser, data),
    updatePost: (adminUser, id, data) => this.updatePost(adminUser, id, data),
    deletePost: (adminUser, id) => this.deletePost(adminUser, id),
    deletePosts: (adminUser, ids) => this.deletePosts(adminUser, ids),
  };

  async reset(): Promise<AdminBehaviorSeed> {
    const seed: AdminBehaviorSeed = {
      tenantA: "tenant-a",
      tenantB: "tenant-b",
      userA: "user-a",
      userB: "user-b",
      postA1: "post-a-1",
      postA2: "post-a-2",
      postB1: "post-b-1",
    };
    this.nextId = 1;
    this.posts = [
      {
        id: seed.postA1,
        title: "Quarterly Report",
        content: "Tenant A quarterly numbers",
        published: true,
        authorId: seed.userA,
        tenantId: seed.tenantA,
      },
      {
        id: seed.postA2,
        title: "Launch Notes",
        content: null,
        published: false,
        authorId: seed.userA,
        tenantId: seed.tenantA,
      },
      {
        id: seed.postB1,
        title: "Quarterly Secret",
        content: "Tenant B private numbers",
        published: true,
        authorId: seed.userB,
        tenantId: seed.tenantB,
      },
    ];
    return seed;
  }

  async readPost(id: ContractId): Promise<Post | null> {
    const post = this.posts.find((candidate) => candidate.id === id);
    return post ? structuredClone(post) : null;
  }

  async dispose(): Promise<void> {}

  private scope(adminUser: AdminUser): Record<string, unknown> {
    return adminUser.isSuperAdmin ? {} : { tenantId: adminUser.tenantId };
  }

  private canWrite(adminUser: AdminUser): boolean {
    return adminUser.isSuperAdmin || adminUser.role === "ADMIN";
  }

  private scopedPosts(adminUser: AdminUser): Post[] {
    const scope = this.scope(adminUser);
    return this.posts.filter((post) =>
      Object.entries(scope).every(([name, value]) => post[name] === value),
    );
  }

  private requireWrite(adminUser: AdminUser): void {
    if (!this.canWrite(adminUser)) throw new PermissionDeniedError();
  }

  private findScoped(adminUser: AdminUser, id: ContractId): Post {
    const post = this.scopedPosts(adminUser).find(
      (candidate) => candidate.id === id,
    );
    if (!post) throw new RecordNotFoundError();
    return post;
  }

  private async listPosts(
    input: AdminListInput,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    let records = this.scopedPosts(input.adminUser);
    if (input.search) {
      const search = input.search.toLowerCase();
      records = records.filter((post) =>
        post.title.toLowerCase().includes(search),
      );
    }
    const total = records.length;
    const start = (input.page - 1) * input.perPage;
    return {
      records: structuredClone(records.slice(start, start + input.perPage)),
      total,
      page: input.page,
      perPage: input.perPage,
      totalPages: Math.ceil(total / input.perPage),
    };
  }

  private async getPost(adminUser: AdminUser, id: ContractId): Promise<Post> {
    return structuredClone(this.findScoped(adminUser, id));
  }

  private async createPost(
    adminUser: AdminUser,
    data: Record<string, unknown>,
  ): Promise<Post> {
    this.requireWrite(adminUser);
    const scopedData = applyCreateScope(data, this.scope(adminUser));
    const post = {
      id: `post-generated-${this.nextId++}`,
      ...structuredClone(scopedData),
    } as Post;
    this.posts.push(post);
    return structuredClone(post);
  }

  private async updatePost(
    adminUser: AdminUser,
    id: ContractId,
    data: Record<string, unknown>,
  ): Promise<Post> {
    this.requireWrite(adminUser);
    const post = this.findScoped(adminUser, id);
    if (data.tenantId !== undefined) {
      throw new RequestValidationError(
        'Field "tenantId" is controlled by the configured scope and cannot be updated through the admin.',
      );
    }
    Object.assign(post, structuredClone(data));
    return structuredClone(post);
  }

  private async deletePost(
    adminUser: AdminUser,
    id: ContractId,
  ): Promise<void> {
    this.requireWrite(adminUser);
    const post = this.findScoped(adminUser, id);
    this.posts = this.posts.filter((candidate) => candidate !== post);
  }

  private async deletePosts(
    adminUser: AdminUser,
    ids: ContractId[],
  ): Promise<ContractId[]> {
    this.requireWrite(adminUser);
    const scoped = new Map(
      this.scopedPosts(adminUser).map((post) => [post.id, post]),
    );
    if (ids.some((id) => !scoped.has(id))) {
      throw new RequestValidationError(
        "One or more selected records are unavailable.",
      );
    }
    const selected = new Set(ids);
    this.posts = this.posts.filter((post) => !selected.has(post.id));
    return [...ids];
  }
}
