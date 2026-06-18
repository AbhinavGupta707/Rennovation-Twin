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
    PrismaClient?: new () => PrismaClientLike;
  };

  if (!prismaModule.PrismaClient) {
    throw new Error("Prisma client is not generated. Run `pnpm db:generate` after configuring DATABASE_URL.");
  }

  const client = new prismaModule.PrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}
