# DJAI Academy Website Analytics

The website records a small, anonymous visit event on public pages only. It does not save names, emails, form content, or IP addresses. Visitors who enable the browser's Do Not Track setting are not counted.

## One-time database setup

1. In Supabase, open **SQL Editor** for the `djai-academy-lms` project.
2. Create a new query.
3. Open `supabase/analytics.sql` from this repository, paste its contents, and click **Run**.

After Netlify deploys the site, new public page views will appear in **Admin Portal > Analytics**. Existing LMS and Admin Portal screens are excluded from tracking.
The small number beneath **DJAI Academy** in the website footer shows the all-time count of unique anonymous visitors.

## What the dashboard shows

- Unique anonymous visitors and page views for 7, 30, or 90 days
- Returning visitors and views today
- Daily traffic trend
- Most visited pages, referrer domains, and device categories
