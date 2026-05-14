---
name: attendee-harvester
description: "Guide the user through scraping a Swapcard event attendee list using the attendee-harvester Node.js tool — login, auto-scroll, API intercept, Excel export, and coverage validation."
trigger: /attendee-harvester
risk: low
source: local
---

# /attendee-harvester

Guided workflow for extracting a full Swapcard event attendee list into Excel using the `attendee-harvester` Node.js tool. The tool auto-scrolls the People page, intercepts Swapcard's internal API responses, and writes a deduplicated `.xlsx` file. Claude orchestrates each step and handles interruptions.

## When to Use

Trigger this skill when the user:
- Mentions Swapcard and wants to export or scrape attendees
- Asks to pull an event attendee list or conference contacts
- Wants to build a prospect list from an event they are attending
- Has a Swapcard event URL and wants the data in Excel

Do not trigger for non-Swapcard platforms (use a different scraping skill) or if the user only wants to look up a single attendee.

---

## Prerequisites

The repo must be cloned locally before starting. If the user has not done this yet, tell them:

```bash
git clone https://github.com/arpitjaiswal-0701/attendee-harvester.git
cd attendee-harvester
```

All `npm run` commands below are executed from inside that cloned directory.

---

## Workflow

Follow these steps in order. Do not skip steps. Run each `npm run` command only after the previous one succeeds.

### Step 1 — Get the event People page URL

Ask the user:

> "Please open the Swapcard event in your browser and navigate to the **People** tab (usually labeled 'Attendees' or 'Networking'). Copy the URL from the address bar — it should contain `/people/` followed by a long VIEW-ID. Paste it here."

Wait for the URL before proceeding. If the URL does not contain `/people/`, prompt the user to navigate further into the People section until it does.

### Step 2 — Get the event name and output directory

Ask the user (can be a single message):

> "Two quick details:
> 1. What is the event name? (used to name the output file, e.g. `Adobe Summit 2025`)
> 2. Where should the Excel file be saved? Provide an absolute path to a folder (e.g. `C:\Users\you\Downloads` or `/Users/you/Desktop`)."

### Step 3 — Generate `swapcard.config.json`

Write the config file to the root of the cloned repo. Never write credentials into this file.

```json
{
  "eventUrl": "<paste People page URL from Step 1>",
  "eventName": "<event name from Step 2>",
  "outputDir": "<output directory from Step 2>",
  "profileDir": "<repo-root>/browser-profile"
}
```

- Set `profileDir` to `browser-profile` inside the repo root so the saved login session stays with the project.
- Tell the user: "Config written. The browser profile (saved login session) will be stored in `browser-profile/` inside the repo — do not delete this folder between runs."

### Step 4 — First-time setup (only on first use)

Check whether `node_modules` already exists in the repo root. If it does not, run setup:

```bash
npm run setup
```

This installs Playwright and downloads the Chromium browser. It takes 2–3 minutes on first run. Tell the user to wait for the "Setup complete" message before proceeding.

If `node_modules` already exists, skip this step.

### Step 5 — Log in to Swapcard

```bash
npm run login
```

Tell the user what to expect:

> "A Chromium browser window will open on the Swapcard login page. Log in with your Swapcard credentials as you normally would — single sign-on (SSO) is supported. Once you see the event home screen, close the browser window. Your session will be saved automatically."

Wait for the user to confirm they have logged in and closed the browser before proceeding.

Do not ask for or store credentials yourself. The session cookie is saved to `profileDir` by Playwright.

### Step 6 — Run the scrape

```bash
npm run scrape
```

Tell the user what will happen:

> "The tool will open a headless browser, navigate to the People page, and auto-scroll to load all attendees. As it scrolls it intercepts Swapcard's API responses and collects attendee records. You will see a live counter in the terminal showing how many profiles have been captured. This may take several minutes depending on event size — do not close the terminal."

Monitor the output. A successful run ends with a message like:

```
Scrape complete. 1,247 attendees saved to /path/to/output/EventName_2025-01-15.xlsx
```

Report the final count and file path to the user once the run completes.

### Step 7 — Resume an interrupted scrape (only if needed)

If `npm run scrape` was interrupted (terminal closed, network drop, Ctrl+C), run:

```bash
npm run resume
```

This picks up from the last saved checkpoint rather than starting over. Tell the user: "Resume will skip profiles already captured and continue from where it stopped."

Only use `resume` if the previous scrape did not fully complete. After a successful full scrape, always start fresh with `npm run scrape`.

### Step 8 — Validate coverage

```bash
npm run validate
```

This queries Swapcard's API for the official total attendee count and compares it against the number of records in the Excel file.

Interpret and report the output to the user:

- **95–100% coverage** — Excellent. Share the file path and total count.
- **80–94% coverage** — Acceptable for most purposes, but note the gap. Offer to re-run `npm run scrape` to attempt full coverage.
- **Below 80%** — Coverage is low. Tell the user the scrape likely hit a scroll issue or session timeout and recommend running `npm run scrape` again (not resume).

### Step 9 — Final report to user

Summarize the outcome:

```
Swapcard scrape complete.
  Event:      <eventName>
  Attendees:  <N> profiles captured (<coverage>% of Swapcard total)
  Output:     <absolute path to .xlsx file>
```

---

## Key Behaviors

Claude must always:

- **Never store or log credentials.** The login step is entirely manual; Claude only runs the `npm run login` command and instructs the user to log in through the browser window.
- **Explain the live counter.** During `npm run scrape`, the terminal shows a running count of intercepted profiles. Reassure the user this is normal and the tool is working.
- **Warn about privacy opt-outs.** Some Swapcard attendees opt out of being visible in the People directory. The Excel output reflects only publicly visible attendees. Coverage below 100% may partly reflect opt-outs, not a tool failure.
- **Keep `swapcard.config.json` out of version control.** If the user mentions pushing the repo to GitHub, remind them to add `swapcard.config.json` and `browser-profile/` to `.gitignore`.
- **Run commands from the repo root.** All `npm run` commands must be executed from inside the cloned `attendee-harvester` directory.

---

## Limitations

- **Swapcard login required.** The user must have a valid Swapcard account with access to the event. The tool cannot bypass authentication.
- **One event per config.** `swapcard.config.json` points to a single event. To scrape multiple events, update the config (or keep separate copies) and re-run the workflow.
- **Swapcard UI changes may break the scraper.** The tool depends on Swapcard's internal API endpoints. If Swapcard updates its frontend, the tool may need maintenance.
- **No real-time data.** The Excel snapshot reflects the attendee list at the time of the scrape. New registrations after the scrape are not captured without re-running.
- **Privacy opt-outs reduce coverage.** Attendees who have hidden their profiles in Swapcard will not appear in the output. Validate coverage is not a bug report for this scenario.
- **This skill does not install Node.js.** If `npm` is not available, direct the user to install Node.js from https://nodejs.org first.
