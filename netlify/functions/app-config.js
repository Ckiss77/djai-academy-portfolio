const { SUPABASE_ANON_KEY, SUPABASE_URL, json } = require("./_shared/supabase-admin");

exports.handler = async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json(500, { message: "Supabase public config is not set" });
  }

  return json(200, {
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  });
};
