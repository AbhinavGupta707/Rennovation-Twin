import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

type PrismaClientLike = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
};

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientLike;
};

export async function getPrismaClient(): Promise<PrismaClientLike> {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required when using the Prisma project store adapter.");
  }

  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}
