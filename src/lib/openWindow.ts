"use client";

export function openInWindow(url: string, name: string) {
  const win = window.open(url, name);
  win?.focus();
}
