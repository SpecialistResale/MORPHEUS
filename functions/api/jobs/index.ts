// GET /api/jobs — list jobs (with filters)
// POST /api/jobs — create a new job

interface Env {
  DB: D1Database;
}

// Helper: extract user from session token
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

// GET: List jobs
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const status = url.searchParams.get("status") || "open";
    const category = url.searchParams.get("category");
    const buyerId = url.searchParams.get("buyer_id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let query = `SELECT j.*, u.name as buyer_name, u.avatar_url as buyer_avatar
                 FROM jobs j
                 JOIN users u ON u.id = j.buyer_id
                 WHERE j.status = ?`;
    const params: unknown[] = [status];

    if (category) {
      query += " AND j.category = ?";
      params.push(category);
    }
    if (buyerId) {
      query += " AND j.buyer_id = ?";
      params.push(buyerId);
    }

    query += " ORDER BY j.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const { results } = await context.env.DB.prepare(query)
      .bind(...params)
      .all();

    return Response.json({ jobs: results });
  } catch (err) {
    console.error("List jobs error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};

// POST: Create a job
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await context.request.json()) as {
      title?: string;
      description?: string;
      category?: string;
      budget_pence?: number;
      postcode?: string;
      urgency?: string;
    };

    if (!body.title || !body.description || !body.category) {
      return Response.json(
        { error: "Title, description, and category are required" },
        { status: 400 }
      );
    }

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    await context.env.DB.prepare(
      `INSERT INTO jobs (id, buyer_id, title, description, category, budget_pence, postcode, urgency, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`
    )
      .bind(
        jobId,
        user.id,
        body.title.trim(),
        body.description.trim(),
        body.category,
        body.budget_pence || null,
        body.postcode || null,
        body.urgency || "normal",
        now,
        now
      )
      .run();

    return Response.json({ id: jobId }, { status: 201 });
  } catch (err) {
    console.error("Create job error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
