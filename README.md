# LevelUp: your life as an RPG

A free web app that turns your day into XP. It runs on iPhone, iPad and Mac from the home screen or Dock, works offline, and can optionally sync between your devices.

- **Character sheet**: overall level, **HP** (max 100) and **Gold**, plus five attributes: 💪 STR (Physique), 🧠 INT (Knowledge), 🎨 TECH (Creative), 🎥 CHA (Brand), 💰 CRED (Wealth)
- **Daily Dungeon**: time-gated quests that unlock and lock with the clock (Mon–Fri). Clear them for XP, Gold and HP; miss the Iron Dungeon and lose HP.
- **Main Quest**: one high-stakes task a day, due by 9 PM
- **Daily quests**: flexible daily goals you set yourself, with a streak. Each can run on specific days, so rest days don't break it.
- **Weekly quests**: bigger goals that reset every Monday; many track themselves from your logs
- **Critical hits, Overdrive and the Bounty Board**: surprise double rewards, a 2× XP mode for perfect days, and micro-bounties during IT downtime
- **Debt bosses**: each debt's balance is its HP and every payment is an attack. +500 XP when one goes down.
- **Gig and IT shifts** (DoorDash, Spark Driver, LanceSoft), with $/hour
- **NASM** exam countdown and quiz-score chart (70% is the passing line)
- **Art** daily anime drawing prompt and a focus breakdown · **Content** shoots and edits
- **Gym** workouts and a PR board · **Food** calories and protein, or a daily MacroFactor check-in
- **Stress & Cyberpsychosis**: a burnout meter driven by your bedtime and rest days
- **NASM Ambush**: surprise pop-quiz encounters during your IT shift
- **Career Skill Tree**: Certified → The Floor → Book of Business → The 8-Week Program, each unlocking daily career quests
- **Loot Shop**: spend Gold on real things from your wishlist (10 Gold = $1)
- **Goals**: final goals broken into a ranked hit list of sub-goals, with a prime target on Home
- **Stats**: 14-day XP chart, attributes, stress log and 28 achievements

## The Daily Dungeon

Each quest only counts if you log it **during its window** (or up to 60 minutes after it closes). Weekends are rest days.

| Window (Mon–Thu) | Quest | Clear it by logging | Reward | Miss |
|---|---|---|---|---|
| 5:00–7:30 AM | 🏋️ The Iron Dungeon | a workout | +50 STR, +10 Gold | −15 HP |
| 9:30 AM–2:00 PM | 🚗 The Hustle Wastes | a gig shift | +25 CRED (+1 Gold per $1 earned) | |
| 2:00–6:00 PM | 🖥️ IT Headquarters | an IT shift | +25 CRED | |
| 6:30–7:30 PM | 🎬 The Creator's Studio | 30 min drawing **or** 30 min content | +30 TECH or +30 CHA | |
| 7:30–8:30 PM | 🍺 Tavern Rest | a gaming session | Mental Reset: +5% XP tomorrow | |
| 8:00–9:00 PM (Sun–Thu) | 🎒 Inventory Management | ticking all three prep items | +10 HP, Save State: +5% XP in tomorrow's Iron Dungeon | |

- **Fridays**: IT Headquarters moves to 9:00 AM–2:00 PM and the Hustle Wastes to 2:30–7:00 PM.
- **Stealth Mission**: during the IT shift, log NASM study with the 🥷 toggle on. Once you've logged 2 hours in that shift, all of it earns **1.5× INT**.
- Every quest cleared heals **+5 HP**. HP never goes above 100.
- Schedules, rewards and penalties live in `js/dungeon.js`.

## Quests by the day and the week

- **⭐ Main Quest**: the single most important thing today, set the night before (or that morning). Clear it by **9:00 PM** for **+300 XP and +50 Gold**; miss the deadline and it costs **25 HP**. One per day.
- **Daily quests**: your flexible daily goals (edit them in Settings). Clearing every one scheduled keeps your streak.
- **Weekly quests** reset every Monday. Each one either counts your taps or **tracks itself** from what you log (workout splits, drawing sessions tagged Faces/Angles/Proportions, practice quizzes at 80%+, $ earned driving, IT shifts, perfect nutrition days...). When one is complete, tap **Claim**. Claimed rewards are saved permanently, so changing or deleting a quest later never takes XP back. Edit them in Settings → Weekly quests.
- **🎯 Bounty Board**: appears on Home only during your IT shift. Small, specific micro-tasks worth +20 XP each, once per shift. Edit them in Settings → Micro-bounties.

## Momentum mechanics

- **⚡ Critical hits**: every log has a 1 in 10 chance to crit for **double XP and Gold**, revealed with a gold banner when you save. Weekly claims, bounties and career quests can crit too. The roll is tied to the entry's id, so it never changes afterwards.
- **⚡ Sandevistan Overdrive**: clear the Iron Dungeon, Hustle Wastes, IT Headquarters and Creator's Studio in one day and everything you earn for the rest of that day is **2× XP**, with the whole app shifting to an amber theme until midnight.
- **💾 Save State**: finishing Inventory Management the night before gives +5% XP in the next morning's Iron Dungeon (the checklist items live in `js/dungeon.js`).
- The numbers are in `js/rpgMath.js` (`CRIT_CHANCE`, `OVERDRIVE_MULTIPLIER`, `MAIN_QUEST_XP`, `MAIN_QUEST_PENALTY`...).

## Goals: operations and the hit list

Each final goal is an **operation**. You break it into **targets** (sub-goals) and rank them in a stack: #1 is the **prime target**, then "on deck", then "queued". The Goals tab also holds the Career tree (switch at the top of the page).

| Target type | How it's measured |
|---|---|
| 💳 Debt | Linked to a debt boss. Its balance is the target's HP, and every payment you log is an attack. |
| 📈 Number | A number to reach (dollars saved, hours, pounds...). Update it with **+ Progress**. |
| ✅ Milestone | Done or not done. |

- **Ranking**: debts rank themselves by **interest cost** (balance × APR ÷ 12, shown as ≈ $/month on each card), highest first. New debts slot in automatically, and 🔥 Most interest re-ranks with today's balances. You can also sort by highest APR or smallest balance, or move targets by hand with ▲▼ (that switches the list to manual).
- Balances, payments and APRs accept cents (up to 2 decimal places), and payoffs are matched to the exact cent.
- **Rewards**: +150 XP per target, **+100 more if it was the prime target** when it fell (everything ranked above it was already cleared), and +1,000 XP for finishing the operation. Debt targets still pay the usual debt-boss XP and Gold too.
- **Operation progress**: when every target is money, it's dollars cleared out of the total (so four cards adding up to $8,000 show as one $8,000 goal). Otherwise it's the average of the targets.
- **Optional extras**: a deadline (shows a countdown and the pace needed to finish on time) and a reward you're promising yourself.
- The prime target of each operation shows on Home with a one-tap **Attack / + Progress / Done** button.
- Numbers live in `js/rpgMath.js` (`TARGET_XP`, `PRIME_BONUS_XP`, `OPERATION_XP`).

## Look and feel

- **Themes** (Settings → This device). *Auto* follows your day: 🩸 Iron Dungeon (red/black) from 5:00 AM, ☀️ Daylight (bright, readable in the car) from 9:30 AM, 🌃 Night City (cyan/purple) from 8:00 PM. You can also lock in any theme, including the original ⚡ Neon.
- **Sound effects** are synthesized retro blips (no audio files) for logs, quests, ambushes, purchases and a fanfare for level-ups. They respect the iPhone's silent switch and mix with your music.
- **Haptics**: a tap you can feel on iPhone (iOS 18+; iPhones have no vibration API for web apps, so this uses the native switch control's haptic). Android uses `navigator.vibrate`.
- **Character build**: a radar chart of your five attributes on the Stats and Skills pages, outlined against your build from 4 weeks ago.
- **Quick log** bar on Home for one-tap Shift / Study / Workout / Meal / Sleep.
- **Keyboard shortcuts** (Mac): `1` Quest board, `2` Loot Shop, `3` Skill tree, `4` Stats, `5` Skills, `6` Goals, `0` Settings, `N` log something, `?` list. They work with or without ⌘ in the Dock app.
- **App shortcuts**: right-click the Dock icon (Chrome-installed on Mac) or long-press on Android for Log shift / Log study / Log workout / Loot Shop. iPhone doesn't support these for web apps, so use the Quick log bar there.

## Levels and Gold

- XP needed for each level is `100 × level^1.5`: 100 for level 1→2, 282 for 2→3, 3,162 for 10→11. Early levels fly by; later ones are a grind. Attributes level up on the same curve.
- **Gold**: +1 per $1 earned driving, +1 per $1 of debt paid off, +10 for the Iron Dungeon and +5 per NASM Ambush won.
- All of these numbers live in `js/rpgMath.js`.

## Stress and Cyberpsychosis

| Event | Stress |
|---|---|
| Sleep logged with a bedtime after 9:00 PM | +25 |
| 7th+ day in a row without a rest day (a rest day = no workout and no gig shift) | +20 per day |
| In bed by 9:00 PM with 7+ hours of sleep | −15 |
| A rest day | −20 |
| A perfect nutrition day | −10 |

At **100% stress you get Cyberpsychosis**: −20% on all XP you earn while it lasts, and the Loot Shop locks for 24 hours. The only cures are an **8-hour sleep** or a **perfect nutrition day** (calories within ±5% of your target with your protein goal hit, from meals or a MacroFactor check-in). A perfect nutrition day also earns +60 STR.

## NASM Ambush

Twice per IT shift, at random times, an encounter pops up when you open the app: one NASM CPT multiple-choice question (53 in the bank, focusing on ones you haven't answered correctly yet). **Right: +50 INT, +5 Gold. Wrong: −5 HP.** You can retreat and come back to it until the shift ends. Questions live in `js/nasm.js`.

## Career Skill Tree

| Node | Requires | Unlocks |
|---|---|---|
| 🎓 Certified | INT Level 10 + pass the NASM exam | Equinox Job Hunt quests |
| 🏟️ The Floor | Certified + Equinox job secured | Floor Interaction dailies |
| 📒 Book of Business | The Floor + 5 IRL clients | The Online Brand quests |
| 🚀 The 8-Week Program | Book of Business + CHA Level 15 | High-ticket online sales quests |

Mark the real-life milestones (exam passed, job secured, client count) on the Career page. Each unlocked node adds 4 daily career quests to your Home screen (+40 XP each). Nodes and quests live in `js/career.js`.

## Loot Shop

Add things you want IRL with their price; each costs **10 Gold per $1**. The Purchase button unlocks once you have the Gold. Buying deducts it, fires confetti and gives you permission to buy it for real. Mis-click? Undo it from the Trophy case to get the Gold back.

## How XP works

| Activity | XP | Attribute |
|---|---|---|
| Study session | 2 per minute (×1.5 on a Stealth Mission) | INT |
| Practice quiz | 20 + half your score | INT |
| Drawing session | 2 per minute | TECH |
| Content session (shoot / edit) | 2 per minute | CHA |
| Workout | 30 + 2 per minute | STR |
| Personal record | 75 | STR |
| Meal or MacroFactor check-in | 10 | STR |
| Perfect nutrition day | +60 | STR |
| NASM Ambush won | +50 | INT |
| Career quest | +40 | CRED or CHA |
| Gig shift | 1 per $2 earned + 5 per hour | CRED |
| IT shift | 10 per hour | CRED |
| Debt payment | 1 per $2 paid | CRED |
| Each daily quest cleared | +25 | that quest's skill |
| All of today's daily quests cleared | +100 | overall only |
| Main Quest cleared by 9 PM | +300 (+50 Gold) | the attribute you pick |
| Weekly quest claimed | its listed reward | its attribute(s) |
| Micro-bounty | +20 | its attribute |
| Critical hit (1 in 10) | ×2 XP and Gold on that entry | |
| Overdrive | ×2 on everything until midnight | |
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
| `js/game.js` | Attributes, skills, XP rules, daily quests, streaks, achievements; builds your character from your logs |
| `js/weekly.js`, `js/boards.js` | Weekly quest tracking, and the Main Quest, Bounty Board and Weekly quests sections on Home |
| `js/questboard.js` | The Daily Dungeon quest board |
| `js/burnout.js` | Stress, Cyberpsychosis and nutrition scoring |
| `js/nasm.js`, `js/ambush.js` | NASM question bank, encounter timing, and the Ambush pop-up |
| `js/career.js`, `js/skilltree.js` | Career nodes and quest packs, and the Career page |
| `js/shop.js` | The Loot Shop |
| `js/goals.js`, `js/goalspage.js` | Goal scoring, and the Goals page with its ranked hit list |
| `js/fx.js`, `js/theme.js` | Sound effects and haptics, and the time-based themes |
| `js/sync.js` | Optional Supabase sync |
| `js/app.js` | Navigation, layout, level-up celebrations |
| `js/pages.js`, `js/settings.js`, `js/logsheet.js`, `js/components.js` | The screens |
| `vendor/preact-htm.js` | Tiny UI library (Preact + htm), bundled so no build step is needed |
