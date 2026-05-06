# TampaRestore — Master Operations Guide

Last Updated: May 2026
Owner: Tyler B.
Repo: github.com/Baloo8721/TampaRestore

---

## 1. What This Business Does

TampaRestore is a free referral service connecting Tampa Bay homeowners with licensed, insured water damage restoration contractors. We generate leads and route them to contractor partners who pay us $75/lead or $500/mo retainer.

---

## 2. Current Build

- **URL:** https://baloo8721.github.io/TampaRestore/ (GitHub Pages)
- **Form Handler:** Netlify Forms (FREE, unlimited, commercial OK)
- **Note:** To use Netlify Forms, deploy to Netlify instead of GitHub Pages

### Tech Stack (Current)
| Component | Tool | Cost | Status |
|-----------|------|------|--------|
| Hosting | GitHub Pages | Free | Ready OR Netlify |
| Phone | Google Voice | Free | Not configured |
| Form | Netlify Forms | Free | ✅ Configured in index.html |
| AI Voice | Ollama/Synthflow | $0-50/mo | Future |
| VPS | Vultr | $6/mo | Future |

---

## 3. Configuration Required Before Going Live

| Placeholder | Line | Action |
|------------|-----|--------|
| (YOURNUMBER) | 782, 801, 862, 1085, 1104 | Set phone |
| [YOUR LLC NAME] | 1093, 1106 | Your business name |
| [YOUR EMAIL] | 1093 | Your contact email |

### Deploy to Netlify (Required for Forms)
1. Go to netlify.com → Sign up free
2. Add new site → Import from GitHub
3. Select TampaRestore repo
4. Build command: (leave blank for static)
5. Publish directory: . (root)
6. Deploy

---

## 4. Quick Start

### Deploy to Netlify
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Baloo8721/TampaRestore.git
git push -u origin main
```
1. Go to netlify.com → Sign up free (GitHub login)
2. Add new site → Import from GitHub
3. Select TampaRestore repo
4. Configure: Build command (blank), Publish directory: .
5. Click Deploy

### Netlify Forms Setup
- Already configured in index.html with `data-netlify="true"`
- After deploy, go to Site settings → Forms
- Enable email notifications to get leads via email

### Get Phone
1. voice.google.com
2. Get free 813/727 number
3. Forward to contractor partner

---

## 5. Credentials Template (FILL IN)

- GitHub: ________ / ________
- Formspree: ________ / ________
- Google Voice: ________ / ________
- Business Phone: ________
- LLC Name: ________

---

## 6. Costs

| Phase | Cost/mo |
|-------|--------|
| GitHub Pages only | $0 |
| + Phone forward | $0 |
| Full VPS + AI | $20-60 |

---

## 7. Daily Operations (when live)

1. Check email for form leads
2. Text/email lead to contractor partner
3. End of month: collect payment

---

*Keep this updated.*
