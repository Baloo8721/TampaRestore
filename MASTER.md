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
- **Type:** Static HTML/CSS/JS
- **Form Handler:** Formspree (needs YOUR_FORM_ID)

### Tech Stack (Planned)
| Component | Tool | Cost | Status |
|-----------|------|------|--------|
| Hosting | GitHub Pages | Free | Ready |
| Phone | Google Voice | Free | Not configured |
| Form | Formspree | Free | Needs form ID |
| AI Voice | Ollama/Synthflow | $0-50/mo | Future |
| VPS | Vultr | $6/mo | Future |

---

## 3. Configuration Required Before Going Live

| Placeholder | Line | Action |
|------------|-----|--------|
| (YOURNUMBER) | 782, 801, 862, 1085, 1104 | Set phone |
| YOUR_FORM_ID | 1133 | formspree.io |
| [YOUR LLC NAME] | 1093, 1106 | Your business |
| [YOUR EMAIL] | 1093 | Contact email |

---

## 4. Quick Start

### Deploy
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Baloo8721/TampaRestore.git
git push -u origin main
```
Enable GitHub Pages in repo Settings.

### Get Formspree
1. formspree.io → Sign up free
2. Create form → Copy ID
3. Replace YOUR_FORM_ID line 1133

### Get Phone
1. voice.google.com
2. Get free 813/727 number
3. Forward to contractor

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
