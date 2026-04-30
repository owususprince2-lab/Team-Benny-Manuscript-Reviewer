export default {
  async fetch(request, env) {

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

      // 🔴 Normalize model (prevents 400)
      if (!body.model) {
        body.model = "claude-3-5-sonnet-latest";
      }

      // 🔴 Ensure max_tokens is safe
      if (!body.max_tokens || body.max_tokens > 4096) {
        body.max_tokens = 2000;
      }

      // 🔴 Move system out of messages if needed
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

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return jsonError("Invalid JSON from Anthropic", 500);
      }

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...cors()
        }
      });

    } catch (err) {
      return jsonError(err.message, 500);
    }
  }
};

// ---------------- helpers ----------------

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
