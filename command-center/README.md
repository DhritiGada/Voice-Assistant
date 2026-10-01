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

## Google Calendar connection

The app includes an optional Google Calendar connection using Google Identity Services.

When connected, the assistant can:

- read upcoming events from the user's primary calendar
- check proposed meetings against real calendar conflicts
- create events directly in Google Calendar
- request a Google Meet conference link when the user's Google account supports it

### Google setup

Create an OAuth 2.0 Web Client in Google Cloud, enable the Google Calendar API, and add the deployed Vercel domain as an authorized JavaScript origin.

Add this environment variable to the Vercel project:

```
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Then redeploy the project.

Calendar access is optional. The access token is stored only in browser session storage and is cleared when the user disconnects or the browser session ends.
