// POST /api/auth/logout
// Destroys the current session

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const authHeader = context.request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json({ ok: true }); // Already logged out
    }

    const token = authHeader.slice(7);
    await context.env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(token)
      .run();

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Logout error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
