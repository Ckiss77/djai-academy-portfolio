let supabaseClientPromise;

async function createPortalClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = fetch("/.netlify/functions/app-config")
      .then(async (response) => {
        const config = await response.json();
        if (!response.ok) throw new Error(config.message || "Portal config is unavailable.");
        return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      });
  }

  return supabaseClientPromise;
}

async function currentSession(client) {
  const { data } = await client.auth.getSession();
  return data.session;
}

function authHeaders(session) {
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

function setStatus(element, message, type = "") {
  if (!element) return;
  element.textContent = message || "";
  element.classList.toggle("error", type === "error");
  element.classList.toggle("ok", type === "ok");
}

function youtubeEmbedUrl(url) {
  const text = String(url || "");
  const patterns = [
    /youtu\.be\/([\w-]+)/,
    /youtube\.com\/watch\?v=([\w-]+)/,
    /youtube\.com\/embed\/([\w-]+)/,
    /youtube\.com\/shorts\/([\w-]+)/,
  ];
  const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);
  return match ? `https://www.youtube.com/embed/${match[1]}` : text;
}

window.DJAI_PORTAL = {
  authHeaders,
  createPortalClient,
  currentSession,
  setStatus,
  youtubeEmbedUrl,
};
