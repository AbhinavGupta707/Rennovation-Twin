import { PrismaPg } from "@prisma/adapter-pg";

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

  const prismaModule = (await import("@prisma/client")) as unknown as {
    PrismaClient?: new (options: { adapter: PrismaPg }) => PrismaClientLike;
  };

  if (!prismaModule.PrismaClient) {
    throw new Error("Prisma client is not generated. Run `pnpm db:generate` after configuring DATABASE_URL.");
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required when using the Prisma project store adapter.");
  }

  const adapter = new PrismaPg({ connectionString });
  const client = new prismaModule.PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}
