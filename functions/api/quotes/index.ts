// POST /api/quotes — submit a quote on a job (pro only)
// GET /api/quotes?pro_id=xxx — list quotes by a pro

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

// GET: List quotes for a pro
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(context.request.url);
    const proId = url.searchParams.get("pro_id") || (user.id as string);

    const { results } = await context.env.DB.prepare(
      `SELECT q.*, j.title as job_title, j.category as job_category, j.status as job_status,
              u.name as buyer_name
       FROM quotes q
       JOIN jobs j ON j.id = q.job_id
       JOIN users u ON u.id = j.buyer_id
       WHERE q.pro_id = ?
       ORDER BY q.created_at DESC`
    )
      .bind(proId)
      .all();

    return Response.json({ quotes: results });
  } catch (err) {
    console.error("List quotes error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};

// POST: Submit a quote
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "pro") {
      return Response.json(
        { error: "Only professionals can submit quotes" },
        { status: 403 }
      );
    }

    const body = (await context.request.json()) as {
      job_id?: string;
      amount_pence?: number;
      message?: string;
      estimated_days?: number;
    };

    if (!body.job_id || !body.amount_pence) {
      return Response.json(
        { error: "Job ID and amount are required" },
        { status: 400 }
      );
    }

    // Check job exists and is open
    const job = await context.env.DB.prepare(
      "SELECT id, status, buyer_id FROM jobs WHERE id = ?"
    )
      .bind(body.job_id)
      .first();

    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.status !== "open") {
      return Response.json(
        { error: "Job is no longer accepting quotes" },
        { status: 400 }
      );
    }
    if (job.buyer_id === user.id) {
      return Response.json(
        { error: "Cannot quote on your own job" },
        { status: 400 }
      );
    }

    // Check for duplicate quote
    const existingQuote = await context.env.DB.prepare(
      "SELECT id FROM quotes WHERE job_id = ? AND pro_id = ?"
    )
      .bind(body.job_id, user.id)
      .first();

    if (existingQuote) {
      return Response.json(
        { error: "You have already quoted on this job" },
        { status: 409 }
      );
    }

    const quoteId = crypto.randomUUID();
    const now = new Date().toISOString();

    await context.env.DB.prepare(
      `INSERT INTO quotes (id, job_id, pro_id, amount_pence, message, estimated_days, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
      .bind(
        quoteId,
        body.job_id,
        user.id,
        body.amount_pence,
        body.message || null,
        body.estimated_days || null,
        now
      )
      .run();

    // Create notification for buyer
    await context.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, related_id, read, created_at)
       VALUES (?, ?, 'quote', 'New quote received', ?, ?, 0, ?)`
    )
      .bind(
        crypto.randomUUID(),
        job.buyer_id,
        `You received a new quote on your job`,
        body.job_id,
        now
      )
      .run();

    return Response.json({ id: quoteId }, { status: 201 });
  } catch (err) {
    console.error("Create quote error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
