# Honeyleaf

A cozy scrapbook diary that lives on a desk. Write with fountain pens and
real handwriting fonts, tape in photos, stick on stickers and turn the
pages of a little leather journal. It's private: only people you invite can
sign in, and nobody (not even you, the admin) can read anyone else's diary.

Honeyleaf runs on ordinary shared web hosting such as **any Hostinger
plan**: just PHP and a MySQL database. No special server, no monthly
services, nothing loaded from other websites.

- [Put it on Hostinger](#put-it-on-hostinger) (about 20 minutes)
- [Invite friends](#invite-friends)
- [Updating Honeyleaf](#updating-honeyleaf)
- [Backups](#backups)
- [Locked out?](#locked-out)
- [If something goes wrong](#if-something-goes-wrong)
- [Working on Honeyleaf](#working-on-honeyleaf) (for developers)
- [Privacy and security](#privacy-and-security)
- [Licenses](#licenses)

---

## Put it on Hostinger

You need:

- a Hostinger hosting plan (any shared plan works) with a domain or
  subdomain, for example `diary.example.com`;
- the two Honeyleaf zips: **`honeyleaf-public_html.zip`** and
  **`honeyleaf_private.zip`** (from a release, or made with
  `npm run package`, see [Working on Honeyleaf](#working-on-honeyleaf)).

Everything below happens in **hPanel**, Hostinger's control panel, in your
browser. You won't need a command line.

### 1. Choose PHP 8.2 or newer

hPanel → **Advanced** → **PHP Configuration** → pick **PHP 8.2** (or newer)
→ **Update**.

### 2. Turn on HTTPS

hPanel → **Security** → **SSL** → make sure your domain has an SSL
certificate (Hostinger's free one is fine) and turn on **Force HTTPS**.

### 3. Make a database

hPanel → **Databases** → **MySQL Databases** → fill in a database name, a
username and a strong password → **Create**.

Write down the three things Hostinger shows you: the **database name**, the
**username** (both look like `u123456789_something`) and the **password**.

### 4. Upload the private folder

The private folder holds Honeyleaf's code, its settings and everyone's
photos. It must sit **next to** `public_html`, never inside it, so nothing in
it can be opened from the web.

1. hPanel → **Files** → **File Manager**.
2. Open `domains` → your domain. You'll see the `public_html` folder. Stay
   here (don't open `public_html`).
3. Click **Upload** and upload `honeyleaf_private.zip`.
4. Right-click the zip → **Extract** → extract here. You now have a folder
   `honeyleaf_private` beside `public_html`. Delete the zip.

```
domains/
└─ diary.example.com/
   ├─ honeyleaf_private/   ← here
   └─ public_html/
```

### 5. Fill in the settings

1. Open `honeyleaf_private`.
2. Right-click `config.sample.php` → **Copy** → name the copy `config.php`.
3. Right-click `config.php` → **Edit**, and fill in:
   - `db_name`, `db_user`, `db_pass`: the three things from step 3;
   - `setup_key`: a long phrase only you know (12 characters or more), for
     example `paper-lantern-maple-tea-7`. You'll type it once in step 7.
4. **Save**.

### 6. Upload the diary itself

1. Open `public_html`. If Hostinger put a `default.php` there, delete it.
2. **Upload** `honeyleaf-public_html.zip`, then right-click it → **Extract**
   → extract here. Delete the zip.

(Want the diary in a subfolder, like `example.com/diary`? Make a folder
`diary` inside `public_html` and extract there instead. Honeyleaf works out
where it lives by itself.)

### 7. Open your diary and set it up

Visit your address, for example `https://diary.example.com`. Honeyleaf
shows a **setup** note with a list of checks.

1. Every line should get a green tick. A red cross tells you what to fix
   (see [If something goes wrong](#if-something-goes-wrong)).
2. The **tables** don't exist yet: type your setup key and press
   **Create the tables for me**. (Prefer phpMyAdmin? Import
   `honeyleaf_private/schema.sql` into your database instead; it's the same.)
3. Press **Your key: the first account** and make your own account: your
   setup key, a username, your name and a password (10 characters or more).
4. Honeyleaf shows a **recovery code** like `7KQ2-M9XD-4TPA-W3HN`. Write it
   on paper and keep it somewhere safe. It's the only way back in if you
   forget your password. It is shown once.

Setup then switches itself off for good. Sign in, and the desk is yours.

### 8. (Optional) A daily tidy-up

Honeyleaf empties the wastebasket (things deleted more than 30 days ago)
by itself. If you like, also add a cron job: hPanel → **Advanced** →
**Cron Jobs** → **Custom**, once a day:

```
php /home/u123456789/domains/diary.example.com/honeyleaf_private/cron/cleanup.php
```

(Use your own path: File Manager shows it at the top when you open
`honeyleaf_private`.)

---

## Invite friends

There is no sign-up page: only you, the admin, can make accounts.

1. On your desk, click the **ring of brass keys**.
2. Fill in your friend's username, name and a **temporary password**, and
   make the key.
3. Tell your friend the address, their username and the temporary password.
   The first time they sign in, Honeyleaf asks them to pick their own.

On the key ring you can also give someone a new temporary password, sign
them out everywhere, switch an account off, set a storage limit, or delete
an account with everything in it. You can see names and storage used, but
never anyone's diary.

---

## Updating Honeyleaf

1. Make a backup first (see [Backups](#backups)).
2. Upload the new `honeyleaf-public_html.zip` into `public_html` and
   extract it, replacing the old files.
3. Upload the new `honeyleaf_private.zip` next to `public_html` and extract
   it, replacing the old files. Your `config.php` and the `uploads` folder
   (everyone's photos) are not in the zip, so they are left alone.
4. Open the diary. If the database needs changes, Honeyleaf makes them by
   itself on the first visit.

---

## Backups

- **Each person** can download their whole diary from the desk:
  **desk drawer** → **Backups** → **Download my whole diary**, a `.zip` with
  every page, photo and setting (or just one year). **Bring in a diary
  backup**, in the same drawer, adds such a file to a diary on any
  Honeyleaf, so it doubles as a way to move a diary.
- **The admin** can back up everything: Hostinger's own backups (hPanel →
  **Files** → **Backups**) cover both the database and the files. For a copy
  of your own, export the database in phpMyAdmin and download the folder
  `honeyleaf_private/uploads`.

Nothing is lost while you're writing, either: every change is kept in the
browser first and saved to the server a moment later. If the connection
drops, Honeyleaf keeps writing locally and sends everything once it's back.

---

## Locked out?

**A friend forgot their password:** on the key ring, give them a new
temporary password.

**You (the admin) forgot your password:** on the sign-in screen, choose
**I'm the admin and have my recovery code**, enter your username, the
recovery code and a new password. You get a new recovery code (write it
down again: each code works once).

**You lost the recovery code too:**

1. In File Manager, edit `honeyleaf_private/config.php` and set
   `admin_reset_token` to a long random phrase (16 characters or more).
2. On the sign-in screen, choose **I'm the admin and have my recovery
   code**, and type that phrase where it asks for the recovery code.
3. Set your new password and write down the new recovery code.
4. Edit `config.php` again and empty `admin_reset_token` (`''`). Each phrase
   works only once anyway.

---

## If something goes wrong

| What you see | What to do |
| --- | --- |
| A page saying *index.html is missing* | Extract `honeyleaf-public_html.zip` into `public_html` again. |
| *The honeyleaf_private folder was not found* | It must be next to `public_html` (step 4), named exactly `honeyleaf_private`. |
| A red cross on **PHP** | Choose PHP 8.2 or newer (step 1). |
| A red cross on **config.php found** | Copy `config.sample.php` to `config.php` (step 5). |
| A red cross on **Database connection** | Check `db_name`, `db_user` and `db_pass` in `config.php` against hPanel → Databases. |
| A red cross on **HTTPS** | Turn on SSL (step 2). Honeyleaf works without it, but your password would travel unprotected. |
| *That setup key is not right* | Type the `setup_key` from `config.php` exactly. |
| *Too many attempts* when signing in | Five wrong passwords lock that name for 15 minutes. Wait, then try again. |
| A photo won't upload | Photos up to 15 MB (JPEG, PNG, WebP or GIF) work; ask the admin if your storage is full. |
| *Something went wrong on the server* | hPanel → **Advanced** → **PHP Configuration** shows the error log; the details are there. |

---

## Working on Honeyleaf

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
```

**Just the front end** (no PHP needed: a pretend server lives inside the
dev server and keeps its data in `.tools/mock-db.json`):

```bash
npm run dev:mock
```

Open http://localhost:5173. The demo sign-in is at the top of
`scripts/dev/mock-api.mjs`.

**With the real PHP back end** you need PHP 8.2+ (with pdo_mysql, gd,
fileinfo, mbstring, zip, curl) and MySQL or MariaDB:

1. Copy `server/private/config.sample.php` to `server/private/config.php`
   and fill it in for your local database.
2. In one terminal: `npm run api` (the PHP API on port 8787).
3. In another: `npm run dev`, then open http://localhost:5173. The first
   visit runs the same setup as on Hostinger.

(On Windows, portable PHP and MariaDB can live in the git-ignored `.tools/`
folder; `scripts/dev/make-config.mjs` writes `config.php` from
`.tools/dev.json` and `npm run api` uses `.tools/php` when it's there.)

| Command | What it does |
| --- | --- |
| `npm run dev:mock` | Front end with a pretend API (no PHP) |
| `npm run dev` | Front end, talking to the PHP API on :8787 |
| `npm run api` | The PHP API on http://127.0.0.1:8787 |
| `npm test` | Unit tests (text flow, page turns, the book's layout) |
| `npm run test:api` | End-to-end API check on a throwaway database (`.tools/config.test.php`) |
| `npm run build` | Type-check and build the app into `dist/` |
| `npm run check` | No other sites, no system fonts, size budget, licenses |
| `npm run package` | Build, check, and make `upload/` with the two zips |
| `npm run assets` | Regenerate self-hosted fonts, textures and die-cut stickers |
| `npm run art` | Redraw the built-in desk art (SVG) from `scripts/art/` |

How it's put together: [docs/PLAN.md](docs/PLAN.md). The API between the
browser and PHP: [docs/API.md](docs/API.md).

---

## Privacy and security

- **Invite only.** No public sign-up; only the admin makes accounts, and
  setup switches itself off after the first one.
- **Each diary is its owner's alone.** Every row in the database belongs to
  one person and every request is checked against it. Photos are never
  public files: they're stored outside the website under random names and
  handed only to their owner's signed-in browser.
- **Nothing from other websites.** Fonts, art and code are all served by
  your own site. No CDNs, Google Fonts, analytics, trackers or embeds, and a
  strict Content-Security-Policy keeps it that way.
- **Careful sign-ins.** Passwords are hashed with Argon2id (bcrypt where
  that's missing). Sessions are long random tokens in HttpOnly, SameSite
  cookies, renewed at every sign-in, and every change needs a CSRF token.
  Wrong passwords and uploads are rate-limited. The diary locks itself
  after a while (you choose how long) and when you click the padlock.
- **Photos are cleaned.** Uploads are checked by their content, not their
  name, and re-saved by the server, which strips hidden details such as
  GPS location.

---

## Licenses

All built-in art (desk objects, stickers, washi tapes, papers, textures,
icons) is original and drawn in code in this repository. Fonts are
self-hosted from their open-license sources (SIL Open Font License or
Apache 2.0); code libraries are MIT or ISC. Their license texts ship with
the app in `honeyleaf_private/licenses/` (and in `licenses/` here after a
build).
