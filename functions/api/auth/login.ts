// POST /api/auth/login
// Authenticates a user with email + password, returns session token

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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as {
      email?: string;
      password?: string;
    };

    if (!body.email || !body.password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const email = body.email.toLowerCase().trim();
    const passwordHash = await hashPassword(body.password);

    // Look up user
    const user = await context.env.DB.prepare(
      "SELECT id, email, name, role, status FROM users WHERE email = ? AND password_hash = ?"
    )
      .bind(email, passwordHash)
      .first();

    if (!user) {
      return Response.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (user.status === "suspended") {
      return Response.json(
        { error: "Account suspended. Please contact support." },
        { status: 403 }
      );
    }

    // Create session (expires in 7 days)
    const token = generateToken();
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    await context.env.DB.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    )
      .bind(token, user.id, expiresAt)
      .run();

    return Response.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
