# Voice Command Center

A browser-based evolution of the original Python voice assistant into a voice-first personal operations prototype.

## What it can do

- Voice or typed commands
- Multilingual speech transcription with selectable language
- Tasks with dates and automatic categories
- Notes with timestamps and categories
- Meeting scheduling with local conflict checks
- Prefilled Google Calendar events
- Instant Jitsi meeting links
- Live weather using browser location or a named city
- Real `.xlsx` spreadsheet generation
- Social and productivity shortcuts
- YouTube music search
- Web search fallback for open-ended questions
- Travel shortcuts for flights, Airbnb, and hotels
- Dated timeline across tasks, notes, and meetings
- Optional spoken responses
- Clearable command history
- Browser-local persistence

## Example commands

- “Schedule a meeting tomorrow at 2 pm for 30 minutes”
- “Create an Excel with columns name, email, status”
- “What is the weather in Chicago?”
- “Play Yellow by Coldplay”
- “Plan a trip to Miami”
- “Open LinkedIn”
- “Remind me to follow up with the recruiter Friday”
- “Note that the hiring manager asked about APIs”

## Important implementation note

The prototype can create a meeting locally, generate a working Jitsi link, and open a prefilled Google Calendar event. Directly writing into a user's Google Calendar or automatically generating a Google Meet link would require Google OAuth and Calendar API authorization, which is intentionally not embedded in this public prototype.

## Run locally

```bash
npm install
npm run dev
```

The original Python assistant remains preserved in the repository root.
