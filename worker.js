export default {
  async fetch(request, env) {

    // ---------------- CORS ----------------
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: cors()
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();

      // ---------------- SAFETY PATCHES ----------------
      if (!body.model) {
        body.model = "claude-3-5-sonnet-latest";
      }

      if (!body.max_tokens || body.max_tokens > 4096) {
        body.max_tokens = 2000;
      }

      let system = body.system || "";

      if (Array.isArray(body.messages)) {
        body.messages = body.messages.filter(m => m.role !== "system");
      }

      const payload = {
        model: body.model,
        max_tokens: body.max_tokens,
        system,
        messages: body.messages
      };

      // ---------------- ANTHROPIC CALL ----------------
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();

      // ---------------- SAFE PARSING ----------------
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return jsonError("Invalid JSON returned from Anthropic API", 500);
      }

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...cors()
        }
      });

    } catch (err) {
      return jsonError(err.message || "Unknown error", 500);
    }
  }
};

// ---------------- HELPERS ----------------

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors()
    }
  });
}
