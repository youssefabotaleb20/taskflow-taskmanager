import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";

beforeAll(async () => {
  await mongoose.connect(inject("mongoUri"));
});

beforeEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
