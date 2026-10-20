# OneLineCinema Admin

Secure, standalone Next.js 16 admin app using the **same** Supabase project as OneLineCinema. Built for Columbia UI Design Week 6.

## Features

- Login with Google OAuth; **every admin data operation** requires a Supabase-admin allowlist check on the server and in Postgres.
- Overview: user, movie, review, draft and vote counts; engagement, top films, tone and AI model distribution.
- Users: view names, registered email, handle, reviews and admin status.
- Reviews: search/filter, create editorial review, update or delete published reviews (associated votes cascade on deletion).
- Votes: inspect individual upvotes/downvotes, timestamps, associated review and movie, read-only.
- No service role key is used or exposed in the client. Existing movie app RLS is not weakened.

## Setup

1. Install dependencies: `npm install` (this starter zip has no lockfile; commit the newly generated `package-lock.json` to GitHub).
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local` (see `.env.example`). Use the **original** project's public values.
3. **Already done in the connected Supabase project:** `supabase/admin_panel.sql` was applied and anonymous users were denied access to the administrator RPCs. Do not need to run the migration again for that project.
4. Sign in to the *original* movie app at least once using the intended administrator Google account. In Supabase SQL Editor, bootstrap that email (change the placeholder):

   ```sql
   INSERT INTO public.cinema_admin_members (user_id)
   SELECT id FROM auth.users WHERE email = 'YOUR_GOOGLE_LOGIN_EMAIL'
   ON CONFLICT (user_id) DO UPDATE SET enabled = true;
   ```

   Never give the web client write access to `cinema_admin_members`.
5. Add `https://YOUR-ADMIN-APP.vercel.app/auth/callback` to **Supabase → Authentication → URL Configuration → Redirect URLs**; add `http://localhost:3000/auth/callback` for local development.
6. `npm run dev`. Test both admin and non-admin users.
7. Create a **new GitHub repository** and upload this project to it. A separate Vercel project called **`onelinecinema-admin`** has already been created and its two `NEXT_PUBLIC_SUPABASE_*` environment variables have been set for production, preview and development. In Vercel, import/link the new repository to that **existing** project. Disable Vercel Deployment Protection while keeping the app's own Google + admin check.
8. Submit the commit-specific deployment URL of this admin app and the existing OneLineCinema app.

## Security design

The admin list is a separate, RLS-protected table. It has no authenticated or anon grants; changes are made only by the owner in SQL Editor. `cinema_is_admin`, `cinema_admin_snapshot`, and `cinema_admin_manage_review` are `SECURITY DEFINER` RPCs with empty `search_path`, revoked `PUBLIC` execution, explicit `authenticated` EXECUTE grants, and admin checks inside every sensitive call. We avoid broadening the existing `movie_reviews` public SELECT privileges to sensitive columns like `draft_id` or exposing voters.

## Notes

The Create action adds an **editorial/admin-created** review, labeled `admin-editor`; it does **not** claim AI generation. Existing AI-generated media can be read, updated, and deleted. To generate fresh reviews through AI, use OneLineCinema's existing generator.

Lists show up to 500 latest users and reviews, 1,000 movies/votes. Aggregate counts are complete. For a large production dataset, add pagination to the RPC.

## Deployment readiness

The application source has not yet been built or tested against Google OAuth in production. The Vercel project has been created but not deployed. Add your first admin user, connect the new repository, deploy, then test the protected routes.
