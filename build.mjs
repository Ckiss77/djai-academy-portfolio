import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const dist = resolve(root, "dist");
const client = resolve(dist, "client");

await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(client, { recursive: true });

for (const entry of [
  "index.html",
  "styles.css",
  "script.js",
  "assets",
  "_redirects",
  "robots.txt",
  "sitemap.xml",
]) {
  await cp(resolve(root, entry), resolve(client, entry), { recursive: true });
}

await writeFile(resolve(dist, "server/index.js"), `
const SUPABASE_URL = env => env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env => env.SUPABASE_ANON_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/responses";

async function supabaseRpc(env, functionName, body) {
  const response = await fetch(\`\${SUPABASE_URL(env)}/rest/v1/rpc/\${functionName}\`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY(env),
      Authorization: \`Bearer \${SUPABASE_ANON_KEY(env)}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Analytics request failed");
  return response.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analytics/count" && request.method === "GET") {
      try {
        const visitors = await supabaseRpc(env, "website_visitor_count", {});
        return new Response(JSON.stringify({ visitors: Number(visitors || 0) }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      } catch (error) {
        return new Response(JSON.stringify({ message: "Visitor count is unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
    }
    if (url.pathname === "/api/analytics/track" && request.method === "POST") {
      try {
        const body = await request.json();
        const visitors = await supabaseRpc(env, "website_record_visit", {
          p_visitor_id: body.visitor_id,
          p_page_path: body.page_path || "/",
          p_referrer_domain: body.referrer_domain || "direct",
          p_device_type: body.device_type || "desktop",
          p_language: body.language || "unknown",
        });
        return new Response(JSON.stringify({ ok: true, visitors: Number(visitors || 0) }), { status: 202, headers: { "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ message: "Analytics event could not be recorded" }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
    }
    if (url.pathname === "/api/ai/ask" && request.method === "POST") {
      if (!env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ message: "AI Concierge is not configured yet" }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
      try {
        const body = await request.json();
        const message = String(body.message || "").trim().slice(0, 500);
        if (!message) return new Response(JSON.stringify({ message: "A question is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const response = await fetch(OPENAI_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.OPENAI_API_KEY },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            instructions: "You are DJAI AI Concierge for DJAI Academy. Answer clearly and professionally in the user's language. Use only this context: DJAI Academy provides AI training, executive workshops, digital transformation consulting, AI adoption, data intelligence, AI avatar communication, AI cinematic video production, and web application experiences. If asked about a specific portfolio item, explain its likely creative or business value without inventing private facts. Keep answers concise and useful.",
            input: message,
            temperature: 0.6,
            max_output_tokens: 350,
          }),
        });
        const result = await response.json();
        if (!response.ok) return new Response(JSON.stringify({ message: "AI service request failed" }), { status: 502, headers: { "Content-Type": "application/json" } });
        const answer = result.output_text || result.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text || "I could not find an answer just yet.";
        return new Response(JSON.stringify({ answer }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      } catch (error) {
        return new Response(JSON.stringify({ message: "AI Concierge is temporarily unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
    }
    if (url.pathname === "/") url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url, request));
  },
};
`);
