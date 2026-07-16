const { json, requireUser, supabaseFetch } = require("./_shared/supabase-admin");

function inWindow(start, end) {
  const now = Date.now();
  return (!start || new Date(start).getTime() <= now) && (!end || new Date(end).getTime() >= now);
}

exports.handler = async (event) => {
  try {
    const session = await requireUser(event);
    if (session.error) return session.error;

    if (event.httpMethod !== "GET") {
      return json(405, { message: "Method not allowed" }, { Allow: "GET" });
    }

    const access = await supabaseFetch(
      `/rest/v1/user_course_access?user_id=eq.${encodeURIComponent(session.user.id)}&select=*`
    );
    const courseIds = access
      .filter((item) => inWindow(item.access_start, item.access_end))
      .map((item) => item.course_id);

    if (!courseIds.length) {
      return json(200, { profile: session.profile, categories: [], courses: [], videos: [], documents: [] });
    }

    const filter = courseIds.map((id) => encodeURIComponent(id)).join(",");
    const [categories, courses, videos, documents] = await Promise.all([
      supabaseFetch("/rest/v1/course_categories?select=*&is_active=eq.true&order=sort_order.asc,name.asc"),
      supabaseFetch(`/rest/v1/courses?id=in.(${filter})&is_published=eq.true&select=*&order=sort_order.asc,title.asc`),
      supabaseFetch(`/rest/v1/course_videos?course_id=in.(${filter})&select=*&order=sort_order.asc,title.asc`),
      supabaseFetch(`/rest/v1/course_documents?course_id=in.(${filter})&select=id,course_id,title,file_name,file_size,content_type,sort_order&order=sort_order.asc,title.asc`),
    ]);

    return json(200, { profile: session.profile, categories, courses, videos, documents });
  } catch (error) {
    return json(error.statusCode || 500, { message: error.message, details: error.details || null });
  }
};
