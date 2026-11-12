# LevelUp: your life as an RPG

A free web app that turns your day into XP. It runs on iPhone, iPad and Mac from the home screen or Dock, works offline, and can optionally sync between your devices.

- **Character sheet**: overall level, **HP** (max 100) and **Gold**, plus five attributes: 💪 STR (Physique), 🧠 INT (Knowledge), 🎨 TECH (Creative), 🎥 CHA (Brand), 💰 CRED (Wealth)
- **Daily Dungeon**: time-gated quests that unlock and lock with the clock (Mon–Fri). Clear them for XP, Gold and HP; miss the Iron Dungeon and lose HP.
- **Side quests**: flexible daily goals you set yourself, with a streak. Each can run on specific days, so rest days don't break it.
- **Debt bosses**: each debt's balance is its HP and every payment is an attack. +500 XP when one goes down.
- **Gig and IT shifts** (DoorDash, Spark Driver, LanceSoft), with $/hour
- **NASM** exam countdown and quiz-score chart (70% is the passing line)
- **Art** daily anime drawing prompt and a focus breakdown · **Content** shoots and edits
- **Gym** workouts and a PR board · **Food** calories and protein vs. your targets
- **Stats**: 14-day XP chart, attributes and 19 achievements

## The Daily Dungeon

Each quest only counts if you log it **during its window** (or up to 60 minutes after it closes). Weekends are rest days.

| Window (Mon–Thu) | Quest | Clear it by logging | Reward | Miss |
|---|---|---|---|---|
| 5:00–7:30 AM | 🏋️ The Iron Dungeon | a workout | +50 STR, +10 Gold | −15 HP |
| 9:30 AM–2:00 PM | 🚗 The Hustle Wastes | a gig shift | +25 CRED (+1 Gold per $1 earned) | |
| 2:00–6:00 PM | 🖥️ IT Headquarters | an IT shift | +25 CRED | |
| 6:30–7:30 PM | 🎬 The Creator's Studio | 30 min drawing **or** 30 min content | +30 TECH or +30 CHA | |
| 7:30–8:30 PM | 🍺 Tavern Rest | a gaming session | Mental Reset: +5% XP tomorrow | |

- **Fridays**: IT Headquarters moves to 9:00 AM–2:00 PM and the Hustle Wastes to 2:30–7:00 PM.
- **Stealth Mission**: during the IT shift, log NASM study with the 🥷 toggle on. Once you've logged 2 hours in that shift, all of it earns **1.5× INT**.
- Every quest cleared heals **+5 HP**. HP never goes above 100.
- Schedules, rewards and penalties live in `js/dungeon.js`.

## Levels and Gold

- XP needed for each level is `100 × level^1.5`: 100 for level 1→2, 282 for 2→3, 3,162 for 10→11. Early levels fly by; later ones are a grind. Attributes level up on the same curve.
- **Gold**: +1 per $1 earned driving and +1 per $1 of debt paid off. In the Loot Shop (coming next), **10 Gold = $1** of real-world spending, so a $50 hoodie costs 500 Gold.
- All of these numbers live in `js/rpgMath.js`.

## How XP works

| Activity | XP | Attribute |
|---|---|---|
| Study session | 2 per minute (×1.5 on a Stealth Mission) | INT |
| Practice quiz | 20 + half your score | INT |
| Drawing session | 2 per minute | TECH |
| Content session (shoot / edit) | 2 per minute | CHA |
| Workout | 30 + 2 per minute | STR |
| Personal record | 75 | STR |
| Meal logged | 10 | STR |
| Gig shift | 1 per $2 earned + 5 per hour | CRED |
| IT shift | 10 per hour | CRED |
| Debt payment | 1 per $2 paid | CRED |
| Each side quest cleared | +25 | that quest's skill |
| All of today's side quests cleared | +100 | overall only |
| Protein goal hit | +40 | STR |
| Debt boss defeated | +500 | CRED |

XP, HP and Gold are always recalculated from your logs, so you can tweak any number in `js/game.js`, `js/dungeon.js` or `js/rpgMath.js` and your whole history re-scores.

---|---|
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
| `js/rpgMath.js` | XP curve, Gold economy, HP and multipliers |
| `js/dungeon.js` | The Daily Dungeon schedule and time-gating |
| `js/game.js` | Attributes, skills, XP rules, side quests, streaks, achievements; builds your character from your logs |
| `js/questboard.js` | The Daily Dungeon quest board |
| `js/sync.js` | Optional Supabase sync |
| `js/app.js` | Navigation, layout, level-up celebrations |
| `js/pages.js`, `js/settings.js`, `js/logsheet.js`, `js/components.js` | The screens |
| `vendor/preact-htm.js` | Tiny UI library (Preact + htm), bundled so no build step is needed |
