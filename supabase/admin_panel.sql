-- OneLineCinema Week 6: private admin grants without weakening public app RLS.
-- Run once in the SAME Supabase project as the original movie application.
BEGIN;

CREATE TABLE IF NOT EXISTS public.cinema_admin_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cinema_admin_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cinema_admin_members FROM anon, authenticated;
-- No client-readable or client-writable policies on this role table.

CREATE OR REPLACE FUNCTION public.cinema_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (auth.uid() IS NOT NULL) AND EXISTS (
    SELECT 1 FROM public.cinema_admin_members a
    WHERE a.user_id = auth.uid() AND a.enabled IS TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.cinema_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cinema_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.cinema_admin_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE output jsonb;
BEGIN
  IF NOT public.cinema_is_admin() THEN
    RAISE EXCEPTION 'Admin permission required' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'stats', jsonb_build_object(
      'users', (SELECT count(*) FROM auth.users),
      'profiles', (SELECT count(*) FROM public.movie_public_profiles),
      'movies', (SELECT count(*) FROM public.movies),
      'reviews', (SELECT count(*) FROM public.movie_reviews),
      'drafts', (SELECT count(*) FROM public.movie_review_drafts),
      'upvotes', (SELECT count(*) FROM public.movie_review_votes WHERE value = 1),
      'downvotes', (SELECT count(*) FROM public.movie_review_votes WHERE value = -1)
    ),
    'users', (
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT u.id, u.email, u.created_at,
          trim(concat_ws(' ', p.first_name, p.last_name)) as display_name,
          coalesce(mp.handle, '') as handle,
          coalesce(mp.bio, '') as bio,
          EXISTS(SELECT 1 FROM public.cinema_admin_members a WHERE a.user_id = u.id AND a.enabled) as is_admin,
          (SELECT count(*) FROM public.movie_reviews r WHERE r.user_id = u.id) as review_count
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
        LEFT JOIN public.movie_public_profiles mp ON mp.user_id = u.id
        ORDER BY u.created_at DESC LIMIT 500
      ) x
    ),
    'movies', (
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.title), '[]'::jsonb)
      FROM (SELECT id, title, release_year, genres FROM public.movies ORDER BY title LIMIT 1000) x
    ),
    'reviews', (
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT r.id, r.movie_id, r.one_liner, r.tone, r.created_at,
          m.title as movie_title, r.user_id,
          coalesce(mp.handle, '') as author_handle,
          coalesce(rv.upvotes, 0) as upvotes,
          coalesce(rv.downvotes, 0) as downvotes,
          coalesce(d.model, 'unknown') as model
        FROM public.movie_reviews r
        JOIN public.movies m ON m.id = r.movie_id
        LEFT JOIN public.movie_public_profiles mp ON mp.user_id = r.user_id
        LEFT JOIN public.movie_review_drafts d ON d.id = r.draft_id
        LEFT JOIN LATERAL (
          SELECT count(*) FILTER (WHERE value = 1) upvotes,
                 count(*) FILTER (WHERE value = -1) downvotes
          FROM public.movie_review_votes v WHERE v.review_id = r.id
        ) rv ON true
        ORDER BY r.created_at DESC LIMIT 500
      ) x
    ),
    'votes', (
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT v.review_id, v.user_id, v.value, v.created_at,
          coalesce(mp.handle, '') as voter_handle,
          r.one_liner, m.title as movie_title
        FROM public.movie_review_votes v
        JOIN public.movie_reviews r ON r.id = v.review_id
        JOIN public.movies m ON m.id = r.movie_id
        LEFT JOIN public.movie_public_profiles mp ON mp.user_id = v.user_id
        ORDER BY v.created_at DESC LIMIT 1000
      ) x
    ),
    'draft_summary', (
      SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      FROM (SELECT model, tone, count(*) as count
            FROM public.movie_review_drafts GROUP BY model,tone ORDER BY count(*) DESC) x
    )
  ) INTO output;
  RETURN output;
END;
$$;
REVOKE ALL ON FUNCTION public.cinema_admin_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cinema_admin_snapshot() TO authenticated;

CREATE OR REPLACE FUNCTION public.cinema_admin_manage_review(
  p_action text,
  p_review_id uuid DEFAULT NULL,
  p_movie_id bigint DEFAULT NULL,
  p_one_liner text DEFAULT NULL,
  p_tone text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  new_draft_id uuid;
  out_review_id uuid;
BEGIN
  IF NOT public.cinema_is_admin() THEN
    RAISE EXCEPTION 'Admin permission required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('create','update','delete') OR p_action IS NULL THEN
    RAISE EXCEPTION 'Invalid action' USING ERRCODE = '22023';
  END IF;
  IF p_action IN ('create','update') THEN
    IF p_one_liner IS NULL OR char_length(btrim(p_one_liner)) NOT BETWEEN 1 AND 160 THEN
      RAISE EXCEPTION 'Review must be 1-160 characters' USING ERRCODE = '22023';
    END IF;
    IF p_tone IS NULL OR p_tone NOT IN ('Witty','Serious','Poetic','Sarcastic') THEN
      RAISE EXCEPTION 'Invalid tone' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_action = 'create' THEN
    IF p_movie_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.movies WHERE id = p_movie_id) THEN
      RAISE EXCEPTION 'Movie not found' USING ERRCODE = '22023';
    END IF;
    -- Admin creates an explicitly labeled editorial review; it is NOT mislabeled as an AI output.
    INSERT INTO public.movie_review_drafts
      (movie_id, user_id, impression, tone, spoiler_free, candidates, model, published_at)
    VALUES
      (p_movie_id, auth.uid(), 'Created by the administrator in the editorial console.',
       p_tone, true, ARRAY[btrim(p_one_liner), '', '']::text[], 'admin-editor', now())
    RETURNING id INTO new_draft_id;
    INSERT INTO public.movie_reviews(draft_id, movie_id, user_id, one_liner, tone)
      VALUES(new_draft_id, p_movie_id, auth.uid(), btrim(p_one_liner), p_tone)
      RETURNING id INTO out_review_id;
  ELSIF p_action = 'update' THEN
    IF p_review_id IS NULL THEN RAISE EXCEPTION 'Review ID required'; END IF;
    UPDATE public.movie_reviews SET one_liner = btrim(p_one_liner), tone = p_tone
      WHERE id = p_review_id RETURNING id INTO out_review_id;
    IF out_review_id IS NULL THEN RAISE EXCEPTION 'Review not found'; END IF;
  ELSE
    IF p_review_id IS NULL THEN RAISE EXCEPTION 'Review ID required'; END IF;
    DELETE FROM public.movie_reviews WHERE id = p_review_id RETURNING id INTO out_review_id;
    IF out_review_id IS NULL THEN RAISE EXCEPTION 'Review not found'; END IF;
  END IF;
  RETURN jsonb_build_object('id', out_review_id, 'action', p_action);
END;
$$;
REVOKE ALL ON FUNCTION public.cinema_admin_manage_review(text,uuid,bigint,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cinema_admin_manage_review(text,uuid,bigint,text,text) TO authenticated;
COMMIT;

-- Bootstrap your OWN user once, using SQL Editor (never from the web app):
-- INSERT INTO public.cinema_admin_members (user_id)
-- SELECT id FROM auth.users WHERE email = 'YOUR_GOOGLE_LOGIN_EMAIL'
-- ON CONFLICT (user_id) DO UPDATE SET enabled = true;
