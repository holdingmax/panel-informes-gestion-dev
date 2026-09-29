"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

const SALT_ROUNDS = 12;
const MAX_INTENTOS_RESET = 5;
const BLOQUEO_RESET_MINUTOS = 30;

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
  input: {
    role?: "ADMIN" | "USER";
    active?: boolean;
    newPassword?: string;
    securityQuestion?: string;
    securityAnswer?: string;
  }
) {
  await requireAdmin();

  const data: {
    role?: "ADMIN" | "USER";
    active?: boolean;
    passwordHash?: string;
    securityQuestion?: string;
    securityAnswerHash?: string;
  } = {
    role: input.role,
    active: input.active,
  };

  if (input.newPassword) {
    data.passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  }

  if (input.securityQuestion && input.securityAnswer) {
    data.securityQuestion = input.securityQuestion;
    data.securityAnswerHash = await bcrypt.hash(
      input.securityAnswer.trim().toLowerCase(),
      SALT_ROUNDS
    );
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

  // Mismo error genérico para no revelar si el usuario está bloqueado o si
  // directamente no existe.
  if (user.resetLockedUntil && user.resetLockedUntil > new Date()) {
    return genericError;
  }

  const answerMatches = await bcrypt.compare(
    input.answer.trim().toLowerCase(),
    user.securityAnswerHash
  );
  if (!answerMatches) {
    const intentos = user.failedResetAttempts + 1;
    if (intentos >= MAX_INTENTOS_RESET) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedResetAttempts: 0,
          resetLockedUntil: new Date(Date.now() + BLOQUEO_RESET_MINUTOS * 60 * 1000),
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedResetAttempts: intentos },
      });
    }
    return genericError;
  }

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, failedResetAttempts: 0, resetLockedUntil: null },
  });

  return { success: true as const };
}
