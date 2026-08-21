import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const securityQuestion = process.env.SEED_ADMIN_SECURITY_QUESTION;
  const securityAnswer = process.env.SEED_ADMIN_SECURITY_ANSWER;

  if (!username || !password || !securityQuestion || !securityAnswer) {
    throw new Error(
      "Faltan SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD, SEED_ADMIN_SECURITY_QUESTION o SEED_ADMIN_SECURITY_ANSWER en .env"
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const securityAnswerHash = await bcrypt.hash(
    securityAnswer.trim().toLowerCase(),
    12
  );

  const admin = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash,
      role: "ADMIN",
      securityQuestion,
      securityAnswerHash,
    },
  });

  console.log(`Usuario admin listo: ${admin.username}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
