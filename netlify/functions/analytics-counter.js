const { json, supabaseFetch } = require("./_shared/supabase-admin");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { message: "Method not allowed" }, { Allow: "GET" });
  }

  try {
    const visitors = await supabaseFetch("/rest/v1/rpc/website_visitor_count", {
      method: "POST",
      body: JSON.stringify({}),
    });
    return json(200, { visitors: Number(visitors || 0) }, { "Cache-Control": "public, max-age=60" });
  } catch (error) {
    return json(error.statusCode || 500, { message: "Visitor count is unavailable" });
  }
};
