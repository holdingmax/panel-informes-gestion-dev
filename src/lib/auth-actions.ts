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

type ResultadoUsuario = { success: true } | { error: string };

// Que siempre quede al menos un ADMIN activo que pueda entrar a administrar.
async function quedaOtroAdminActivo(excluyendoId: string) {
  const otros = await prisma.user.count({
    where: { role: "ADMIN", active: true, id: { not: excluyendoId } },
  });
  return otros > 0;
}

// Desactivar bloquea el login de ese usuario: no se permite desactivarse a uno
// mismo ni al último Admin activo, para no quedar sin nadie que administre.
export async function setUserActive(id: string, active: boolean): Promise<ResultadoUsuario> {
  const session = await requireAdmin();

  if (!active) {
    if (id === session.user.id) return { error: "No podés desactivar tu propio usuario." };
    const actual = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (actual?.role === "ADMIN" && !(await quedaOtroAdminActivo(id))) {
      return { error: "Tiene que quedar al menos un Admin activo." };
    }
  }

  await prisma.user.update({ where: { id }, data: { active } });
  return { success: true };
}

// Corrige un usuario mal cargado: nombre de usuario y rol. La contraseña y la
// pregunta de seguridad tienen sus propios botones (updateUser).
export async function editUser(
  id: string,
  input: { username: string; role: "ADMIN" | "USER" }
): Promise<ResultadoUsuario> {
  const session = await requireAdmin();

  const username = input.username.trim();
  if (!username) return { error: "El usuario no puede estar vacío." };

  const actual = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!actual) return { error: "El usuario no existe." };

  if (actual.role === "ADMIN" && input.role !== "ADMIN") {
    if (id === session.user.id) return { error: "No podés quitarte el rol de Admin a vos mismo." };
    if (!(await quedaOtroAdminActivo(id))) return { error: "Tiene que quedar al menos un Admin activo." };
  }

  const repetido = await prisma.user.findFirst({
    where: { username, id: { not: id } },
    select: { id: true },
  });
  if (repetido) return { error: "Ya existe un usuario con ese nombre." };

  await prisma.user.update({ where: { id }, data: { username, role: input.role } });
  return { success: true };
}

// Los permisos por unidad se borran con el usuario. Las reclasificaciones y
// adjuntos que cargó conservan su id de autor sin FK (ver createdByUserId).
export async function deleteUser(id: string): Promise<ResultadoUsuario> {
  const session = await requireAdmin();

  if (id === session.user.id) return { error: "No podés eliminar tu propio usuario." };

  const actual = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!actual) return { error: "El usuario no existe." };
  if (actual.role === "ADMIN" && !(await quedaOtroAdminActivo(id))) {
    return { error: "Tiene que quedar al menos un Admin activo." };
  }

  await prisma.$transaction([
    prisma.userUnidadPermiso.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);
  return { success: true };
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
