export default {
  async fetch(request, env) {

    // ─────────────────────────────
    // CORS
    // ─────────────────────────────
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.json();

      // ─────────────────────────────
      // SAFE DEFAULTS
      // ─────────────────────────────
      const model = body.model || "claude-3-5-sonnet-latest";

      const max_tokens = Math.min(
        body.max_tokens || 2000,
        4096
      );

      const system =
        typeof body.system === "string"
          ? body.system
          : JSON.stringify(body.system || "");

      // ─────────────────────────────
      // FORCE VALID MESSAGES FORMAT
      // ─────────────────────────────
      const messages = Array.isArray(body.messages)
        ? body.messages.map(m => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content:
              typeof m.content === "string"
                ? m.content
                : JSON.stringify(m.content || "")
          }))
        : [];

      if (messages.length === 0) {
        return jsonError("No valid messages provided", 400, corsHeaders);
      }

      // ─────────────────────────────
      // FINAL PAYLOAD (ANTHROPIC SAFE)
      // ─────────────────────────────
      const payload = {
        model,
        max_tokens,
        system,
        messages
      };

      // ─────────────────────────────
      // DEBUG (optional - remove later)
      // ─────────────────────────────
      console.log("Anthropic Payload:", JSON.stringify(payload));

      // ─────────────────────────────
      // CALL ANTHROPIC
      // ─────────────────────────────
      const response = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(payload),
        }
      );

      const text = await response.text();

      // ─────────────────────────────
      // SAFE RESPONSE PARSE
      // ─────────────────────────────
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return jsonError("Invalid JSON returned from Anthropic API", 500, corsHeaders, text);
      }

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });

    } catch (err) {
      return jsonError(err.message || "Unknown error", 500, corsHeaders);
    }
  }
};

// ─────────────────────────────
// HELPERS
// ─────────────────────────────
function jsonError(message, status, corsHeaders, raw = null) {
  return new Response(
    JSON.stringify({
      error: message,
      raw: raw || undefined
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    }
  );
}
