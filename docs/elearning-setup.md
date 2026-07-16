# DJAI Academy eLearning Setup

This site includes a Netlify + Supabase learning portal.

## 1. Create Supabase project

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Confirm Storage has a private bucket named `course-documents`.

## 2. Add Netlify environment variables

In Netlify project settings, add:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
COURSE_DOCS_BUCKET=course-documents
```

`SUPABASE_SERVICE_ROLE_KEY` must never be used in browser code. It is used only by Netlify Functions.

## 3. Create the first admin

In Supabase Authentication, create a user for the admin email.

Then run this SQL, replacing values:

```sql
insert into public.profiles (id, email, full_name, role, is_active)
select id, email, 'DJAI Admin', 'admin', true
from auth.users
where email = 'YOUR_ADMIN_EMAIL'
on conflict (id) do update
set role = 'admin',
    is_active = true,
    full_name = excluded.full_name;
```

## 4. Use the portal

- Student portal: `/learn` or `/learn.html`
- Admin portal: `/admin` or `/admin.html`

Admin can:

- Create course categories
- Create online courses
- Add more than one YouTube unlisted video per course
- Upload course documents to private Supabase Storage
- Create and manage users
- Active/inactive users
- Reset user passwords
- Set user access start and end dates
- Assign course access per user

## Recommended next phase

- Add payment integration and automatic course enrollment
- Add progress tracking per video
- Add quiz and certificate tables
- Add email invitation templates
- Add audit log for admin actions
