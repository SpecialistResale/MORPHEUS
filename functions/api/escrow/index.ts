// POST /api/escrow — create escrow for a job (buyer funds it)
// GET /api/escrow?job_id=xxx — get escrow status

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

// GET: Escrow status for a job
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(context.request.url);
    const jobId = url.searchParams.get("job_id");

    if (!jobId) {
      return Response.json(
        { error: "job_id is required" },
        { status: 400 }
      );
    }

    const { results } = await context.env.DB.prepare(
      `SELECT e.*, j.title as job_title
       FROM escrow_transactions e
       JOIN jobs j ON j.id = e.job_id
       WHERE e.job_id = ?
       ORDER BY e.created_at DESC`
    )
      .bind(jobId)
      .all();

    return Response.json({ escrow: results });
  } catch (err) {
    console.error("Get escrow error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};

// POST: Create escrow payment
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await context.request.json()) as {
      job_id?: string;
      amount_pence?: number;
      milestone_label?: string;
    };

    if (!body.job_id || !body.amount_pence) {
      return Response.json(
        { error: "Job ID and amount are required" },
        { status: 400 }
      );
    }

    // Verify job ownership
    const job = await context.env.DB.prepare(
      "SELECT buyer_id, assigned_pro_id, status FROM jobs WHERE id = ?"
    )
      .bind(body.job_id)
      .first();

    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.buyer_id !== user.id) {
      return Response.json(
        { error: "Only the buyer can fund escrow" },
        { status: 403 }
      );
    }

    const escrowId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Calculate platform commission (tiered: 12% first £10K, 10% £10K-£50K, 8% above)
    const amountPence = body.amount_pence;
    let commissionPence: number;
    if (amountPence <= 1000000) {
      // Up to £10,000
      commissionPence = Math.round(amountPence * 0.12);
    } else if (amountPence <= 5000000) {
      commissionPence =
        Math.round(1000000 * 0.12) +
        Math.round((amountPence - 1000000) * 0.1);
    } else {
      commissionPence =
        Math.round(1000000 * 0.12) +
        Math.round(4000000 * 0.1) +
        Math.round((amountPence - 5000000) * 0.08);
    }

    await context.env.DB.prepare(
      `INSERT INTO escrow_transactions (id, job_id, buyer_id, pro_id, amount_pence, commission_pence, milestone_label, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'funded', ?, ?)`
    )
      .bind(
        escrowId,
        body.job_id,
        user.id,
        job.assigned_pro_id || null,
        amountPence,
        commissionPence,
        body.milestone_label || null,
        now,
        now
      )
      .run();

    // Update job status to in_progress
    await context.env.DB.prepare(
      "UPDATE jobs SET status = 'in_progress', updated_at = ? WHERE id = ? AND status = 'assigned'"
    )
      .bind(now, body.job_id)
      .run();

    return Response.json(
      {
        id: escrowId,
        amount_pence: amountPence,
        commission_pence: commissionPence,
        status: "funded",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create escrow error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
