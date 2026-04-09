// GET /api/messages — list conversations
// POST /api/messages — send a message

interface Env {
  DB: D1Database;
}

async function getUser(request: Request, db: D1Database) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return db
    .prepare(
      `SELECT u.id, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > unixepoch()`
    )
    .bind(token)
    .first();
}

// GET: List conversations (grouped by other user)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(context.request.url);
    const otherUserId = url.searchParams.get("with");

    if (otherUserId) {
      // Get messages with a specific user
      const { results } = await context.env.DB.prepare(
        `SELECT m.*, u.name as sender_name
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE (m.sender_id = ? AND m.recipient_id = ?)
            OR (m.sender_id = ? AND m.recipient_id = ?)
         ORDER BY m.created_at ASC
         LIMIT 100`
      )
        .bind(user.id, otherUserId, otherUserId, user.id)
        .all();

      // Mark as read
      await context.env.DB.prepare(
        `UPDATE messages SET read = 1
         WHERE recipient_id = ? AND sender_id = ? AND read = 0`
      )
        .bind(user.id, otherUserId)
        .run();

      return Response.json({ messages: results });
    }

    // List conversation summaries
    const { results } = await context.env.DB.prepare(
      `SELECT
         CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END as other_user_id,
         u.name as other_user_name,
         u.avatar_url as other_user_avatar,
         u.role as other_user_role,
         u.trade_category as other_user_trade,
         m.body as last_message,
         m.created_at as last_message_at,
         (SELECT COUNT(*) FROM messages m2
          WHERE m2.sender_id = u.id AND m2.recipient_id = ? AND m2.read = 0) as unread_count
       FROM messages m
       JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END
       WHERE m.id IN (
         SELECT MAX(id) FROM messages
         WHERE sender_id = ? OR recipient_id = ?
         GROUP BY CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END
       )
       ORDER BY m.created_at DESC`
    )
      .bind(user.id, user.id, user.id, user.id, user.id, user.id)
      .all();

    return Response.json({ conversations: results });
  } catch (err) {
    console.error("Messages error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};

// POST: Send a message
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await context.request.json()) as {
      recipient_id?: string;
      body?: string;
      job_id?: string;
    };

    if (!body.recipient_id || !body.body?.trim()) {
      return Response.json(
        { error: "Recipient and message body are required" },
        { status: 400 }
      );
    }

    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    await context.env.DB.prepare(
      `INSERT INTO messages (id, sender_id, recipient_id, body, job_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    )
      .bind(
        messageId,
        user.id,
        body.recipient_id,
        body.body.trim(),
        body.job_id || null,
        now
      )
      .run();

    return Response.json({ id: messageId }, { status: 201 });
  } catch (err) {
    console.error("Send message error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
