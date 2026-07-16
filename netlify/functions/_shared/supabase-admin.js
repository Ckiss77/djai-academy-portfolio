const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const COURSE_DOCS_BUCKET = process.env.COURSE_DOCS_BUCKET || "course-documents";

function json(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
    body: JSON.stringify(payload),
  };
}

function ensureEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("SUPABASE_ANON_KEY");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

function authToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function supabaseFetch(path, options = {}, useServiceRole = true) {
  const key = useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.body && !(options.body instanceof Uint8Array) ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch (error) {
      body = text;
    }
  }

  if (!response.ok) {
    const message = body?.message || body?.error_description || body?.error || text || "Supabase request failed";
    const err = new Error(message);
    err.statusCode = response.status;
    err.details = body;
    throw err;
  }

  return body;
}

async function getUserFromJwt(token) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

function isWithinWindow(start, end) {
  const now = Date.now();
  const startsOk = !start || new Date(start).getTime() <= now;
  const endsOk = !end || new Date(end).getTime() >= now;
  return startsOk && endsOk;
}

async function getProfile(userId) {
  const rows = await supabaseFetch(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`
  );
  return rows?.[0] || null;
}

async function requireUser(event) {
  const missing = ensureEnv();
  if (missing.length) {
    return { error: json(500, { message: `Missing env: ${missing.join(", ")}` }) };
  }

  const token = authToken(event);
  if (!token) return { error: json(401, { message: "Missing authorization token" }) };

  const user = await getUserFromJwt(token);
  if (!user?.id) return { error: json(401, { message: "Invalid authorization token" }) };

  const profile = await getProfile(user.id);
  if (!profile || !profile.is_active || !isWithinWindow(profile.access_start, profile.access_end)) {
    return { error: json(403, { message: "User access is inactive or expired" }) };
  }

  return { token, user, profile };
}

async function requireAdmin(event) {
  const result = await requireUser(event);
  if (result.error) return result;

  if (result.profile.role !== "admin") {
    return { error: json(403, { message: "Admin access required" }) };
  }

  return result;
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw);
}

function safePathName(name) {
  return String(name || "document")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "document";
}

module.exports = {
  COURSE_DOCS_BUCKET,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  authToken,
  json,
  parseBody,
  requireAdmin,
  requireUser,
  safePathName,
  supabaseFetch,
};
