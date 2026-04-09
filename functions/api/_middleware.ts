// Shared middleware for all /api/* routes
// Adds CORS headers and JSON content type

interface Env {
  DB: D1Database;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequest: PagesFunction<Env>[] = [
  async (context) => {
    // Handle preflight
    if (context.request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Run the next handler
    const response = await context.next();

    // Add CORS headers to all responses
    const newResponse = new Response(response.body, response);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newResponse.headers.set(key, value);
    }

    return newResponse;
  },
];
