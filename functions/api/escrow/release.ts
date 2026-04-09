// POST /api/escrow/release — buyer releases escrow funds to pro

interface Env {
  DB: D1Database;
}

async function getUser(request: Request, db: D1Database) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return db
    .prepare(
      `SELECT u.id, u.role FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > unixepoch()`
    )
    .bind(token)
    .first();
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await context.request.json()) as { escrow_id?: string };
    if (!body.escrow_id) {
      return Response.json(
        { error: "escrow_id is required" },
        { status: 400 }
      );
    }

    const escrow = await context.env.DB.prepare(
      "SELECT * FROM escrow_transactions WHERE id = ?"
    )
      .bind(body.escrow_id)
      .first();

    if (!escrow) {
      return Response.json(
        { error: "Escrow not found" },
        { status: 404 }
      );
    }
    if (escrow.buyer_id !== user.id) {
      return Response.json(
        { error: "Only the buyer can release escrow" },
        { status: 403 }
      );
    }
    if (escrow.status !== "funded") {
      return Response.json(
        { error: "Escrow is not in funded state" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Release the escrow
    await context.env.DB.prepare(
      "UPDATE escrow_transactions SET status = 'released', released_at = ?, updated_at = ? WHERE id = ?"
    )
      .bind(now, now, body.escrow_id)
      .run();

    // Mark job as completed if all escrow milestones are released
    const pendingEscrow = await context.env.DB.prepare(
      "SELECT COUNT(*) as count FROM escrow_transactions WHERE job_id = ? AND status = 'funded'"
    )
      .bind(escrow.job_id)
      .first();

    if (pendingEscrow?.count === 0) {
      await context.env.DB.prepare(
        "UPDATE jobs SET status = 'completed', updated_at = ? WHERE id = ?"
      )
        .bind(now, escrow.job_id)
        .run();
    }

    // Notify the pro
    await context.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, related_id, read, created_at)
       VALUES (?, ?, 'payment', 'Payment released', 'The buyer has released your payment', ?, 0, ?)`
    )
      .bind(crypto.randomUUID(), escrow.pro_id, escrow.job_id, now)
      .run();

    return Response.json({ ok: true, status: "released" });
  } catch (err) {
    console.error("Release escrow error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
