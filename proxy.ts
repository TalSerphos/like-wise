import createIntlProxy from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { refreshSession } from "./lib/supabase/proxy";

const handleLocale = createIntlProxy(routing);

export async function proxy(request: NextRequest) {
  const response = handleLocale(request);
  return refreshSession(request, response);
}

export const config = {
  // Skip API routes, auth callbacks, Next internals and files with extensions.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
