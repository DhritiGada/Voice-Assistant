# Voice Assistant

A voice-first personal operations assistant that turns natural-language commands into practical browser actions for tasks, notes, meetings, spreadsheets, music, travel, weather, search, and productivity shortcuts.

## Live Demo

[Open the Voice Command Center](https://voice-command-center-iota.vercel.app/)

## Current Features

- Voice and typed commands
- Multilingual speech recognition with selectable language
- Optional spoken responses
- Task creation with dates and automatic categories
- Notes with timestamps and categories
- Local meeting scheduling
- Conflict checks against meetings saved in the assistant
- Prefilled Google Calendar draft creation
- Jitsi meeting link generation
- Live weather lookup by named city or browser location
- Excel-compatible `.xls` spreadsheet generation
- YouTube music search and playback flow
- Travel shortcuts for flights, Airbnb, and hotels
- Social and productivity shortcuts
- Web-search fallback for open-ended requests
- Dated timeline across tasks, notes, and meetings
- Clearable command history
- Browser-local persistence

## Example Commands

```text
Schedule a meeting tomorrow at 2 pm for 30 minutes
Create an Excel with columns company, role, recruiter, status
What is the weather in Chicago?
Play Yellow by Coldplay
Plan a trip to Miami
Open LinkedIn
Remind me to follow up with the recruiter Friday
Note that the hiring manager asked about APIs
```

## Meeting Workflow

When a meeting command is recognized, the assistant can:

1. Parse a date, time, duration, and title
2. Check for conflicts against meetings saved locally
3. Create a Jitsi meeting link
4. Save the meeting in the assistant
5. Open a prefilled Google Calendar draft in a new tab

Direct Google account synchronization is currently disabled in the public prototype.

## Spreadsheet Workflow

Users can define spreadsheet columns, add rows, and download an Excel-compatible `.xls` file generated in the browser.

## Persistence and Privacy

Tasks, notes, meetings, and command history are stored in browser Local Storage. The prototype does not require an account for these features.

## Tech Stack

- React
- Vite
- Lucide React
- Web Speech API
- Browser Local Storage
- Browser Geolocation
- Vercel

## Run Locally

```bash
cd command-center
npm install
npm run dev
```

## Project Structure

The modern browser application lives in `command-center/`.

The original Python voice assistant remains preserved in the repository root as the historical implementation.

## Deployment

The current Voice Command Center is deployed on Vercel:

[https://voice-command-center-iota.vercel.app/](https://voice-command-center-iota.vercel.app/)
