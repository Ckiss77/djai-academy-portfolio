const {
  COURSE_DOCS_BUCKET,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  json,
  parseBody,
  requireUser,
  supabaseFetch,
} = require("./_shared/supabase-admin");

function inWindow(start, end) {
  const now = Date.now();
  return (!start || new Date(start).getTime() <= now) && (!end || new Date(end).getTime() >= now);
}

exports.handler = async (event) => {
  try {
    const session = await requireUser(event);
    if (session.error) return session.error;

    if (event.httpMethod !== "POST") {
      return json(405, { message: "Method not allowed" }, { Allow: "POST" });
    }

    const body = parseBody(event);
    const docs = await supabaseFetch(
      `/rest/v1/course_documents?id=eq.${encodeURIComponent(body.document_id)}&select=*`
    );
    const doc = docs?.[0];
    if (!doc) return json(404, { message: "Document not found" });

    const access = await supabaseFetch(
      `/rest/v1/user_course_access?user_id=eq.${encodeURIComponent(session.user.id)}&course_id=eq.${encodeURIComponent(doc.course_id)}&select=*`
    );

    if (!access.some((item) => inWindow(item.access_start, item.access_end))) {
      return json(403, { message: "You do not have access to this document" });
    }

    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${COURSE_DOCS_BUCKET}/${doc.storage_path}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 120 }),
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Could not create document link");

    const signedUrl = payload.signedURL?.startsWith("http")
      ? payload.signedURL
      : `${SUPABASE_URL}/storage/v1${payload.signedURL}`;

    return json(200, { signedUrl, fileName: doc.file_name });
  } catch (error) {
    return json(error.statusCode || 500, { message: error.message, details: error.details || null });
  }
};
