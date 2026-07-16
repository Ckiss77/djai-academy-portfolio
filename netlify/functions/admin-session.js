const { json, requireAdmin } = require("./_shared/supabase-admin");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { message: "Method not allowed" }, { Allow: "GET" });
    }

    const admin = await requireAdmin(event);
    if (admin.error) return admin.error;

    return json(200, {
      authorized: true,
      profile: {
        id: admin.profile.id,
        email: admin.profile.email,
        full_name: admin.profile.full_name,
        role: admin.profile.role,
      },
    });
  } catch (error) {
    return json(error.statusCode || 500, { message: error.message });
  }
};
