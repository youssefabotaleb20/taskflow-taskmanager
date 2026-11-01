import { MongoMemoryServer } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

let mongo: MongoMemoryServer;

// Set MONGOMS_SYSTEM_BINARY to use a local mongod instead of downloading one.
export async function setup(project: TestProject) {
  mongo = await MongoMemoryServer.create();
  project.provide("mongoUri", mongo.getUri("taskflow-test"));
}

export async function teardown() {
  await mongo?.stop();
}
