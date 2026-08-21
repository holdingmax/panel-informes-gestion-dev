"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function login(formData: FormData) {
  const username = formData.get("username");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Usuario o contraseña incorrectos." };
    }
    throw error;
  }
}
