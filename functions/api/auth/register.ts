// POST /api/auth/register
// Creates a new user account

interface Env {
  DB: D1Database;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateId(): string {
  return crypto.randomUUID();
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
      phone?: string;
      company_name?: string;
      postcode?: string;
      trade_category?: string;
    };

    // Validate required fields
    if (!body.email || !body.password || !body.name) {
      return Response.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    if (body.password.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const email = body.email.toLowerCase().trim();
    const role = body.role === "pro" ? "pro" : "buyer";

    // Check if email already exists
    const existing = await context.env.DB.prepare(
      "SELECT id FROM users WHERE email = ?"
    )
      .bind(email)
      .first();

    if (existing) {
      return Response.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const userId = generateId();
    const passwordHash = await hashPassword(body.password);
    const now = new Date().toISOString();

    // Insert user
    await context.env.DB.prepare(
      `INSERT INTO users (id, email, name, role, password_hash, status, created_at, updated_at, phone, company_name, postcode, trade_category)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        userId,
        email,
        body.name.trim(),
        role,
        passwordHash,
        now,
        now,
        body.phone || null,
        body.company_name || null,
        body.postcode || null,
        body.trade_category || null
      )
      .run();

    // Create session
    const token = generateToken();
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    await context.env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    )
      .bind(token, userId, expiresAt)
      .run();

    return Response.json(
      {
        token,
        user: {
          id: userId,
          email,
          name: body.name.trim(),
          role,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
