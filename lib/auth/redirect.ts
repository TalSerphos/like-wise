// Only same-site relative paths are allowed as post-auth redirect targets,
// so a crafted `next` parameter can't send users to another site.
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
