import {
  defineAdapterContract,
  defineAdminBehaviorContract,
  defineAuthStoreContract,
} from "../src/index.js";
import { FakeAdapterEnvironment } from "./fakeAdapter.js";
import { FakeAdminBehaviorEnvironment } from "./fakeAdminBehavior.js";
import { FakeAuthStoreEnvironment } from "./fakeAuthStore.js";

defineAdapterContract({
  name: "in-memory demonstration",
  async create() {
    return new FakeAdapterEnvironment();
  },
});

defineAuthStoreContract({
  name: "in-memory demonstration",
  async create() {
    return new FakeAuthStoreEnvironment();
  },
});

defineAdminBehaviorContract({
  name: "in-memory demonstration",
  async create() {
    return new FakeAdminBehaviorEnvironment();
  },
});
