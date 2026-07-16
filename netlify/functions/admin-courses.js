const {
  COURSE_DOCS_BUCKET,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  json,
  parseBody,
  requireAdmin,
  safePathName,
  supabaseFetch,
} = require("./_shared/supabase-admin");

const TABLES = {
  category: "course_categories",
  course: "courses",
  video: "course_videos",
  document: "course_documents",
};

async function dashboardData() {
  const [categories, courses, videos, documents] = await Promise.all([
    supabaseFetch("/rest/v1/course_categories?select=*&order=sort_order.asc,name.asc"),
    supabaseFetch("/rest/v1/courses?select=*&order=sort_order.asc,title.asc"),
    supabaseFetch("/rest/v1/course_videos?select=*&order=sort_order.asc,title.asc"),
    supabaseFetch("/rest/v1/course_documents?select=*&order=sort_order.asc,title.asc"),
  ]);

  return { categories, courses, videos, documents };
}

async function upsert(table, payload) {
  const id = payload.id;
  const body = { ...payload };
  delete body.id;

  if (id) {
    await supabaseFetch(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    return;
  }

  await supabaseFetch(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
}

async function remove(table, id) {
  await supabaseFetch(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

async function uploadDocument(payload) {
  const content = String(payload.base64 || "").includes(",")
    ? String(payload.base64).split(",").pop()
    : String(payload.base64 || "");
  const buffer = Buffer.from(content, "base64");
  const fileName = safePathName(payload.file_name);
  const storagePath = `${payload.course_id}/${Date.now()}-${fileName}`;
  const contentType = payload.content_type || "application/octet-stream";

  const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${COURSE_DOCS_BUCKET}/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body: buffer,
  });

  if (!uploadResponse.ok) {
    throw new Error(await uploadResponse.text());
  }

  await supabaseFetch("/rest/v1/course_documents", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      course_id: payload.course_id,
      title: payload.title || fileName,
      file_name: fileName,
      storage_path: storagePath,
      content_type: contentType,
      file_size: buffer.length,
      sort_order: Number(payload.sort_order || 0),
    }),
  });
}

async function deleteDocument(payload) {
  const docs = await supabaseFetch(
    `/rest/v1/course_documents?id=eq.${encodeURIComponent(payload.id)}&select=*`
  );
  const doc = docs?.[0];

  if (doc?.storage_path) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${COURSE_DOCS_BUCKET}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [doc.storage_path] }),
    });
  }

  await remove(TABLES.document, payload.id);
}

exports.handler = async (event) => {
  try {
    const admin = await requireAdmin(event);
    if (admin.error) return admin.error;

    if (event.httpMethod === "GET") {
      return json(200, await dashboardData());
    }

    if (event.httpMethod !== "POST") {
      return json(405, { message: "Method not allowed" }, { Allow: "GET, POST" });
    }

    const body = parseBody(event);
    const action = body.action;
    const payload = body.payload || {};

    if (action === "upsertCategory") await upsert(TABLES.category, payload);
    else if (action === "deleteCategory") await remove(TABLES.category, payload.id);
    else if (action === "upsertCourse") await upsert(TABLES.course, payload);
    else if (action === "deleteCourse") await remove(TABLES.course, payload.id);
    else if (action === "upsertVideo") await upsert(TABLES.video, payload);
    else if (action === "deleteVideo") await remove(TABLES.video, payload.id);
    else if (action === "uploadDocument") await uploadDocument(payload);
    else if (action === "deleteDocument") await deleteDocument(payload);
    else return json(400, { message: "Unknown action" });

    return json(200, { ok: true, data: await dashboardData() });
  } catch (error) {
    return json(error.statusCode || 500, { message: error.message, details: error.details || null });
  }
};
