// GET /api/auth/me
// Returns the current authenticated user from session token

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const authHeader = context.request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const token = authHeader.slice(7);

    const session = await context.env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.phone, u.company_name, u.postcode, u.avatar_url, u.trade_category, u.bio, u.location
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > unixepoch()`
    )
      .bind(token)
      .first();

    if (!session) {
      return Response.json(
        { error: "Session expired or invalid" },
        { status: 401 }
      );
    }

    return Response.json({ user: session });
  } catch (err) {
    console.error("Auth check error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
