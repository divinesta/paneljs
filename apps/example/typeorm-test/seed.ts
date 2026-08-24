import { dataSource } from "./data-source.js";

const tenants = [
  { id: "example-tenant-northwind", name: "Northwind" },
  { id: "example-tenant-contoso", name: "Contoso" },
  { id: "example-tenant-fabrikam", name: "Fabrikam" },
] as const;
const names = [
  "Ada Lovelace",
  "Grace Hopper",
  "Linus Torvalds",
  "Margaret Hamilton",
  "Katherine Johnson",
  "Alan Turing",
  "Dorothy Vaughan",
  "Edsger Dijkstra",
  "Radia Perlman",
  "Annie Easley",
  "Donald Knuth",
  "Mary Jackson",
  "Barbara Liskov",
  "Hedy Lamarr",
  "Ken Thompson",
  "Frances Allen",
  "James Gosling",
  "Sophie Wilson",
  "Guido van Rossum",
  "Shafi Goldwasser",
  "Tim Berners-Lee",
  "Joan Clarke",
  "Fei-Fei Li",
  "Yukihiro Matsumoto",
];
const customerNames = [
  "Maya Okafor",
  "Ibrahim Bello",
  "Zainab Musa",
  "David Chen",
  "Sofia Alvarez",
  "Amara Diallo",
  "Noah Williams",
  "Chioma Eze",
  "Tariq Rahman",
  "Hannah Kim",
  "Luca Rossi",
  "Amina Yusuf",
  "Olivia Martin",
  "Samira Patel",
  "Kofi Mensah",
  "Ella Johnson",
  "Mateo Silva",
  "Nneka Obi",
  "Daniel Park",
  "Fatima Sule",
];
const categoryNames = [
  "Analytics",
  "Automation",
  "Collaboration",
  "Developer tools",
  "Finance",
  "Hardware",
  "Marketing",
  "Operations",
  "Security",
  "Support",
  "Training",
  "Workspace",
];
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const dateFor = (index: number) =>
  new Date(
    Date.UTC(
      2026,
      index % 8,
      (index % 27) + 1,
      9 + (index % 7),
      (index * 11) % 60,
    ),
  );

await dataSource.initialize();

try {
  const orderItems = dataSource.getRepository("OrderItem");
  const orders = dataSource.getRepository("Order");
  const posts = dataSource.getRepository("Post");
  const products = dataSource.getRepository("Product");
  const categories = dataSource.getRepository("Category");
  const customers = dataSource.getRepository("Customer");
  const users = dataSource.getRepository("User");
  const tenantRepo = dataSource.getRepository("Tenant");

  await orderItems.createQueryBuilder().delete().execute();
  await orders.createQueryBuilder().delete().execute();
  await posts.createQueryBuilder().delete().execute();
  await products.createQueryBuilder().delete().execute();
  await categories.createQueryBuilder().delete().execute();
  await customers.createQueryBuilder().delete().execute();
  await users.createQueryBuilder().delete().execute();
  await tenantRepo.createQueryBuilder().delete().execute();

  await tenantRepo.save(tenants);

  const seededUsers = await users.save(
    tenants.flatMap((tenant, tenantIndex) =>
      names.map((fullName, index) => {
        const fixedEmail =
          tenant.name === "Northwind" && index === 0
            ? "ada@example.test"
            : tenant.name === "Contoso" && index === 1
              ? "grace@example.test"
              : tenant.name === "Northwind" && index === 2
                ? "linus@example.test"
                : null;
        const role =
          tenant.name === "Northwind" && index === 2
            ? "SUPER_ADMIN"
            : index === 0 || (tenantIndex === 2 && index === 3)
              ? "ADMIN"
              : "USER";
        return {
          email:
            fixedEmail ?? `${slug(fullName)}.${slug(tenant.name)}@example.test`,
          fullName,
          role,
          isActive: index % 11 !== 0,
          tenantId: tenant.id,
          createdAt: dateFor(index + tenantIndex * names.length),
        };
      }),
    ),
  );

  const seededCustomers = await customers.save(
    tenants.flatMap((tenant, tenantIndex) =>
      customerNames.map((fullName, index) => ({
        email: `${slug(fullName)}.${slug(tenant.name)}.customer@example.test`,
        fullName,
        company: index % 3 === 0 ? `${fullName.split(" ")[0]} & Co.` : null,
        isActive: index % 9 !== 0,
        tenantId: tenant.id,
        createdAt: dateFor(index + 80 + tenantIndex * customerNames.length),
      })),
    ),
  );

  const seededCategories = await categories.save(
    tenants.flatMap((tenant) =>
      categoryNames.map((name) => ({
        name,
        description: `${name} catalog for ${tenant.name}.`,
        tenantId: tenant.id,
      })),
    ),
  );

  const seededProducts = await products.save(
    tenants.flatMap((tenant, tenantIndex) =>
      Array.from({ length: 40 }, (_, index) => {
        const category =
          seededCategories[
            tenantIndex * categoryNames.length + (index % categoryNames.length)
          ]!;
        return {
          sku: `${tenant.name.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(4, "0")}`,
          name: `${category.name} ${["Starter", "Standard", "Professional", "Team", "Enterprise"][index % 5]} ${Math.floor(index / 5) + 1}`,
          description: `Sample ${String(category.name).toLowerCase()} product ${index + 1} for realistic list, search, and filter testing.`,
          price: Number((19 + index * 7.35 + tenantIndex * 3).toFixed(2)),
          stock: (index * 13 + tenantIndex * 17) % 180,
          status:
            index % 13 === 0
              ? "ARCHIVED"
              : index % 5 === 0
                ? "DRAFT"
                : "ACTIVE",
          categoryId: category.id,
          tenantId: tenant.id,
          createdAt: dateFor(index + 200 + tenantIndex * 40),
        };
      }),
    ),
  );

  const seededPosts = await posts.save(
    tenants.flatMap((tenant, tenantIndex) =>
      Array.from({ length: 40 }, (_, index) => ({
        title: `${["Quarterly update", "Customer story", "Product note", "Release plan", "Team memo"][index % 5]} ${index + 1}`,
        content: `This is seeded post ${index + 1} for ${tenant.name}. It provides varied data for search, drafts, publications, and date filters.`,
        published: index % 4 !== 0,
        authorId:
          seededUsers[tenantIndex * names.length + (index % names.length)]!.id,
        tenantId: tenant.id,
        createdAt: dateFor(index + 400 + tenantIndex * 40),
      })),
    ),
  );

  let orderCount = 0;
  const seededOrderItems = [];
  for (const [tenantIndex, tenant] of tenants.entries()) {
    const tenantCustomers = seededCustomers.slice(
      tenantIndex * customerNames.length,
      (tenantIndex + 1) * customerNames.length,
    );
    const tenantUsers = seededUsers.slice(
      tenantIndex * names.length,
      (tenantIndex + 1) * names.length,
    );
    const tenantProducts = seededProducts.slice(
      tenantIndex * 40,
      (tenantIndex + 1) * 40,
    );
    for (let index = 0; index < 30; index += 1) {
      const chosenProducts = Array.from(
        { length: 2 + (index % 3) },
        (_, itemIndex) =>
          tenantProducts[(index * 3 + itemIndex * 7) % tenantProducts.length]!,
      );
      const itemData = chosenProducts.map((product, itemIndex) => ({
        productId: product.id,
        quantity: 1 + ((index + itemIndex) % 4),
        unitPrice: product.price,
      }));
      const total = itemData.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      );
      const order = await orders.save({
        reference: `${tenant.name.slice(0, 3).toUpperCase()}-2026-${String(index + 1).padStart(4, "0")}`,
        status: ["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"][
          index % 5
        ],
        total: Number(total.toFixed(2)),
        customerId: tenantCustomers[index % tenantCustomers.length]!.id,
        ownerId: tenantUsers[index % 4]!.id,
        tenantId: tenant.id,
        placedAt: dateFor(index + 520 + tenantIndex * 30),
      });
      seededOrderItems.push(
        ...itemData.map((item) => ({ ...item, orderId: order.id })),
      );
      orderCount += 1;
    }
  }
  await orderItems.save(seededOrderItems);

  console.log(
    `Seeded ${tenants.length} tenants, ${seededUsers.length} users, ${seededCustomers.length} customers, ${seededCategories.length} categories, ${seededProducts.length} products, ${seededPosts.length} posts, ${orderCount} orders, and ${seededOrderItems.length} order items.`,
  );
} finally {
  await dataSource.destroy();
}
