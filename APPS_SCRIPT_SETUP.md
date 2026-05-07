# TampaRestore — Google Apps Script Setup

## STEP 1: CHECK YOUR SHEET HEADERS

Your current headers (must match exactly):
| Column | Header |
|--------|---------|
| A | id |
| B | name |
| C | phone |
| D | email |
| E | city |
| F | damage_type |
| G | description |
| H | lat |
| I | lng |
| J | status |
| K | created_at |
| L | notes |

If missing, add email column between phone and city.

---

## STEP 2: CREATE APPS SCRIPT

1. In your Google Sheet → **Extensions** → **Apps Script**
2. Delete any code there
3. Paste the code from `google-apps-script/Code.js`

---

## STEP 3: DEPLOY

1. Click **Deploy** → **New deployment**
2. Select **Web app**
3. Configure:
   - Description: TampaRestore Lead API
   - Execute as: Me
   - Who has access: **Anyone**
4. Click **Deploy**
5. **COPY THE URL** (save it!)

---

## STEP 4: UPDATE FORM TO SEND TO SHEET

Once you have the Apps Script URL, tell me and I'll update the form to submit there too.

---

## ALREADY WORKING (WITHOUT APPS SCRIPT)

Even before Apps Script:
- Form submits → Netlify Forms captures
- Netlify emails you → tylerbelislefl@gmail.com
- You manually forward to contractor

That's enough to start. Apps Script is bonus for database tracking.