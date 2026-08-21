"use server";

import { getSecurityQuestion, resetPasswordViaSecurityQuestion } from "@/lib/auth-actions";

export async function fetchSecurityQuestion(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const { question } = await getSecurityQuestion(username);
  return { username, question };
}

export async function submitNewPassword(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const answer = String(formData.get("answer") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (newPassword.length < 8) {
    return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
  }

  return resetPasswordViaSecurityQuestion({ username, answer, newPassword });
}
