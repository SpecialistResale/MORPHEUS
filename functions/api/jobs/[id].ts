// GET /api/jobs/:id — get single job with quotes
// PUT /api/jobs/:id — update job status

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

// GET: Single job with quotes
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const jobId = context.params.id as string;

    const job = await context.env.DB.prepare(
      `SELECT j.*, u.name as buyer_name, u.avatar_url as buyer_avatar, u.postcode as buyer_postcode
       FROM jobs j
       JOIN users u ON u.id = j.buyer_id
       WHERE j.id = ?`
    )
      .bind(jobId)
      .first();

    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    // Get quotes for this job
    const { results: quotes } = await context.env.DB.prepare(
      `SELECT q.*, u.name as pro_name, u.avatar_url as pro_avatar, u.trade_category, u.bio
       FROM quotes q
       JOIN users u ON u.id = q.pro_id
       WHERE q.job_id = ?
       ORDER BY q.created_at DESC`
    )
      .bind(jobId)
      .all();

    return Response.json({ job, quotes });
  } catch (err) {
    console.error("Get job error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};

// PUT: Update job
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const jobId = context.params.id as string;
    const body = (await context.request.json()) as {
      status?: string;
      assigned_pro_id?: string;
    };

    // Verify ownership
    const job = await context.env.DB.prepare(
      "SELECT buyer_id FROM jobs WHERE id = ?"
    )
      .bind(jobId)
      .first();

    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.buyer_id !== user.id) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    const now = new Date().toISOString();

    if (body.status) {
      await context.env.DB.prepare(
        "UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?"
      )
        .bind(body.status, now, jobId)
        .run();
    }

    if (body.assigned_pro_id) {
      await context.env.DB.prepare(
        "UPDATE jobs SET assigned_pro_id = ?, status = 'assigned', updated_at = ? WHERE id = ?"
      )
        .bind(body.assigned_pro_id, now, jobId)
        .run();
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Update job error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
