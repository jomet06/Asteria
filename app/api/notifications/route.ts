import { createClient } from "@/lib/supabase/server";
import { getNotificationInbox } from "@/features/notifications/data";
import { uuidPattern } from "@/features/tasks/workspace-view";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const cursor = new URL(request.url).searchParams.get("before");
  if (cursor && !uuidPattern.test(cursor)) return Response.json({ error: "invalid_cursor" }, { status: 400, headers });
  try { return Response.json(await getNotificationInbox(user.id, cursor), { headers }); }
  catch { return Response.json({ error: "notifications_unavailable" }, { status: 503, headers }); }
}
