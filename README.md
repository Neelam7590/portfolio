# Neelam Dhiman — Portfolio

Personal portfolio website. Static HTML, CSS and JavaScript, with one small
serverless function for the contact form. No framework, no build step, no
`npm install` to view it.

**Live site:** deployed on Vercel · **Contact:** neelamdhiman7590@gmail.com

---

## What is here

```
index.html        markup for every section
style.css         all styling; design tokens live in the :root block at the top
script.js         all behaviour, in 18 numbered sections
api/contact.js    Vercel serverless function -> forwards the form to Resend
assets/           photo and project screenshots
```

### Sections

Home · About · Journey (timeline) · Skills · Education & Toolkit · Projects ·
Vision · Contact

### Projects section

Projects are declared in one array at the top of `script.js` and rendered from
it, so adding a project means adding one object — no markup to touch.

Each project supports:

| Field | What it does |
| --- | --- |
| `title`, `tag`, `description` | The card's heading, category badge and intro |
| `features` | The "Key Features" list |
| `stack` | Technology chips |
| `images` | Screenshots, loaded one by one. Files that are missing are skipped, and the card falls back to a placeholder — so screenshots can be added gradually |
| `links` | One or more buttons, e.g. a live site and a GitHub repo |
| `aspect`, `fit` | Shape of the screenshot box. Set `fit: "contain"` for website screenshots so nothing is cropped |

Only the first `PROJECTS_PREVIEW` projects are shown at once; the rest sit
behind a **Show More** button. Opening it deliberately does not scroll the
page, and closing it returns you to the same position.

### Screenshots

Screenshots open full screen on click (or `Esc`, the arrows, or a click
outside to dismiss) and can be dragged or trackpad-swiped left and right.

---

## Running it locally

Open `index.html` in a browser. That is enough for everything except the
contact form.

The form posts to `/api/contact`, which only exists once the site is running on
Vercel. Locally it will fail and the form will offer a direct email link
instead — which is the intended fallback.

---

## Deploying (Vercel)

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project** → pick the repo.
   Vercel detects everything; leave build command empty.
3. Add the environment variable **Settings → Environment Variables**:

   | Key | Value |
   | --- | --- |
   | `RESEND_API_KEY` | your key from [resend.com/api-keys](https://resend.com/api-keys) |

   Tick both **Production** and **Preview**, then redeploy.
4. Submit the contact form once to confirm mail arrives.

Optional variables: `MAIL_TO` (defaults to the address above) and `MAIL_FROM`
(defaults to `Portfolio <onboarding@resend.dev>`).

---

## Contact form

The form runs entirely through Vercel functions and Resend — no third-party
form service.

```
browser  ->  POST /api/contact  ->  api/contact.js  ->  Resend  ->  your inbox
```

Protections on the endpoint, because a public form endpoint is an open door
otherwise:

- **Rate limiting** — 5 submissions per IP per 10 minutes
- **Honeypot** — a hidden field only automated form-fillers fill in
- **Server-side validation** — never trust the browser
- **HTML escaping** — visitor input is escaped before it goes into the email
- **Length caps** on every field
- **API key stays server-side** — it is never exposed to the browser
- **Graceful failure** — if anything goes wrong the visitor is shown a direct
  email address instead of a dead end

---

## Accessibility

Semantic landmarks and a single `h1`, labelled form fields with live-region
errors, visible focus rings, keyboard support throughout (including Escape and
arrow keys in the screenshot viewer and carousel), a focus trap in the mobile
menu, and respect for `prefers-reduced-motion`.

## Browser support

Modern evergreen browsers. Uses `IntersectionObserver`, CSS custom properties,
`aspect-ratio`, `clamp()` and pointer events.