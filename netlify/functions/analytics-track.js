const { json, parseBody, supabaseFetch } = require("./_shared/supabase-admin");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE_TYPES = new Set(["desktop", "mobile", "tablet"]);

function sanitizePath(value) {
  const path = String(value || "/").split("?")[0].split("#")[0].trim();
  return path.startsWith("/") ? path.slice(0, 180) : "/";
}

function sanitizeText(value, fallback, maxLength) {
  const text = String(value || fallback).trim().toLowerCase();
  return text.slice(0, maxLength) || fallback;
}

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    try {
      const visitors = await supabaseFetch("/rest/v1/rpc/website_visitor_count", {
        method: "POST",
        body: JSON.stringify({}),
      });
      return json(200, { visitors: Number(visitors || 0) }, { "Cache-Control": "public, max-age=60" });
    } catch (error) {
      return json(error.statusCode || 500, { message: "Visitor count is unavailable" });
    }
  }

  if (event.httpMethod !== "POST") {
    return json(405, { message: "Method not allowed" }, { Allow: "GET, POST" });
  }

  try {
    const body = parseBody(event);
    if (!UUID_PATTERN.test(String(body.visitor_id || ""))) {
      return json(400, { message: "Invalid visitor identifier" });
    }

    const deviceType = DEVICE_TYPES.has(body.device_type) ? body.device_type : "desktop";
    await supabaseFetch("/rest/v1/website_visits", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        visitor_id: body.visitor_id,
        page_path: sanitizePath(body.page_path),
        referrer_domain: sanitizeText(body.referrer_domain, "direct", 120),
        device_type: deviceType,
        language: sanitizeText(body.language, "unknown", 18),
      }),
    });

    return json(202, { ok: true });
  } catch (error) {
    return json(error.statusCode || 500, { message: "Analytics event could not be recorded" });
  }
};
