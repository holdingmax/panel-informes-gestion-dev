"use server";

import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const SALT_ROUNDS = 12;

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
}

export async function listUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    select: { id: true, username: true, role: true, active: true, createdAt: true },
    orderBy: { username: "asc" },
  });
}

export async function createUser(input: {
  username: string;
  password: string;
  role: "ADMIN" | "USER";
  securityQuestion: string;
  securityAnswer: string;
}) {
  await requireAdmin();

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const securityAnswerHash = await bcrypt.hash(
    input.securityAnswer.trim().toLowerCase(),
    SALT_ROUNDS
  );

  return prisma.user.create({
    data: {
      username: input.username,
      passwordHash,
      role: input.role,
      securityQuestion: input.securityQuestion,
      securityAnswerHash,
    },
    select: { id: true, username: true, role: true },
  });
}

export async function updateUser(
  id: string,
  input: { role?: "ADMIN" | "USER"; active?: boolean; newPassword?: string }
) {
  await requireAdmin();

  const data: { role?: "ADMIN" | "USER"; active?: boolean; passwordHash?: string } = {
    role: input.role,
    active: input.active,
  };

  if (input.newPassword) {
    data.passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  }

  return prisma.user.update({ where: { id }, data });
}

export async function getSecurityQuestion(username: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  return { question: user?.securityQuestion ?? "Pregunta de seguridad" };
}

export async function resetPasswordViaSecurityQuestion(input: {
  username: string;
  answer: string;
  newPassword: string;
}) {
  const user = await prisma.user.findUnique({ where: { username: input.username } });
  const genericError = { error: "Usuario o respuesta incorrectos." };

  if (!user || !user.active) return genericError;

  const answerMatches = await bcrypt.compare(
    input.answer.trim().toLowerCase(),
    user.securityAnswerHash
  );
  if (!answerMatches) return genericError;

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { success: true as const };
}
