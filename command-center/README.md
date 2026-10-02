# Voice Command Center

A browser-based evolution of the original Python voice assistant into a voice-first personal operations prototype.

## Live Demo

[Open the Voice Command Center](https://voice-command-center-iota.vercel.app/)

## What It Can Do

- Voice or typed commands
- Multilingual speech transcription with selectable language
- Optional spoken responses
- Tasks with dates and automatic categories
- Notes with timestamps and categories
- Meeting scheduling with local conflict checks
- Prefilled Google Calendar drafts
- Jitsi meeting links
- Live weather using browser location or a named city
- Excel-compatible `.xls` spreadsheet generation
- Social and productivity shortcuts
- YouTube music search
- Web-search fallback for open-ended questions
- Travel shortcuts for flights, Airbnb, and hotels
- Dated timeline across tasks, notes, and meetings
- Clearable command history
- Browser-local persistence

## Example Commands

```text
Schedule a meeting tomorrow at 2 pm for 30 minutes
Create an Excel with columns name, email, status
What is the weather in Chicago?
Play Yellow by Coldplay
Plan a trip to Miami
Open LinkedIn
Remind me to follow up with the recruiter Friday
Note that the hiring manager asked about APIs
```

## Meeting Workflow

The public prototype does not directly write into a user's Google Calendar.

For meeting commands it can:

1. Parse the requested meeting details
2. Check conflicts against meetings already saved in the assistant
3. Create a Jitsi link
4. Save the meeting locally
5. Open a prefilled Google Calendar event draft

This keeps the public demo functional without requiring Google OAuth credentials.

## Spreadsheet Workflow

The spreadsheet builder lets users define columns and rows, then generates an Excel-compatible `.xls` file in the browser.

## Persistence

Tasks, notes, command history, and meetings are stored with browser Local Storage.

## Browser Capabilities

Speech recognition depends on browser support for the Web Speech API. Location-based weather can use browser geolocation when permission is available.

## Run Locally

```bash
npm install
npm run dev
```

## Tech Stack

- React
- Vite
- Lucide React
- Web Speech API
- Browser Local Storage
- Browser Geolocation

The original Python assistant remains preserved in the repository root.
