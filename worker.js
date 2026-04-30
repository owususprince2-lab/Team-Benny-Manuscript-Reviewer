export default {
  async fetch(request, env) {

    // ---------------- CORS ----------------
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors()
      });
    }

    // ---------------- METHOD CHECK ----------------
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.json();

      const hasKey = !!env.ANTHROPIC_API_KEY;

      // ---------------- FREE MOCK MODE ----------------
      if (!hasKey) {
        const mock = {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                verdict: "Minor Revision",
                overall_summary: "Mock mode active (no API key). Add ANTHROPIC_API_KEY to enable real review.",
                sections: {
                  introduction: { comments: [] },
                  materials_methods: { comments: [] },
                  results: { comments: [] },
                  kinetics_modelling: { comments: [] },
                  figures_tables: { comments: [] },
                  citations_references: { comments: [] },
                  writing_style: { comments: [] },
                  economic_analysis: { comments: [] },
                  conclusion: { comments: [] },
                  novelty_impact: { comments: [] }
                }
              })
            }
          ]
        };

        return json(mock);
      }

      // ---------------- FIX MODEL (IMPORTANT) ----------------
      const model = body.model && body.model !== "claude-sonnet-4-5"
        ? body.model
        : "claude-3-5-sonnet-latest"; // safe default

      // ---------------- LIMIT TOKENS ----------------
      const max_tokens = (!body.max_tokens || body.max_tokens > 4096)
        ? 2000
        : body.max_tokens;

      // ---------------- SYSTEM HANDLING ----------------
      const system = body.system || "";

      let messages = Array.isArray(body.messages)
        ? body.messages.filter(m => m.role !== "system")
        : [];

      const payload = {
        model,
        max_tokens,
        system,
        messages
      };

      // ---------------- CALL ANTHROPIC ----------------
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return jsonError("Invalid JSON from Anthropic", 500);
      }

      return json(data, response.status);

    } catch (err) {
      return jsonError(err.message, 500);
    }
  }
};

// ---------------- HELPERS ----------------

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...cors()
    }
  });
}

function jsonError(message, status = 400) {
  return json({ error: message }, status);
}
