# Micronational Voices — public petition platform

A responsive Change.org-inspired petition platform created by the Commonwealth of Greenwick.

## Featured campaign

**Keep micronationalism free. Oppose Article V of the AI Charter.**

This campaign challenges the Charter's categorical treatment of entirely virtual nation-building as geofiction and argues that every micronation's own lawmaking body should decide whether or how its government uses AI. It explicitly supports transparency and does **not** allege that the original Charter bans all AI.

The featured campaign appears at the top of **every community petition page**, in community campaign cards, and as a highlighted item in the browse directory.

## Features

- **Immediate signatures:** submissions are counted automatically, without a moderator approval queue.
- **Featured campaign counter:** currently backed by `ai_petition_metrics` and `ai_petition_signatures`.
- **Community petition directory:** search, category tags, campaign cards, signed counts, and individual petition pages.
- **Public petition creation:** creators register with email/password and publish directly (email verification may be required by Supabase Auth configuration).
- **Per-campaign signing:** visitors do not need accounts; one signature per email per petition.
- **Community campaign updates:** signed-in organisers can publish updates for their own petitions.
- **Administration:** `#admin` provides administrative access to remove abusive community petitions and publish featured campaign updates.
- **Data privacy:** signature emails stay private and are not shown on public lists.
- **Mobile-friendly design:** custom responsive HTML/CSS/JS with no framework build step.

## Public URL and publishing

This repository contains the full website in `index.html`, `styles.css`, `app.js`, `community.css`, and `community.js`.

The currently deployed Supabase Edge preview is:

https://scglydnqfaitasfwjucj.supabase.co/functions/v1/greenwick-ai-petition

GitHub Pages is configured to publish automatically from the repository's `main` branch (source files at the repository root). Its publishing status is visible under Actions:

https://github.com/greenwickgov/Micronational-Voices/actions

GitHub Pages should publish to:

https://greenwickgov.github.io/Micronational-Voices/

If a Pages build fails, review the automatic deployment under Actions before advertising the Pages URL as live.

## Navigation

| Path / query | Page |
| --- | --- |
| `/` | Featured AI Charter opposition petition |
| `?view=browse` | Browse community petitions |
| `?view=create` | Register/sign in and create a petition |
| `?petition=<uuid>` | View and sign a particular community petition |
| `#admin` | Admin dashboard for authorised Supabase admins |

## Backend & security

Supabase project: `scglydnqfaitasfwjucj`. The petition tables are isolated from the existing PMAC tables, although they share the same Supabase project infrastructure.

### Main featured campaign tables

- `ai_petition_signatures` — email, self-declared nation/role and signature information (private).
- `ai_petition_metrics` — immediate approved signature total.
- `ai_petition_public_signers` — public name/affiliation only when permitted by the signer.
- `ai_petition_updates` — featured petition updates.
- `ai_petition_admins` — authorised moderators.

### Community platform tables

- `ai_community_petitions` — owner, title, description, category, goal and visibility status.
- `ai_community_signatures` — private signatures and email addresses.
- `ai_community_public_signatures` — opt-in publicly displayed supporter details only.
- `ai_community_metrics` — database-maintained signature counts.
- `ai_community_updates` — campaign updates by authenticated owners.

All public-facing tables have Row Level Security enabled with explicit grants. Community petition creation requires a Supabase authenticated owner; a database trigger limits creation to three petitions per user every 24 hours. Campaign signups and counters are maintained through Postgres triggers. Only administrators can remove published community petitions.

**Important limitations:**

- Automatic counting does not verify that a signature's claimed micronational affiliation is official. The interface labels representation as self-declared.
- One signature per email address per petition is enforced, but disposable emails or multiple addresses are not automatically detected.
- Self-service creators can publish immediately. Admins should proactively remove abusive or impersonating petitions.
- Supabase Auth email confirmation depends on the project's configured email provider and templates.
- Enable leaked password protection in Supabase Auth settings for stronger account security.

Never put a Supabase service-role key in the public JavaScript. Only a public/anon API key is used.

## Source deployment note

The Edge function named `greenwick-ai-petition` hosts a packaged copy of the website and its styles/scripts. The GitHub repository is the editable source of truth; update/redeploy the Edge function after modifying files.
