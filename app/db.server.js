import { PrismaClient } from "@prisma/client";

console.log("NODE_ENV:", process.env.NODE_ENV);

const dbUrl = process.env.DATABASE_URL;

if (dbUrl) {
  const url = new URL(dbUrl);

  console.log("DB HOST:", url.hostname);
  console.log("DB NAME:", url.pathname);
} else {
  console.log("DATABASE_URL is missing");
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;