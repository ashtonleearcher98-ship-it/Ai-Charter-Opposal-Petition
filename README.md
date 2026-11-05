# Keep Micronationalism Free — AI Charter Opposition Petition

A Change.org-inspired, mobile-friendly petition site initiated by the **Commonwealth of Greenwick** to call for reconsideration of Article V of the *Charter for the Ethical Use of Artificial Intelligence in Micronationalism*.

## Campaign position

- The petition **does not claim the original Charter bans all AI**. Its wording explicitly permits several forms of AI-assisted creativity and administration.
- The primary objection is to Article V, which categorically distinguishes entirely virtual nation-building from micronationalism.
- The petition supports **each micronation's own Legislative Assembly**, or constitutionally authorised lawmaking institution, deciding whether and how its government may use AI.
- It also supports transparency and discourages deliberate misrepresentation of synthetic images as authentic evidence of real infrastructure or events.

## Live backend

The site is connected to a **namespaced set of petition tables** in an existing connected Supabase project. No existing PMAC tables were altered, although both projects currently share the same Supabase project infrastructure.

Backend URL: `https://scglydnqfaitasfwjucj.supabase.co`

| Table | Purpose |
| --- | --- |
| `public.ai_petition_signatures` | Private submissions containing contact details and moderation status |
| `public.ai_petition_admins` | Authorised moderators (seeded from the existing admin account) |
| `public.ai_petition_metrics` | Approved signature counter |
| `public.ai_petition_public_signers` | Public opt-in supporters only, with **no email addresses** |
| `public.ai_petition_updates` | Campaign news and updates |

All petition tables have Row Level Security enabled. Anonymous users can submit a signature, but cannot read private submissions or approve anything. Only approved submissions contribute to the displayed count. A signature is not proof of an official government endorsement.

### Moderation

Visit the website with `#admin` added to the URL. Sign in using the linked authorised Supabase admin account. The interface allows authorised moderators to:

1. Review signatures and their self-declared authority;
2. Approve or decline each submission;
3. Publish campaign updates.

**Important:** Representatives' authorisation is currently self-declared. Before approving a signature as a national representative, moderators should independently verify its legitimacy. There is no automated email verification or per-IP bot protection in this version. Do not assume a claim of authority is verified solely because someone checked the box.

The published supporter list shows only names and affiliations of approved users who opted in. Contact emails remain in the private submission table.

## Deployment

The website source is committed to this repository on `main`. An automated GitHub Pages workflow is located at `.github/workflows/deploy.yml`.

### One-time GitHub Pages activation

For this new repository, GitHub Pages needs to be enabled by a repository administrator:

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Publish petition website** and click **Re-run all jobs** (or push any commit to `main`).

The planned public URL is:

`https://ashtonleearcher98-ship-it.github.io/Ai-Charter-Opposal-Petition/`

Do not share that as a confirmed live address until GitHub reports a successful Pages deployment.

## Site files

- `index.html` — all sections, the petition form, and private admin view.
- `styles.css` — custom responsive Change.org-inspired layout.
- `app.js` — private submission handling, live counts, public supporters, updates, and admin authentication.
- `.github/workflows/deploy.yml` — Pages deployment automation.

## Security & privacy

The public-facing JavaScript includes the Supabase **anon** key (which is designed to be public), never a service-role key. Private data is protected by the database's RLS and explicit access grants. Public signatures do not expose email addresses.

The site does not collect money, auto-publish unverified submissions, or claim that signatories have been independently recognised by any external diplomatic body.

If you move the petition to a dedicated Supabase project later, update `CONFIG.url` and `CONFIG.publicKey` in `app.js`, and recreate the five tables and policies in the new project before switching.

## Independence

This is an independent Greenwick campaign. It is not owned, sponsored or endorsed by Change.org and does not use their official branding.
