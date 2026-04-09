// GET /api/dashboard/stats — returns dashboard statistics for current user

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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const user = await getUser(context.request, context.env.DB);
    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (user.role === "buyer") {
      // Buyer dashboard stats
      const activeJobs = await context.env.DB.prepare(
        "SELECT COUNT(*) as count FROM jobs WHERE buyer_id = ? AND status IN ('open', 'assigned', 'in_progress')"
      )
        .bind(user.id)
        .first();

      const completedJobs = await context.env.DB.prepare(
        "SELECT COUNT(*) as count FROM jobs WHERE buyer_id = ? AND status = 'completed'"
      )
        .bind(user.id)
        .first();

      const pendingQuotes = await context.env.DB.prepare(
        `SELECT COUNT(*) as count FROM quotes q
         JOIN jobs j ON j.id = q.job_id
         WHERE j.buyer_id = ? AND q.status = 'pending'`
      )
        .bind(user.id)
        .first();

      const totalSpent = await context.env.DB.prepare(
        `SELECT COALESCE(SUM(e.amount_pence), 0) as total FROM escrow_transactions e
         JOIN jobs j ON j.id = e.job_id
         WHERE j.buyer_id = ? AND e.status = 'released'`
      )
        .bind(user.id)
        .first();

      const unreadMessages = await context.env.DB.prepare(
        "SELECT COUNT(*) as count FROM messages WHERE recipient_id = ? AND read = 0"
      )
        .bind(user.id)
        .first();

      // Recent jobs
      const { results: recentJobs } = await context.env.DB.prepare(
        `SELECT j.*, (SELECT COUNT(*) FROM quotes WHERE job_id = j.id) as quote_count
         FROM jobs j WHERE j.buyer_id = ?
         ORDER BY j.created_at DESC LIMIT 5`
      )
        .bind(user.id)
        .all();

      return Response.json({
        stats: {
          active_jobs: activeJobs?.count || 0,
          completed_jobs: completedJobs?.count || 0,
          pending_quotes: pendingQuotes?.count || 0,
          total_spent_pence: totalSpent?.total || 0,
          unread_messages: unreadMessages?.count || 0,
        },
        recent_jobs: recentJobs,
      });
    }

    // Pro dashboard stats
    const activeQuotes = await context.env.DB.prepare(
      "SELECT COUNT(*) as count FROM quotes WHERE pro_id = ? AND status = 'pending'"
    )
      .bind(user.id)
      .first();

    const wonJobs = await context.env.DB.prepare(
      "SELECT COUNT(*) as count FROM quotes WHERE pro_id = ? AND status = 'accepted'"
    )
      .bind(user.id)
      .first();

    const completedJobs = await context.env.DB.prepare(
      `SELECT COUNT(*) as count FROM jobs
       WHERE assigned_pro_id = ? AND status = 'completed'`
    )
      .bind(user.id)
      .first();

    const totalEarned = await context.env.DB.prepare(
      `SELECT COALESCE(SUM(e.amount_pence), 0) as total FROM escrow_transactions e
       JOIN jobs j ON j.id = e.job_id
       WHERE j.assigned_pro_id = ? AND e.status = 'released'`
    )
      .bind(user.id)
      .first();

    const avgRating = await context.env.DB.prepare(
      "SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE reviewee_id = ?"
    )
      .bind(user.id)
      .first();

    const unreadMessages = await context.env.DB.prepare(
      "SELECT COUNT(*) as count FROM messages WHERE recipient_id = ? AND read = 0"
    )
      .bind(user.id)
      .first();

    // Available jobs (open, matching pro's trade category)
    const { results: availableJobs } = await context.env.DB.prepare(
      `SELECT j.*, u.name as buyer_name,
              (SELECT COUNT(*) FROM quotes WHERE job_id = j.id) as quote_count
       FROM jobs j
       JOIN users u ON u.id = j.buyer_id
       WHERE j.status = 'open'
       ORDER BY j.created_at DESC LIMIT 10`
    )
      .bind()
      .all();

    return Response.json({
      stats: {
        active_quotes: activeQuotes?.count || 0,
        won_jobs: wonJobs?.count || 0,
        completed_jobs: completedJobs?.count || 0,
        total_earned_pence: totalEarned?.total || 0,
        avg_rating: avgRating?.avg || 0,
        review_count: avgRating?.count || 0,
        unread_messages: unreadMessages?.count || 0,
      },
      available_jobs: availableJobs,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
