"use server";

import { revalidatePath } from "next/cache";
import { createUser, updateUser } from "@/lib/auth-actions";

export async function createUserAction(formData: FormData) {
  await createUser({
    username: String(formData.get("username")),
    password: String(formData.get("password")),
    role: formData.get("role") === "ADMIN" ? "ADMIN" : "USER",
    securityQuestion: String(formData.get("securityQuestion")),
    securityAnswer: String(formData.get("securityAnswer")),
  });
  revalidatePath("/admin/users");
}

export async function toggleActiveAction(id: string, active: boolean) {
  await updateUser(id, { active });
  revalidatePath("/admin/users");
}
