const { json, requireAdmin, supabaseFetch } = require("./_shared/supabase-admin");

function bangkokDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function listFromCounts(counts, label) {
  return [...counts.entries()]
    .map(([name, value]) => ({ [label]: name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, { message: "Method not allowed" }, { Allow: "GET" });
    }

    const admin = await requireAdmin(event);
    if (admin.error) return admin.error;

    const requestedDays = Number(new URLSearchParams(event.rawQuery || "").get("days") || 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - (days - 1));
    start.setUTCHours(0, 0, 0, 0);

    const visits = await supabaseFetch(
      `/rest/v1/website_visits?created_at=gte.${encodeURIComponent(start.toISOString())}&select=visitor_id,page_path,referrer_domain,device_type,created_at&order=created_at.desc&limit=10000`
    );

    const dayKeys = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      dayKeys.push(bangkokDateKey(date));
    }

    const daily = new Map(dayKeys.map((date) => [date, { date, views: 0, visitors: new Set() }]));
    const pages = new Map();
    const referrers = new Map();
    const devices = new Map();
    const visitorViews = new Map();

    visits.forEach((visit) => {
      const day = daily.get(bangkokDateKey(visit.created_at));
      if (day) {
        day.views += 1;
        day.visitors.add(visit.visitor_id);
      }
      pages.set(visit.page_path || "/", (pages.get(visit.page_path || "/") || 0) + 1);
      referrers.set(visit.referrer_domain || "direct", (referrers.get(visit.referrer_domain || "direct") || 0) + 1);
      devices.set(visit.device_type || "desktop", (devices.get(visit.device_type || "desktop") || 0) + 1);
      visitorViews.set(visit.visitor_id, (visitorViews.get(visit.visitor_id) || 0) + 1);
    });

    const today = bangkokDateKey(new Date());
    const uniqueVisitors = new Set(visits.map((visit) => visit.visitor_id));
    const returningVisitors = [...visitorViews.values()].filter((count) => count > 1).length;

    return json(200, {
      days,
      generated_at: new Date().toISOString(),
      summary: {
        unique_visitors: uniqueVisitors.size,
        page_views: visits.length,
        returning_visitors: returningVisitors,
        views_today: daily.get(today)?.views || 0,
      },
      daily: dayKeys.map((date) => ({
        date,
        views: daily.get(date).views,
        visitors: daily.get(date).visitors.size,
      })),
      top_pages: listFromCounts(pages, "path"),
      referrers: listFromCounts(referrers, "source"),
      devices: listFromCounts(devices, "device"),
    });
  } catch (error) {
    return json(error.statusCode || 500, { message: error.message || "Analytics report is unavailable" });
  }
};
