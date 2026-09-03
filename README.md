# York Drop & Add

**A course drop & add board for York University students.**

York Drop & Add helps students find each other when one student is
dropping a course and another is looking for a seat.

Students can:

- Browse course listings without an account
- Post a course they're **Dropping**
- Post a course they **Need**
- Search and filter listings by course, term, subject, and campus
- Message other students directly
- Receive messages in real time
- Remove their own listings
- Change their display name
- Delete their account data

The platform does **not** modify course enrollment. It only helps students
find and communicate with each other. Any actual course change is completed
by the student through York University's Registration and Enrolment Module
(REM).

> **Independent student project — not affiliated with, operated by, or
> endorsed by York University.**

## Live site

**https://dropandadd.com/**

## How it works

1. **Post** — Tell other students which course you're dropping or need.
2. **Find a match** — Browse listings grouped by course.
3. **Connect** — Message another student with the opposite need.
4. **Change it in REM** — Coordinate the timing and make the official
   enrollment change yourself.

The board is public, but a YorkU email is required to post or message.

## Features

### Course listings

Listings can contain:

- Course
- Section
- Type — Dropping or Needed
- Term
- Campus
- Room
- Optional note

Listings are grouped by course so students looking for the same course can
quickly find each other.

### Search and filtering

The board supports searching and filtering by:

- Course
- Type
- Term
- Subject
- Campus

### YorkU-only posting and messaging

Browsing is open to everyone.

Posting and messaging require a valid York email address.

Authentication uses a passwordless sign-in flow with a one-time email link.
A short sign-in code is also available as a fallback on mobile.

### Real-time messaging

Students can have private conversations about listings.

Messages appear in real time without refreshing, and unread conversations
are indicated in the interface.

### Privacy

Other students see your display name, not your email address.

Conversations are private to their participants.

Users can also:

- Change their display name
- Remove their listings
- Delete their stored account data

See [Privacy](privacy.html) for details.

## Tech stack

- HTML
- CSS
- JavaScript
- Supabase
- Supabase Authentication
- Supabase PostgreSQL
- Supabase Realtime
- ES modules loaded from CDN

There is no build system, Node backend, PHP, or server-side application.

The frontend communicates directly with Supabase from the browser.

## Data model

The application uses four main database entities:

- `profiles` — user display information
- `listings` — course drop/need posts
- `conversations` — private conversations between students
- `messages` — messages belonging to conversations

Database access policies restrict posting and messaging to users who meet the
application's YorkU email requirements, while public browsing remains
available without authentication.

## Project structure

```text
.
├── index.html
├── about.html
├── faq.html
├── privacy.html
├── terms.html
├── how-it-works.pdf
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   └── supabaseClient.js
├── supabase/
│   └── schema.sql
├── robots.txt
├── sitemap.xml
└── README.md

