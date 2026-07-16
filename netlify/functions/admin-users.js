const { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, json, parseBody, requireAdmin, supabaseFetch } = require("./_shared/supabase-admin");

async function authAdmin(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(body?.message || body?.error_description || body?.error || "Supabase admin request failed");
  }

  return body;
}

async function listUsers() {
  const [authUsers, profiles, courses, access] = await Promise.all([
    authAdmin("/users"),
    supabaseFetch("/rest/v1/profiles?select=*&order=created_at.desc"),
    supabaseFetch("/rest/v1/courses?select=id,title,slug,is_published&order=title.asc"),
    supabaseFetch("/rest/v1/user_course_access?select=*"),
  ]);

  const users = Array.isArray(authUsers?.users) ? authUsers.users : [];

  return {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      profile: profiles.find((profile) => profile.id === user.id) || null,
      course_access: access.filter((item) => item.user_id === user.id),
    })),
    courses,
  };
}

async function syncAccess(userId, courseIds = [], accessStart = null, accessEnd = null) {
  await supabaseFetch(`/rest/v1/user_course_access?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });

  if (!courseIds.length) return;

  await supabaseFetch("/rest/v1/user_course_access", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(
      courseIds.map((courseId) => ({
        user_id: userId,
        course_id: courseId,
        access_start: accessStart || null,
        access_end: accessEnd || null,
      }))
    ),
  });
}

async function upsertProfile(userId, payload) {
  await supabaseFetch("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: userId,
      email: payload.email,
      full_name: payload.full_name || "",
      role: payload.role || "student",
      is_active: payload.is_active !== false,
      access_start: payload.access_start || null,
      access_end: payload.access_end || null,
    }),
  });
}

exports.handler = async (event) => {
  try {
    const admin = await requireAdmin(event);
    if (admin.error) return admin.error;

    if (event.httpMethod === "GET") {
      return json(200, await listUsers());
    }

    if (event.httpMethod !== "POST") {
      return json(405, { message: "Method not allowed" }, { Allow: "GET, POST" });
    }

    const body = parseBody(event);
    const action = body.action;
    const payload = body.payload || {};

    if (action === "createUser") {
      const created = await authAdmin("/users", {
        method: "POST",
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          email_confirm: true,
          user_metadata: { full_name: payload.full_name || "" },
        }),
      });
      const user = created.user || created;
      await upsertProfile(user.id, payload);
      await syncAccess(user.id, payload.course_ids || [], payload.access_start, payload.access_end);
    } else if (action === "updateUser") {
      await upsertProfile(payload.id, payload);
      await syncAccess(payload.id, payload.course_ids || [], payload.access_start, payload.access_end);
    } else if (action === "resetPassword") {
      await authAdmin(`/users/${encodeURIComponent(payload.id)}`, {
        method: "PUT",
        body: JSON.stringify({ password: payload.password }),
      });
    } else if (action === "setActive") {
      await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(payload.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: payload.is_active === true }),
      });
    } else {
      return json(400, { message: "Unknown action" });
    }

    return json(200, { ok: true, data: await listUsers() });
  } catch (error) {
    return json(error.statusCode || 500, { message: error.message, details: error.details || null });
  }
};
