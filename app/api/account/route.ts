import { NextRequest } from "next/server";
import { deleteAuthenticatedAccount } from "@/lib/delete-account-server";

export async function DELETE(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!accessToken) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { currentPassword?: string };
  return deleteAuthenticatedAccount({
    accessToken,
    currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : "",
  });
}
