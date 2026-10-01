import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CloudSun,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  ListTodo,
  MapPin,
  Mic,
  MicOff,
  Music2,
  NotebookPen,
  Plane,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
} from "lucide-react";
import "./styles.css";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

const STORAGE = {
  tasks: "voice-command-center.tasks",
  notes: "voice-command-center.notes",
  history: "voice-command-center.history",
  events: "voice-command-center.events",
};

const LANGUAGES = [
  ["en-US", "English (US)"],
  ["en-IN", "English (India)"],
  ["hi-IN", "Hindi"],
  ["es-ES", "Spanish"],
  ["fr-FR", "French"],
  ["de-DE", "German"],
  ["it-IT", "Italian"],
  ["pt-BR", "Portuguese"],
  ["ja-JP", "Japanese"],
];

const SOCIALS = {
  linkedin: "https://linkedin.com",
  instagram: "https://instagram.com",
  facebook: "https://facebook.com",
  twitter: "https://x.com",
  x: "https://x.com",
  github: "https://github.com",
  gmail: "https://mail.google.com",
  calendar: "https://calendar.google.com",
  youtube: "https://youtube.com",
  google: "https://google.com",
  "stack overflow": "https://stackoverflow.com",
};

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalize(text) {
  return text.trim().replace(/\s+/g, " ");
}

function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(text) {
  const lower = text.toLowerCase();
  const now = new Date();

  if (lower.includes("tomorrow")) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return toLocalDateString(date);
  }

  if (lower.includes("today")) return toLocalDateString(now);

  const weekdayMap = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };

  for (const [name, day] of Object.entries(weekdayMap)) {
    if (lower.includes(name)) {
      const date = new Date(now);
      let delta = (day - now.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      date.setDate(date.getDate() + delta);
      return toLocalDateString(date);
    }
  }

  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  return "";
}

function parseTime(text) {
  const match = text.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!match) return "";

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const period = match[3].toLowerCase();

  if (period === "pm" && hour !== 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseDuration(text) {
  const minuteMatch = text.match(/(?:for\s+)?(\d+)\s*(?:minute|minutes|min)\b/i);
  if (minuteMatch) return Number(minuteMatch[1]);

  const hourMatch = text.match(/(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:hour|hours|hr|hrs)\b/i);
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60);

  return 30;
}

function stripPlanningWords(text) {
  return text
    .replace(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
    .replace(/\b(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
    .replace(/\bfor\s+\d+(?:\.\d+)?\s*(?:minute|minutes|min|hour|hours|hr|hrs)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function categorize(text) {
  const lower = text.toLowerCase();
  if (/interview|resume|application|recruiter|job|linkedin|career/.test(lower)) return "Career";
  if (/flight|hotel|airbnb|trip|travel|vacation|airport/.test(lower)) return "Travel";
  if (/invoice|budget|bank|payment|expense|finance/.test(lower)) return "Finance";
  if (/course|study|learn|class|exam|assignment/.test(lower)) return "Learning";
  if (/doctor|gym|workout|health|medication/.test(lower)) return "Health";
  if (/meeting|client|report|project|work|presentation/.test(lower)) return "Work";
  return "Personal";
}

function nextStepsFor(text, type) {
  const lower = text.toLowerCase();

  if (/application|interview|recruiter|resume/.test(lower)) {
    return ["Review the role requirements", "Tailor the relevant application materials", "Set a follow-up reminder"];
  }
  if (type === "meeting") {
    return ["Add an agenda", "Attach any context or prep notes", "Confirm attendees before the meeting"];
  }
  if (type === "travel") {
    return ["Compare flight options", "Check stays near your priorities", "Save the itinerary and weather before booking"];
  }
  if (type === "spreadsheet") {
    return ["Confirm the column names", "Add or paste your rows", "Download the workbook when ready"];
  }
  if (type === "task") {
    return ["Confirm the deadline", "Define the first concrete action", "Block time if the task is important"];
  }
  return ["Review the interpreted action", "Add missing details if needed", "Continue when it looks right"];
}

function parseFields(text) {
  const match = text.match(/(?:fields|columns?)\s+(?:are\s+)?(.+)/i);
  if (!match) return [];

  return match[1]
    .replace(/\band\b/gi, ",")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function meetingConflict(events, draft) {
  if (!draft.date || !draft.time) return null;

  const start = new Date(`${draft.date}T${draft.time}:00`);
  const end = new Date(start.getTime() + draft.duration * 60000);

  return events.find((event) => {
    const existingStart = new Date(event.start);
    const existingEnd = new Date(event.end);
    return start < existingEnd && end > existingStart;
  }) || null;
}

function calendarTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function calendarUrl(event) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${calendarTimestamp(start)}/${calendarTimestamp(end)}`,
    details: event.meetingUrl ? `Meeting link: ${event.meetingUrl}` : "Created with Voice Command Center",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function youtubeSearch(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function parseCommand(raw) {
  const text = normalize(raw);
  const lower = text.toLowerCase();
  if (!text) return null;

  if (/^(clear|delete|erase) (my )?(command )?history$/i.test(text)) {
    return {
      type: "clear_history",
      label: "Clear command history",
      title: "Clear recent commands",
      description: "This removes the locally stored command history from this browser.",
    };
  }

  if (/\b(weather|temperature|forecast)\b/i.test(text)) {
    const locationMatch = text.match(/(?:weather|temperature|forecast).*?\bin\s+(.+)$/i);
    return {
      type: "weather",
      label: "Check weather",
      title: locationMatch ? locationMatch[1].trim() : "Current location",
      location: locationMatch?.[1]?.trim() || "",
      description: "I’ll fetch current conditions when you continue.",
    };
  }

  if (/\b(create|make|build)\b.*\b(excel|spreadsheet|workbook|sheet)\b/i.test(text)) {
    const fields = parseFields(text);
    return {
      type: "spreadsheet",
      label: "Create spreadsheet",
      title: "New workbook",
      fields,
      rows: [],
      description: fields.length
        ? `I found ${fields.length} columns. Add rows below, then download the .xlsx file.`
        : "Tell me the column names or add them below.",
    };
  }

  if (/\b(schedule|book|set up|create)\b.*\b(meeting|call|appointment|sync)\b/i.test(text)) {
    const date = parseDate(text);
    const time = parseTime(text);
    const duration = parseDuration(text);
    const cleaned = stripPlanningWords(
      text.replace(/^(schedule|book|set up|create)\s+(a\s+)?/i, "")
    );
    return {
      type: "meeting",
      label: "Schedule meeting",
      title: cleaned || "New meeting",
      date,
      time,
      duration,
      description: date && time
        ? "I’ll check your locally planned events for conflicts before adding it."
        : "Add the missing date or time before scheduling.",
    };
  }

  if (/\b(play|listen to)\b.+/i.test(text)) {
    const song = text.replace(/^.*?\b(play|listen to)\b\s*/i, "").replace(/\bon youtube\b/i, "").trim();
    return {
      type: "music",
      label: "Play on YouTube",
      title: song || "YouTube",
      url: youtubeSearch(song || ""),
      description: "I’ll open YouTube search results for this request.",
    };
  }

  if (/\b(plan|book|find)\b.*\b(trip|flight|flights|hotel|hotels|airbnb|stay|vacation)\b/i.test(text)) {
    const destination =
      text.match(/\bto\s+([a-zA-Z .'-]+?)(?:\s+(?:from|on|for|next|this|tomorrow|today)\b|$)/i)?.[1]?.trim() ||
      "";
    return {
      type: "travel",
      label: "Plan travel",
      title: destination ? `Trip to ${destination}` : "Trip planner",
      destination,
      startDate: parseDate(text),
      endDate: "",
      description: "I’ll create quick links for flights, stays, and destination research.",
    };
  }

  const taskPatterns = [
    /^remind me to\s+(.+)/i,
    /^create (?:a )?task\s+(.+)/i,
    /^add (?:a )?task\s+(.+)/i,
    /^task\s+(.+)/i,
    /^i need to\s+(.+)/i,
    /^todo\s+(.+)/i,
  ];

  for (const pattern of taskPatterns) {
    const match = text.match(pattern);
    if (match) {
      const due = parseDate(text);
      const title = stripPlanningWords(match[1]);
      return {
        type: "task",
        label: "Create task",
        title,
        due,
        category: categorize(title),
        description: due ? "Task ready with a detected date." : "Task ready. You can add a date before saving.",
      };
    }
  }

  const notePatterns = [
    /^note that\s+(.+)/i,
    /^take (?:a )?note\s+(.+)/i,
    /^save (?:a )?note\s+(.+)/i,
    /^remember\s+(.+)/i,
    /^capture\s+(.+)/i,
  ];

  for (const pattern of notePatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        type: "note",
        label: "Save note",
        title: match[1].trim(),
        category: categorize(match[1]),
        description: "This note will be dated, categorized, and saved locally.",
      };
    }
  }

  const openMatch = text.match(/^open\s+(.+)/i);
  if (openMatch) {
    const destination = openMatch[1].trim();
    const key = Object.keys(SOCIALS).find((site) => destination.toLowerCase().includes(site));
    return {
      type: "open",
      label: "Open website",
      title: key ? key.replace(/\b\w/g, (c) => c.toUpperCase()) : destination,
      url: key ? SOCIALS[key] : `https://www.google.com/search?q=${encodeURIComponent(destination)}`,
      description: key ? "Ready to open this destination." : "I’ll search the web for this destination.",
    };
  }

  const searchMatch = text.match(/^(?:search(?: the web)? for|google|look up|find out)\s+(.+)/i);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    return {
      type: "search",
      label: "Search web",
      title: query,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      description: "Ready to run a web search.",
    };
  }

  if (/\b(what time|current time|time is it)\b/i.test(text)) {
    const time = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date());
    return {
      type: "answer",
      label: "Current time",
      title: time,
      description: "Based on your device time.",
    };
  }

  return {
    type: "search",
    label: "Search web",
    title: text,
    url: `https://www.google.com/search?q=${encodeURIComponent(text)}`,
    description: "I don’t have a dedicated action for this yet, so I can search the web instead.",
  };
}

function ActionIcon({ type }) {
  if (type === "task") return <ListTodo size={19} />;
  if (type === "note") return <NotebookPen size={19} />;
  if (type === "meeting") return <CalendarDays size={19} />;
  if (type === "weather") return <CloudSun size={19} />;
  if (type === "spreadsheet") return <FileSpreadsheet size={19} />;
  if (type === "travel") return <Plane size={19} />;
  if (type === "music") return <Music2 size={19} />;
  if (type === "search") return <Search size={19} />;
  if (type === "open") return <ExternalLink size={19} />;
  if (type === "answer") return <Clock3 size={19} />;
  return <Sparkles size={19} />;
}

function App() {
  const [tasks, setTasks] = useState(() => load(STORAGE.tasks, []));
  const [notes, setNotes] = useState(() => load(STORAGE.notes, []));
  const [history, setHistory] = useState(() => load(STORAGE.history, []));
  const [events, setEvents] = useState(() => load(STORAGE.events, []));
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceReply, setVoiceReply] = useState(true);
  const [status, setStatus] = useState("Ready");
  const [language, setLanguage] = useState("en-US");
  const [weather, setWeather] = useState(null);
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => save(STORAGE.tasks, tasks), [tasks]);
  useEffect(() => save(STORAGE.notes, notes), [notes]);
  useEffect(() => save(STORAGE.history, history), [history]);
  useEffect(() => save(STORAGE.events, events), [events]);

  const supportsSpeech = useMemo(
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  const timeline = useMemo(() => {
    const taskItems = tasks.map((item) => ({
      id: `task-${item.id}`,
      type: "Task",
      category: item.category || categorize(item.title),
      title: item.title,
      date: item.due || item.createdAt?.slice(0, 10) || "",
    }));
    const noteItems = notes.map((item) => ({
      id: `note-${item.id}`,
      type: "Note",
      category: item.category || categorize(item.text),
      title: item.text,
      date: item.createdAt?.slice(0, 10) || "",
    }));
    const eventItems = events.map((item) => ({
      id: `event-${item.id}`,
      type: "Meeting",
      category: item.category || "Work",
      title: item.title,
      date: item.start?.slice(0, 10) || "",
    }));

    return [...taskItems, ...noteItems, ...eventItems]
      .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
      .slice(0, 10);
  }, [tasks, notes, events]);

  async function fetchGoogleEvents(token) {
    try {
      setCalendarStatus("Syncing Google Calendar…");
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 1);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 90);

      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      });

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error("Calendar access expired. Please reconnect.");

      const data = await response.json();
      const mapped = (data.items || [])
        .filter((item) => item.start?.dateTime && item.end?.dateTime)
        .map((item) => ({
          id: item.id,
          title: item.summary || "Busy",
          start: item.start.dateTime,
          end: item.end.dateTime,
          source: "google",
        }));

      setGoogleEvents(mapped);
      setCalendarStatus(`Google Calendar connected · ${mapped.length} upcoming events synced`);
    } catch (error) {
      setCalendarStatus(error.message || "Could not sync Google Calendar");
      setGoogleEvents([]);
    }
  }

  function connectGoogleCalendar() {
    if (!GOOGLE_CLIENT_ID) {
      setCalendarStatus("Google Calendar setup is not configured yet");
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setCalendarStatus("Google sign-in is still loading. Try again in a moment.");
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          setCalendarStatus("Google Calendar connection was not completed");
          return;
        }
        sessionStorage.setItem("voice-command-center.google-token", response.access_token);
        setGoogleToken(response.access_token);
        setCalendarStatus("Google Calendar connected");
      },
    });

    client.requestAccessToken({ prompt: googleToken ? "" : "consent" });
  }

  function disconnectGoogleCalendar() {
    if (googleToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(googleToken, () => {});
    }
    sessionStorage.removeItem("voice-command-center.google-token");
    setGoogleToken("");
    setGoogleEvents([]);
    setCalendarStatus("Calendar not connected");
  }

  async function createGoogleCalendarEvent(event) {
    if (!googleToken) return null;

    const body = {
      summary: event.title,
      description: "Created with Voice Command Center",
      start: { dateTime: event.start },
      end: { dateTime: event.end },
      conferenceData: {
        createRequest: {
          requestId: `voice-command-${crypto.randomUUID()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error?.message || "Could not create the Google Calendar event.");
    }

    const created = await response.json();
    await fetchGoogleEvents(googleToken);

    return {
      htmlLink: created.htmlLink,
      meetingUrl:
        created.hangoutLink ||
        created.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ||
        "",
    };
  }

  function speak(message) {
    if (!voiceReply || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.02;
    window.speechSynthesis.speak(utterance);
  }

  function processCommand(text) {
    const command = parseCommand(text);
    if (!command) return;

    setWeather(null);
    setPreview(command);
    setInput(text);
    setHistory((current) => [
      {
        id: crypto.randomUUID(),
        text,
        intent: command.label,
        category: categorize(text),
        timestamp: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 50));

    if (command.type === "answer") speak(`The time is ${command.title}`);
  }

  function startListening() {
    if (!supportsSpeech) {
      setStatus("Speech recognition is not supported in this browser");
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setListening(true);
      setStatus("Listening…");
      setInput("");
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);

      if (event.results[event.results.length - 1].isFinal) processCommand(transcript);
    };

    recognition.onerror = (event) => {
      setListening(false);
      setStatus(event.error === "not-allowed" ? "Microphone permission denied" : "Could not hear that clearly");
    };

    recognition.onend = () => {
      setListening(false);
      setStatus("Ready");
    };

    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
    setStatus("Ready");
  }

  async function fetchWeather(command) {
    setBusy(true);
    setWeather(null);

    try {
      let latitude;
      let longitude;
      let label = command.location || "Current location";

      if (command.location) {
        const geoResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(command.location)}&count=1&language=en&format=json`
        );
        const geo = await geoResponse.json();
        const result = geo.results?.[0];
        if (!result) throw new Error("I couldn't find that location.");
        latitude = result.latitude;
        longitude = result.longitude;
        label = [result.name, result.admin1, result.country].filter(Boolean).join(", ");
      } else {
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
          })
        );
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`
      );
      const data = await response.json();
      const current = data.current;

      setWeather({
        label,
        temperature: Math.round(current.temperature_2m),
        feels: Math.round(current.apparent_temperature),
        wind: Math.round(current.wind_speed_10m),
      });
      speak(`It is ${Math.round(current.temperature_2m)} degrees Fahrenheit.`);
    } catch (error) {
      setWeather({ error: error.message || "Unable to fetch weather." });
    } finally {
      setBusy(false);
    }
  }

  function executeAction() {
    if (!preview) return;

    if (preview.type === "task") {
      setTasks((current) => [{
        id: crypto.randomUUID(),
        title: preview.title,
        due: preview.due,
        category: preview.category,
        createdAt: new Date().toISOString(),
        done: false,
      }, ...current]);
      speak("Task added.");
      setPreview(null);
    } else if (preview.type === "note") {
      setNotes((current) => [{
        id: crypto.randomUUID(),
        text: preview.title,
        category: preview.category,
        createdAt: new Date().toISOString(),
      }, ...current]);
      speak("Note saved.");
      setPreview(null);
    } else if (preview.type === "open" || preview.type === "search" || preview.type === "music") {
      window.open(preview.url, "_blank", "noopener,noreferrer");
      speak("Opening it now.");
    } else if (preview.type === "clear_history") {
      setHistory([]);
      localStorage.removeItem(STORAGE.history);
      setPreview(null);
      speak("History cleared.");
    } else if (preview.type === "weather") {
      fetchWeather(preview);
    }
  }

  function scheduleMeeting() {
    if (!preview?.date || !preview?.time) return;

    const conflict = meetingConflict(events, preview);
    if (conflict) return;

    const start = new Date(`${preview.date}T${preview.time}:00`);
    const end = new Date(start.getTime() + preview.duration * 60000);
    const meetingUrl = `https://meet.jit.si/voice-command-${crypto.randomUUID().slice(0, 8)}`;

    const event = {
      id: crypto.randomUUID(),
      title: preview.title,
      start: start.toISOString(),
      end: end.toISOString(),
      meetingUrl,
      category: categorize(preview.title),
    };

    setEvents((current) => [event, ...current]);
    window.open(calendarUrl(event), "_blank", "noopener,noreferrer");
    speak("Meeting saved locally and opened in Google Calendar.");
    setPreview(null);
  }

  function downloadSpreadsheet() {
    if (!preview?.fields?.length) return;

    const rows = preview.rows || [];
    const data = rows.map((row) =>
      Object.fromEntries(preview.fields.map((field, index) => [field, row[index] || ""]))
    );

    if (!data.length) {
      data.push(Object.fromEntries(preview.fields.map((field) => [field, ""])));
    }

    const worksheet = XLSX.utils.json_to_sheet(data, { header: preview.fields });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, "voice-created-workbook.xlsx");
    speak("Your spreadsheet is ready.");
  }

  const examples = [
    "Schedule a meeting tomorrow at 2 pm for 30 minutes",
    "Create an Excel with columns name, email, status",
    "What is the weather in Chicago?",
    "Play Yellow by Coldplay",
    "Plan a trip to Miami",
    "Open LinkedIn",
  ];

  const conflict = preview?.type === "meeting" ? meetingConflict([...events, ...googleEvents], preview) : null;
  const completedTasks = tasks.filter((task) => task.done).length;

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Mic size={19} /></div>
          <div>
            <strong>Command Center</strong>
            <span>Voice-first personal operations</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className={googleToken ? "calendar-connect connected" : "calendar-connect"}
            onClick={googleToken ? disconnectGoogleCalendar : connectGoogleCalendar}
            title={calendarStatus}
          >
            <CalendarDays size={16} />
            {googleToken ? "Calendar connected" : "Connect Google Calendar"}
          </button>

          <select
            className="language-select"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-label="Transcription language"
          >
            {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>

          <button className="voice-toggle" onClick={() => setVoiceReply((value) => !value)}>
            {voiceReply ? <Volume2 size={16} /> : <VolumeX size={16} />}
            Voice responses {voiceReply ? "on" : "off"}
          </button>
        </div>
      </header>

      <section className="hero">
        <span className="eyebrow"><Sparkles size={14} /> VOICE TO ACTION</span>
        <h1>Say what you need.<br /><em>Get somewhere useful.</em></h1>
        <p>
          Create tasks and spreadsheets, plan meetings and trips, check weather,
          open apps, search the web, play music, capture notes, and keep everything
          organized on a dated timeline.
        </p>
      </section>

      <section className="workspace">
        <div className="command-panel">
          <div className="command-header">
            <div>
              <span className="section-label">COMMAND</span>
              <h2>What can I help with?</h2>
            </div>
            <span className={listening ? "status listening" : "status"}>{status}</span>
          </div>

          <button className={listening ? "mic-button active" : "mic-button"} onClick={listening ? stopListening : startListening}>
            <span className="mic-ring">{listening ? <MicOff size={30} /> : <Mic size={30} />}</span>
            <strong>{listening ? "Listening…" : "Tap to speak"}</strong>
            <span>{supportsSpeech ? `Transcribing in ${LANGUAGES.find(([code]) => code === language)?.[1]}` : "Use typed input in this browser"}</span>
          </button>

          <div className="divider"><span>or type a command</span></div>

          <form className="command-input" onSubmit={(event) => {
            event.preventDefault();
            processCommand(input);
          }}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="e.g. Schedule a meeting tomorrow at 2 pm" />
            <button aria-label="Submit command"><Send size={18} /></button>
          </form>

          <div className="examples">
            <span>Try saying</span>
            <div className="example-list">
              {examples.map((example) => (
                <button key={example} onClick={() => processCommand(example)}>“{example}”</button>
              ))}
            </div>
          </div>
        </div>

        <div className="action-panel">
          <div className="command-header">
            <div>
              <span className="section-label">ACTION PREVIEW</span>
              <h2>Understood action</h2>
            </div>
            <WandSparkles size={21} />
          </div>

          {!preview ? (
            <div className="empty-preview">
              <div><Sparkles size={25} /></div>
              <h3>No action yet</h3>
              <p>Your next command will be interpreted here before it runs.</p>
            </div>
          ) : (
            <div className="preview-card">
              <div className="intent-row">
                <div className="intent-icon"><ActionIcon type={preview.type} /></div>
                <div>
                  <span>Intent</span>
                  <strong>{preview.label}</strong>
                </div>
              </div>

              <div className="preview-body">
                <span>{preview.type === "answer" ? "Result" : "Interpreted request"}</span>
                <h3>{preview.title}</h3>
                <p>{preview.description}</p>

                {preview.type === "task" && (
                  <div className="inline-fields">
                    <label>Due date<input type="date" value={preview.due || ""} onChange={(e) => setPreview({ ...preview, due: e.target.value })} /></label>
                    <label>Category<input value={preview.category || ""} onChange={(e) => setPreview({ ...preview, category: e.target.value })} /></label>
                  </div>
                )}

                {preview.type === "meeting" && (
                  <>
                    <div className="inline-fields three">
                      <label>Date<input type="date" value={preview.date || ""} onChange={(e) => setPreview({ ...preview, date: e.target.value })} /></label>
                      <label>Time<input type="time" value={preview.time || ""} onChange={(e) => setPreview({ ...preview, time: e.target.value })} /></label>
                      <label>Minutes<input type="number" min="15" step="15" value={preview.duration} onChange={(e) => setPreview({ ...preview, duration: Number(e.target.value) })} /></label>
                    </div>
                    {conflict && <div className="conflict-alert"><Clock3 size={16} /> Conflicts with “{conflict.title}”. Choose another time before adding it.</div>}
                    {!conflict && preview.date && preview.time && <div className="success-alert"><CheckCircle2 size={16} /> No conflict with meetings saved in this assistant.</div>}
                    <p className="microcopy">A working Jitsi meeting link will be generated and included when Google Calendar opens.</p>
                  </>
                )}

                {preview.type === "spreadsheet" && (
                  <div className="sheet-builder">
                    <label>
                      Columns
                      <input
                        value={(preview.fields || []).join(", ")}
                        onChange={(e) => setPreview({
                          ...preview,
                          fields: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
                          rows: [],
                        })}
                        placeholder="Name, Email, Status"
                      />
                    </label>

                    {!!preview.fields?.length && (
                      <>
                        <div className="sheet-grid header-row">
                          {preview.fields.map((field) => <strong key={field}>{field}</strong>)}
                        </div>

                        {(preview.rows || []).map((row, rowIndex) => (
                          <div className="sheet-grid" key={rowIndex}>
                            {preview.fields.map((field, colIndex) => (
                              <input
                                key={field}
                                value={row[colIndex] || ""}
                                placeholder={field}
                                onChange={(e) => {
                                  const rows = [...preview.rows];
                                  rows[rowIndex] = [...rows[rowIndex]];
                                  rows[rowIndex][colIndex] = e.target.value;
                                  setPreview({ ...preview, rows });
                                }}
                              />
                            ))}
                          </div>
                        ))}

                        <button className="secondary-action" onClick={() => setPreview({
                          ...preview,
                          rows: [...(preview.rows || []), preview.fields.map(() => "")],
                        })}>
                          <Plus size={15} /> Add row
                        </button>
                      </>
                    )}
                  </div>
                )}

                {preview.type === "travel" && (
                  <div className="travel-builder">
                    <label>Destination<input value={preview.destination || ""} onChange={(e) => setPreview({ ...preview, destination: e.target.value, title: e.target.value ? `Trip to ${e.target.value}` : "Trip planner" })} placeholder="Destination" /></label>
                    <div className="inline-fields">
                      <label>Start<input type="date" value={preview.startDate || ""} onChange={(e) => setPreview({ ...preview, startDate: e.target.value })} /></label>
                      <label>End<input type="date" value={preview.endDate || ""} onChange={(e) => setPreview({ ...preview, endDate: e.target.value })} /></label>
                    </div>
                  </div>
                )}

                {preview.type === "weather" && weather && (
                  weather.error ? <div className="conflict-alert">{weather.error}</div> :
                  <div className="weather-result">
                    <CloudSun size={24} />
                    <div><strong>{weather.temperature}°F</strong><span>{weather.label}</span></div>
                    <small>Feels {weather.feels}° · Wind {weather.wind} mph</small>
                  </div>
                )}

                {!["answer", "weather", "clear_history"].includes(preview.type) && (
                  <div className="next-steps">
                    <span>Suggested next steps</span>
                    <ul>{nextStepsFor(preview.title, preview.type).map((step) => <li key={step}>{step}</li>)}</ul>
                  </div>
                )}
              </div>

              <div className="preview-actions">
                {preview.type === "meeting" && (
                  <button className="confirm" disabled={!preview.date || !preview.time || Boolean(conflict)} onClick={scheduleMeeting}>
                    <CalendarDays size={17} /> {googleToken ? (busy ? "Adding…" : "Add to Google Calendar") : "Create calendar draft"}
                  </button>
                )}

                {preview.type === "spreadsheet" && (
                  <button className="confirm" disabled={!preview.fields?.length} onClick={downloadSpreadsheet}>
                    <Download size={17} /> Download .xlsx
                  </button>
                )}

                {preview.type === "travel" && preview.destination && (
                  <>
                    <button className="confirm" onClick={() => window.open(`https://www.google.com/travel/flights?q=${encodeURIComponent("flights to " + preview.destination)}`, "_blank", "noopener,noreferrer")}>
                      <Plane size={16} /> Flights
                    </button>
                    <button className="cancel" onClick={() => window.open(`https://www.airbnb.com/s/${encodeURIComponent(preview.destination)}/homes`, "_blank", "noopener,noreferrer")}>
                      <MapPin size={16} /> Airbnb
                    </button>
                    <button className="cancel" onClick={() => window.open(`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(preview.destination)}`, "_blank", "noopener,noreferrer")}>
                      <ExternalLink size={16} /> Hotels
                    </button>
                  </>
                )}

                {!["meeting", "spreadsheet", "travel", "answer"].includes(preview.type) && (
                  <button className="confirm" disabled={busy} onClick={executeAction}>
                    <Check size={17} />
                    {preview.type === "task" ? "Add task" :
                      preview.type === "note" ? "Save note" :
                      preview.type === "weather" ? (busy ? "Checking…" : "Get weather") :
                      preview.type === "clear_history" ? "Clear history" : "Continue"}
                  </button>
                )}

                <button className="cancel" onClick={() => { setPreview(null); setWeather(null); }}>
                  <X size={16} /> Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard expanded-dashboard">
        <article className="data-card">
          <div className="data-heading">
            <div><span className="section-label">TASKS</span><h2>Action list</h2></div>
            <span className="metric">{tasks.length - completedTasks} open</span>
          </div>

          <div className="item-list">
            {tasks.length === 0 ? <p className="empty-copy">Voice-created tasks will appear here.</p> :
              tasks.slice(0, 6).map((task) => (
                <div className={task.done ? "list-item done" : "list-item"} key={task.id}>
                  <button className="check-button" onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))}>
                    {task.done && <Check size={14} />}
                  </button>
                  <div className="item-copy">
                    <strong>{task.title}</strong>
                    <span>{task.category} · {task.due ? `Due ${task.due}` : "No due date"}</span>
                  </div>
                  <button className="delete-button" onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}><Trash2 size={14} /></button>
                </div>
              ))}
          </div>
        </article>

        <article className="data-card">
          <div className="data-heading">
            <div><span className="section-label">NOTES</span><h2>Captured thoughts</h2></div>
            <span className="metric">{notes.length} saved</span>
          </div>

          <div className="note-grid">
            {notes.length === 0 ? <p className="empty-copy">Say “note that…” to capture something quickly.</p> :
              notes.slice(0, 4).map((note) => (
                <div className="note-card" key={note.id}>
                  <FileText size={16} />
                  <span className="note-category">{note.category}</span>
                  <p>{note.text}</p>
                  <button onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))}><Trash2 size={13} /></button>
                </div>
              ))}
          </div>
        </article>

        <article className="data-card timeline-card">
          <div className="data-heading">
            <div><span className="section-label">TIMELINE</span><h2>Dated by category</h2></div>
            <CalendarDays size={19} />
          </div>

          <div className="history-list">
            {timeline.length === 0 ? <p className="empty-copy">Dated tasks, notes, and meetings will appear here.</p> :
              timeline.map((entry) => (
                <div className="history-item" key={entry.id}>
                  <div className="history-dot" />
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{entry.date || "Unscheduled"} · {entry.category} · {entry.type}</span>
                  </div>
                </div>
              ))}
          </div>
        </article>

        <article className="data-card history-card">
          <div className="data-heading">
            <div><span className="section-label">HISTORY</span><h2>Recent commands</h2></div>
            <button className="clear-link" onClick={() => processCommand("clear history")}><History size={16} /> Clear</button>
          </div>

          <div className="history-list">
            {history.length === 0 ? <p className="empty-copy">Your interpreted commands will appear here.</p> :
              history.slice(0, 7).map((entry) => (
                <div className="history-item" key={entry.id}>
                  <div className="history-dot" />
                  <div><strong>{entry.text}</strong><span>{entry.category} · {entry.intent}</span></div>
                </div>
              ))}
          </div>
        </article>
      </section>

      <footer>
        <div className="footer-note"><CheckCircle2 size={16} /> External actions stay visible and user-controlled.</div>
        <span>{googleToken ? calendarStatus : "Tasks, notes, meetings, and history are stored locally in your browser."}</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
