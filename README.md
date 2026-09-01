# York Drop & Add

A course drop & add board for York University students: post what you're
dropping or what you need, get grouped by course, and message another student
directly. The app never touches your actual enrollment — you make the real
change yourself in REM (York's Registration and Enrolment Module).

Anyone can browse the board without an account. Signing in with a YorkU email
is only required to post a listing or message someone.

Plain HTML/CSS/JS, no build step. The Supabase JS client is loaded straight
from a CDN as an ES module, so you can upload this folder to Hostinger as-is.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project (free tier is enough to start).
2. Once it's created, open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the
   `profiles`, `listings`, `conversations`, and `messages` tables, the
   YorkU-email-only write policies, and turns on Realtime for `messages`.
3. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key (not the `service_role` key — never put that in
     client code)
4. Open [`js/supabaseClient.js`](js/supabaseClient.js) and paste those two
   values in for `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

## 2. Configure sign-in

Supabase's email magic link is on by default, but two settings need to match
where the site will actually live:

- **Authentication → URL Configuration → Site URL**: set to your real domain
  once you have it (e.g. `https://yourdomain.com`), `http://localhost:5500`
  or similar while testing locally.
- **Authentication → URL Configuration → Redirect URLs**: add every URL the
  app will be opened from (both your local test URL and the live domain) —
  magic links are refused if the return address isn't in this list.

No further auth setup needed — `is_yorku_email()` in the schema already
blocks anyone without a `@my.yorku.ca` / `@yorku.ca` address from posting a
listing or sending a message. Browsing the board and profile display names
is open to anyone, signed in or not; conversations stay private to their two
participants either way.

## 3. Try it locally

Any static file server works, e.g. from this folder:

```bash
npx serve .
```

(or just use your editor's "Open with Live Server"). Opening `index.html`
directly via `file://` will **not** work — ES modules require an actual
`http://` origin.

## 4. Deploy to Hostinger

This is a fully static site (HTML/CSS/JS only, no PHP, no Node, no build
step) — Hostinger just needs to serve the files:

1. In hPanel, open **File Manager** (or connect via FTP).
2. Upload the entire contents of this folder — `index.html`, `css/`, `js/`
   (you don't need `supabase/schema.sql` on the server, that's a one-time
   setup file) — into `public_html` (or a subdomain's folder if you're
   putting this on a subdomain).
3. Point your domain/subdomain at that folder if it isn't already, and make
   sure SSL is on (Hostinger auto-provisions a free certificate).
4. Go back to Supabase's Redirect URLs (step 2 above) and make sure your
   live domain is listed — magic links won't work until it is.

That's it — the site talks to Supabase directly from the browser, so
there's nothing else to run or keep alive on Hostinger's end.

## After every deploy that changes CSS or JS

Hostinger's CDN caches `css/styles.css` and `js/app.js` for **7 days**, but
`index.html` is never cached. That mismatch means a stale cached JS/CSS file
can end up served alongside fresh HTML — which can genuinely break the site
(an old script expecting an element the new HTML removed, for example).

Every HTML file loads these two files with a `?v=1` query string
(`css/styles.css?v=1`, `js/app.js?v=1`). **Whenever you change
`css/styles.css` or `js/app.js`, bump that number in every HTML file that
references it** — that changes the URL, which forces a fresh fetch instead
of waiting up to 7 days for the cache to expire on its own.

## What's deliberately not built yet

- Editing or closing your own listing once posted (you can still post a new
  one; old ones just sit there — worth adding once the core loop is proven).
- Any display-name customization UI (`profiles.display_name` defaults to the
  part of your email before `@`, but the column and its update policy are
  already there for when you want to add that screen).
- Notifications outside the app (email/push when someone messages you) —
  right now you only see a new message if you're on the DM screen.
