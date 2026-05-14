# attendee-harvester

Generic Swapcard event attendee scraper — API interception, auto-scroll, resume, validation, and Excel export.

Captures the full attendee list from any Swapcard-hosted event by intercepting the platform's internal GraphQL/REST API responses as you scroll. No DOM scraping, no brittle selectors. Works with SSO, OTP, and standard login flows.

## How It Works

1. You log in manually through a real browser window — session saved to disk
2. The scraper opens your saved session and auto-scrolls the People page
3. Every API response is intercepted and parsed for `firstName`, `lastName`, `jobTitle`, `companyName`
4. Dual-signal done detection: scroll position stuck **and** no new API data for 20 seconds
5. Deduplicated output written to `.xlsx`

## Quick Start

```bash
git clone https://github.com/arpitjaiswal-0701/attendee-harvester.git
cd attendee-harvester
npm run setup
```

Copy the example config and fill in your event details:

```bash
cp config.example.json swapcard.config.json
# edit swapcard.config.json
```

Then run the workflow:

```bash
npm run login     # Step 1: log in manually, session saved
npm run scrape    # Step 2: auto-scroll + API intercept
npm run validate  # Step 3: check coverage against Swapcard's totalCount
```

## Config (`swapcard.config.json`)

```json
{
  "eventUrl": "https://atdconferences.app.swapcard.com/event/YOUR-EVENT/people/VIEW-ID",
  "eventName": "ATD 2026",
  "outputDir": "C:\\Users\\YourName\\Desktop",
  "profileDir": "C:\\Users\\YourName\\Desktop\\swapcard-browser-profile"
}
```

| Field | Description |
|-------|-------------|
| `eventUrl` | Full URL of the People/Attendees page (must contain `/people/`) |
| `eventName` | Used to name the output file (`EventName_YYYY-MM-DD.xlsx`) |
| `outputDir` | Folder where the Excel file will be saved (absolute path) |
| `profileDir` | Where Playwright saves your browser session (absolute path) |

`swapcard.config.json` is gitignored — never commit credentials or session paths.

## Commands

| Command | What it does |
|---------|-------------|
| `npm run setup` | Install dependencies + download Chromium (first time only) |
| `npm run login` | Open browser for manual login, save session to `profileDir` |
| `npm run scrape` | Full scrape from scratch — auto-scroll, intercept, export |
| `npm run resume` | Resume interrupted scrape — merges new entries into existing Excel |
| `npm run validate` | Compare your Excel count to Swapcard's `totalCount` API field |

## Output

The Excel file has three columns:

| Name | Title / Role | Company / Organization |
|------|-------------|----------------------|

File is named `EventName_YYYY-MM-DD.xlsx` and written to `outputDir`.

## Resume

If a scrape is interrupted, run `npm run resume`. It:
- Loads the existing Excel and builds a deduplication set from existing names
- Shows `seen | NEW` counters as it scrolls
- Merges only new entries into the existing file on save

## Validation

`npm run validate` opens a browser, hits the Swapcard People page, captures the API's `totalCount`, and compares it to your Excel row count:

```
─────────────────────────────────────
  Your file:      7,017
  Swapcard total: 7,017
  Coverage:       100.0%
  Gap:            0
─────────────────────────────────────
  ✅ Complete
```

Gap ≤ 50 = complete. Gap > 500 = more scrolling needed.

## Notes

- Some attendees opt out of Swapcard's People directory — they will never appear regardless of coverage
- Session cookies are stored in `profileDir` — keep this directory between runs
- If Swapcard updates their API shape, `lib/common.js` → `extractPeople()` is the function to update
- Tested against Swapcard events with 7,000+ attendees at 100% coverage

## Claude Code Skill

This repo ships with a `SKILL.md` that can be installed as a Claude Code skill for guided invocation via `/attendee-harvester`. See [SKILL.md](SKILL.md) for the workflow.

## License

MIT
