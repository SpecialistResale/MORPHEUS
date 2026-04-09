// GET /api/notifications — list notifications for current user
// PUT /api/notifications — mark notifications as read

interface Env {
  DB: D1Database;
}

async function getUser(request: Request, db: D1Database) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return db
    .prepare(
      `SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > unixepoch()`
    )
    .bind(token)
    .first();
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { results } = await context.env.DB.prepare(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`
    )
      .bind(user.id)
      .all();

    return Response.json({ notifications: results });
  } catch (err) {
    console.error("Notifications error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    await context.env.DB.prepare(
      "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0"
    )
      .bind(user.id)
      .run();

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Mark read error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
