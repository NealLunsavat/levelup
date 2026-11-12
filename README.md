# LevelUp: your life as an RPG

A free web app that turns your day into XP. It runs on iPhone, iPad and Mac from the home screen or Dock, works offline, and can optionally sync between your devices.

- **Overall level + 5 skill trees**: 💰 Finance, 📚 NASM, 🎨 Art, 🏋️ Strength, 🥗 Nutrition, plus any custom skills you add
- **Daily quests** with a streak. Each quest can run on specific days, so rest days don't break it.
- **Debt bosses**: each debt's balance is its HP and every payment is an attack. +500 XP when one goes down.
- **Gig earnings** for DoorDash and Spark Driver, with $/hour
- **NASM** exam countdown and quiz-score chart (70% is the passing line)
- **Art** daily anime drawing prompt and a focus breakdown that shows what you're neglecting
- **Gym** workouts and a PR board · **Food** calories and protein vs. your targets
- **Stats**: 14-day XP chart and 19 achievements

## How XP works

| Activity | XP |
|---|---|
| Study / drawing session | 2 per minute |
| Workout | 30 + 2 per minute |
| Personal record | 75 |
| Gig shift | 1 per $2 earned + 5 per hour |
| Debt payment | 1 per $2 paid |
| Practice quiz | 20 + half your score |
| Meal logged | 10 |
| Each daily quest cleared | +25 |
| All of today's quests cleared | +100 |
| Protein goal hit | +40 |
| Debt boss defeated | +500 |

XP is always recalculated from your logs, so you can tweak any number in `js/game.js` and your whole history re-scores.

---

## 1. Put it online (free, about 5 minutes)

An iPhone can only install a web app from an `https://` address, so the folder needs a free host. The easiest is **GitHub Pages**:

1. Make a free account at github.com and create a **new repository** (e.g. `levelup`).
2. Upload everything in this `levelup` folder (drag the files into "Add file → Upload files"). You don't need `serve.py` or this README.
3. In the repo go to **Settings → Pages**, set *Source* to "Deploy from a branch", choose `main` and `/ (root)`, and save.
4. After a minute your app is live at `https://<your-username>.github.io/levelup/`.

The code is public on a free GitHub plan, but your **data is not**. It lives on your devices (and in your own Supabase project if you turn on sync).

> Other free options: Netlify Drop (drag the folder onto app.netlify.com/drop) or Cloudflare Pages.

## 2. Install it

- **iPhone / iPad**: open the link in Safari → Share button → **Add to Home Screen**.
- **Mac**: open it in Safari → File → **Add to Dock**. (In Chrome: the install icon in the address bar.)

It opens full-screen like a normal app and works offline.

## 3. Sync between devices (optional, free)

Without sync, each device keeps its own separate progress. To share one save across your iPhone, iPad and Mac:

1. Create a free project at **supabase.com** (any name and region; save the database password somewhere).
2. Open **SQL Editor → New query**, paste the contents of `supabase.sql`, and click **Run**.
3. Go to **Project Settings → API** (or "API Keys") and copy the **Project URL** and the **anon / publishable** key. *Never* use the `service_role` / secret key.
4. In LevelUp, open **Settings → Sync across devices**, paste both values, and tap **Connect**.
5. Tap **Create account** with your email and a password. Confirm the email Supabase sends you, then **Sign in**.
6. On each other device: paste the same URL and key, then **Sign in** with the same email.

Sync runs automatically a couple of seconds after each change, whenever you open the app, and every 5 minutes.

Good to know:
- Free Supabase projects **pause after about a week with no activity**. If you take a break, open the Supabase dashboard and click *Restore*; your data is still there.
- Use **Settings → Export backup** now and then. It's your safety net either way.
- If your phone is offline, everything still works and syncs when you're back online.

---

## Making changes

- Run it locally: `python3 serve.py`, then open http://localhost:8123
- Game balance (XP values, level curve, achievements): `js/game.js`
- Default quests and targets: `DEFAULTS` in `js/store.js`
- **After changing any file, bump `CACHE` in `sw.js`** (e.g. `levelup-v2`) and re-upload. Installed copies update the next time they're opened online.

## Files

| File | What it does |
|---|---|
| `index.html`, `manifest.webmanifest`, `icons/` | The page and its home-screen app identity |
| `sw.js` | Offline support (service worker) |
| `js/store.js` | Saves everything on the device; mergeable records for sync |
| `js/game.js` | Skills, XP rules, levels, quests, streaks, achievements |
| `js/sync.js` | Optional Supabase sync |
| `js/app.js` | Navigation, layout, level-up celebrations |
| `js/pages.js`, `js/settings.js`, `js/logsheet.js`, `js/components.js` | The screens |
| `vendor/preact-htm.js` | Tiny UI library (Preact + htm), bundled so no build step is needed |
