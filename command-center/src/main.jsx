import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
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

const SITES = {
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

function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(text) {
  const lower = text.toLowerCase();
  const now = new Date();

  if (lower.includes("today")) return localDate(now);

  if (lower.includes("tomorrow")) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return localDate(date);
  }

  const weekdays = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  for (const [name, number] of Object.entries(weekdays)) {
    if (lower.includes(name)) {
      const date = new Date(now);
      let delta = (number - now.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      date.setDate(date.getDate() + delta);
      return localDate(date);
    }
  }

  const iso = text.match(/\b20\d{2}-\d{2}-\d{2}\b/);
  return iso?.[0] || "";
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
  const minutes = text.match(/(\d+)\s*(minute|minutes|min)\b/i);
  if (minutes) return Number(minutes[1]);

  const hours = text.match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)\b/i);
  if (hours) return Math.round(Number(hours[1]) * 60);

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

function categoryFor(text) {
  const lower = text.toLowerCase();

  if (/job|resume|interview|application|recruiter|linkedin|career/.test(lower)) return "Career";
  if (/trip|flight|hotel|airbnb|travel|vacation|airport/.test(lower)) return "Travel";
  if (/invoice|expense|payment|budget|finance|bank/.test(lower)) return "Finance";
  if (/course|study|class|exam|learn|assignment/.test(lower)) return "Learning";
  if (/doctor|health|gym|workout|medication/.test(lower)) return "Health";
  if (/meeting|client|project|presentation|report|work/.test(lower)) return "Work";
  return "Personal";
}

function keywordsFor(text) {
  const stop = new Set([
    "the", "a", "an", "to", "for", "and", "or", "in", "on", "at", "with", "my",
    "me", "i", "of", "is", "it", "that", "this", "tomorrow", "today"
  ]);

  return [...new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stop.has(word))
  )].slice(0, 5);
}

function nextStepsFor(text, type) {
  const lower = text.toLowerCase();

  if (/application|interview|recruiter|resume/.test(lower)) {
    return ["Review the role requirements", "Tailor the application materials", "Set a follow-up reminder"];
  }

  if (type === "meeting") {
    return ["Add an agenda", "Confirm attendees", "Prepare any notes or links"];
  }

  if (type === "travel") {
    return ["Compare flights", "Check stays near your priorities", "Review weather before booking"];
  }

  if (type === "spreadsheet") {
    return ["Confirm your columns", "Add the first rows", "Download the workbook"];
  }

  if (type === "task") {
    return ["Confirm the due date", "Define the first concrete step", "Block time if it is high priority"];
  }

  return ["Review the interpreted action", "Add any missing details", "Continue when it looks right"];
}

function parseFields(text) {
  const match = text.match(/(?:fields|columns?)\s+(?:are\s+)?(.+)/i);
  if (!match) return [];

  return match[1]
    .replace(/\band\b/gi, ",")
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function meetingConflict(events, draft) {
  if (!draft?.date || !draft?.time) return null;

  const start = new Date(`${draft.date}T${draft.time}:00`);
  const end = new Date(start.getTime() + Number(draft.duration || 30) * 60000);

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
    details: `Meeting link: ${event.meetingUrl}\nCreated with Voice Command Center`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function youtubeSearch(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

async function resolveYouTubeFirstResult(query) {
  try {
    const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error("Search unavailable");
    const data = await response.json();
    return data.url || youtubeSearch(query);
  } catch {
    return youtubeSearch(query);
  }
}

function parseCommand(raw) {
  const text = normalize(raw);
  if (!text) return null;

  if (/^(clear|delete|erase) (my )?(command )?history$/i.test(text)) {
    return {
      type: "clear_history",
      label: "Clear history",
      title: "Clear command history",
      description: "This removes command history saved in this browser.",
    };
  }

  if (/\b(weather|temperature|forecast)\b/i.test(text)) {
    const location = text.match(/\bin\s+(.+)$/i)?.[1]?.trim() || "";
    return {
      type: "weather",
      label: "Check weather",
      title: location || "Current location",
      location,
      description: "I can fetch live current conditions.",
    };
  }

  if (/\b(create|make|build)\b.*\b(excel|spreadsheet|workbook|sheet)\b/i.test(text)) {
    const fields = parseFields(text);
    return {
      type: "spreadsheet",
      label: "Create spreadsheet",
      title: "New spreadsheet",
      fields,
      rows: [],
      description: fields.length
        ? `I found ${fields.length} columns. Add rows and download the workbook.`
        : "Add the column names you want in the sheet.",
    };
  }

  if (/\b(schedule|book|set up|create)\b.*\b(meeting|call|appointment|sync)\b/i.test(text)) {
    const date = parseDate(text);
    const time = parseTime(text);
    const duration = parseDuration(text);
    const title = stripPlanningWords(
      text.replace(/^(schedule|book|set up|create)\s+(a\s+)?/i, "")
    ) || "New meeting";

    return {
      type: "meeting",
      label: "Schedule meeting",
      title,
      date,
      time,
      duration,
      description: date && time
        ? "I’ll check your locally saved meetings for conflicts."
        : "Add the missing date or time before scheduling.",
    };
  }

  if (/\b(play|listen to)\b.+/i.test(text)) {
    const song = text
      .replace(/^.*?\b(play|listen to)\b\s*/i, "")
      .replace(/\bon youtube\b/i, "")
      .trim();

    return {
      type: "music",
      label: "Play music",
      title: song || "YouTube",
      url: youtubeSearch(song || ""),
      description: "I’ll open YouTube results for this request.",
    };
  }

  if (/\b(plan|book|find)\b.*\b(trip|flight|flights|hotel|hotels|airbnb|stay|vacation)\b/i.test(text)) {
    const destination =
      text.match(/\bto\s+([a-zA-Z .'-]+?)(?:\s+(?:from|on|for|next|this|tomorrow|today)\b|$)/i)?.[1]?.trim() || "";

    return {
      type: "travel",
      label: "Plan travel",
      title: destination ? `Trip to ${destination}` : "Trip planner",
      destination,
      startDate: parseDate(text),
      endDate: "",
      description: "I’ll prepare direct flight, Airbnb, hotel, map, and web-research shortcuts.",
    };
  }

  const taskPatterns = [
    /^remind me to\s+(.+)/i,
    /^create (?:a )?task\s+(.+)/i,
    /^add (?:a )?task\s+(.+)/i,
    /^task\s+(.+)/i,
    /^i need to\s+(.+)/i,
    /^todo\s+(.+)/i,
    /^i have to\s+(.+)/i,
    /^make sure i\s+(.+)/i,
  ];

  for (const pattern of taskPatterns) {
    const match = text.match(pattern);
    if (match) {
      const title = stripPlanningWords(match[1]);
      return {
        type: "task",
        label: "Create task",
        title,
        due: parseDate(text),
        category: categoryFor(title),
        keywords: keywordsFor(title),
        description: "I’ve structured this as a task and suggested useful next steps.",
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
        category: categoryFor(match[1]),
        keywords: keywordsFor(match[1]),
        description: "This will be timestamped, categorized, and added to your timeline.",
      };
    }
  }

  const openMatch = text.match(/^open\s+(.+)/i);
  if (openMatch) {
    const destination = openMatch[1].trim();
    const key = Object.keys(SITES).find((site) => destination.toLowerCase().includes(site));

    return {
      type: "open",
      label: "Open website",
      title: key ? key.replace(/\b\w/g, (char) => char.toUpperCase()) : destination,
      url: key ? SITES[key] : `https://www.google.com/search?q=${encodeURIComponent(destination)}`,
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
    return {
      type: "answer",
      label: "Current time",
      title: new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date()),
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
    const taskItems = tasks.map((task) => ({
      id: `task-${task.id}`,
      type: "Task",
      title: task.title,
      category: task.category || categoryFor(task.title),
      date: task.due || task.createdAt?.slice(0, 10) || "",
    }));

    const noteItems = notes.map((note) => ({
      id: `note-${note.id}`,
      type: "Note",
      title: note.text,
      category: note.category || categoryFor(note.text),
      date: note.createdAt?.slice(0, 10) || "",
    }));

    const eventItems = events.map((event) => ({
      id: `event-${event.id}`,
      type: "Meeting",
      title: event.title,
      category: event.category || "Work",
      date: event.start?.slice(0, 10) || "",
    }));

    return [...taskItems, ...noteItems, ...eventItems]
      .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
      .slice(0, 12);
  }, [tasks, notes, events]);

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
        category: categoryFor(text),
        timestamp: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 50));

    if (command.type === "answer") {
      speak(`The time is ${command.title}`);
    }
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

      if (event.results[event.results.length - 1].isFinal) {
        processCommand(transcript);
      }
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
        const geocodeResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(command.location)}&count=1&language=en&format=json`
        );
        const geocode = await geocodeResponse.json();
        const place = geocode.results?.[0];

        if (!place) throw new Error("I couldn’t find that location.");

        latitude = place.latitude;
        longitude = place.longitude;
        label = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
      } else {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            enableHighAccuracy: false,
          });
        });

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`
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
      setTasks((current) => [
        {
          id: crypto.randomUUID(),
          title: preview.title,
          due: preview.due,
          category: preview.category,
          keywords: preview.keywords || [],
          createdAt: new Date().toISOString(),
          done: false,
        },
        ...current,
      ]);
      speak("Task added.");
      setPreview(null);
      setInput("");
      return;
    }

    if (preview.type === "note") {
      setNotes((current) => [
        {
          id: crypto.randomUUID(),
          text: preview.title,
          category: preview.category,
          keywords: preview.keywords || [],
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      speak("Note saved.");
      setPreview(null);
      setInput("");
      return;
    }

    if (preview.type === "music") {
      const query = preview.title;
      resolveYouTubeFirstResult(query).then((url) => {
        window.open(url, "_blank", "noopener,noreferrer");
      });
      speak("Opening the first YouTube result.");
      return;
    }

    if (preview.type === "open" || preview.type === "search") {
      window.open(preview.url, "_blank", "noopener,noreferrer");
      speak("Opening it now.");
      return;
    }

    if (preview.type === "clear_history") {
      setHistory([]);
      localStorage.removeItem(STORAGE.history);
      setPreview(null);
      speak("History cleared.");
      return;
    }

    if (preview.type === "weather") {
      fetchWeather(preview);
    }
  }

  function scheduleMeeting() {
    if (!preview?.date || !preview?.time) return;

    const conflict = meetingConflict(events, preview);
    if (conflict) return;

    const start = new Date(`${preview.date}T${preview.time}:00`);
    const end = new Date(start.getTime() + Number(preview.duration || 30) * 60000);
    const meetingUrl = `https://meet.jit.si/voice-command-${crypto.randomUUID().slice(0, 8)}`;

    const event = {
      id: crypto.randomUUID(),
      title: preview.title,
      start: start.toISOString(),
      end: end.toISOString(),
      meetingUrl,
      category: categoryFor(preview.title),
    };

    setEvents((current) => [event, ...current]);
    window.open(calendarUrl(event), "_blank", "noopener,noreferrer");
    speak("Meeting saved locally and opened as a Google Calendar draft.");
    setPreview(null);
  }

  function downloadSpreadsheet() {
    if (!preview?.fields?.length) return;

    const fields = preview.fields;
    const rows = preview.rows?.length ? preview.rows : [fields.map(() => "")];

    const escape = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const headerHtml = fields.map((field) => `<th>${escape(field)}</th>`).join("");
    const rowHtml = rows.map((row) =>
      `<tr>${fields.map((_, index) => `<td>${escape(row[index])}</td>`).join("")}</tr>`
    ).join("");

    const html = `<html><body><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowHtml}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "voice-created-spreadsheet.xls";
    link.click();

    URL.revokeObjectURL(url);
    speak("Your spreadsheet is ready.");
  }

  const examples = [
    "Schedule a meeting tomorrow at 2 pm for 30 minutes",
    "Create an Excel with columns company, role, recruiter, status",
    "What is the weather in Chicago?",
    "Play Yellow by Coldplay",
    "Plan a trip to Miami",
    "Open LinkedIn",
  ];

  const conflict = preview?.type === "meeting" ? meetingConflict(events, preview) : null;
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
          <select
            className="language-select"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-label="Transcription language"
          >
            {LANGUAGES.map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
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

          <button
            className={listening ? "mic-button active" : "mic-button"}
            onClick={listening ? stopListening : startListening}
          >
            <span className="mic-ring">
              {listening ? <MicOff size={30} /> : <Mic size={30} />}
            </span>
            <strong>{listening ? "Listening…" : "Tap to speak"}</strong>
            <span>
              {supportsSpeech
                ? `Transcribing in ${LANGUAGES.find(([code]) => code === language)?.[1]}`
                : "Use typed input in this browser"}
            </span>
          </button>

          <div className="divider"><span>or type a command</span></div>

          <form
            className="command-input"
            onSubmit={(event) => {
              event.preventDefault();
              processCommand(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="e.g. Schedule a meeting tomorrow at 2 pm"
            />
            <button aria-label="Submit command"><Send size={18} /></button>
          </form>

          <div className="examples">
            <span>Try saying</span>
            <div className="example-list">
              {examples.map((example) => (
                <button key={example} onClick={() => processCommand(example)}>
                  “{example}”
                </button>
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
                <span>Interpreted request</span>
                <h3>{preview.title}</h3>
                <p>{preview.description}</p>

                {preview.type === "task" && (
                  <>
                    <div className="inline-fields">
                      <label>
                        Due date
                        <input
                          type="date"
                          value={preview.due || ""}
                          onChange={(event) => setPreview({ ...preview, due: event.target.value })}
                        />
                      </label>
                      <label>
                        Category
                        <input
                          value={preview.category || ""}
                          onChange={(event) => setPreview({ ...preview, category: event.target.value })}
                        />
                      </label>
                    </div>

                    {!!preview.keywords?.length && (
                      <div className="keyword-row">
                        {preview.keywords.map((keyword) => <span key={keyword}>#{keyword}</span>)}
                      </div>
                    )}
                  </>
                )}

                {preview.type === "meeting" && (
                  <>
                    <div className="inline-fields three">
                      <label>
                        Date
                        <input
                          type="date"
                          value={preview.date || ""}
                          onChange={(event) => setPreview({ ...preview, date: event.target.value })}
                        />
                      </label>
                      <label>
                        Time
                        <input
                          type="time"
                          value={preview.time || ""}
                          onChange={(event) => setPreview({ ...preview, time: event.target.value })}
                        />
                      </label>
                      <label>
                        Minutes
                        <input
                          type="number"
                          min="15"
                          step="15"
                          value={preview.duration}
                          onChange={(event) => setPreview({ ...preview, duration: Number(event.target.value) })}
                        />
                      </label>
                    </div>

                    {conflict && (
                      <div className="conflict-alert">
                        <Clock3 size={16} />
                        Conflicts with “{conflict.title}”. Pick another time.
                      </div>
                    )}

                    {!conflict && preview.date && preview.time && (
                      <div className="success-alert">
                        <CheckCircle2 size={16} />
                        No conflict with meetings saved in this assistant.
                      </div>
                    )}

                    <p className="microcopy">
                      Google account sync is disabled for now. The assistant creates a Jitsi link and opens a prefilled Google Calendar draft.
                    </p>
                  </>
                )}

                {preview.type === "spreadsheet" && (
                  <div className="sheet-builder">
                    <label>
                      Columns
                      <input
                        value={(preview.fields || []).join(", ")}
                        onChange={(event) => setPreview({
                          ...preview,
                          fields: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                          rows: [],
                        })}
                        placeholder="Company, Role, Recruiter, Status"
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
                                onChange={(event) => {
                                  const rows = [...preview.rows];
                                  rows[rowIndex] = [...rows[rowIndex]];
                                  rows[rowIndex][colIndex] = event.target.value;
                                  setPreview({ ...preview, rows });
                                }}
                              />
                            ))}
                          </div>
                        ))}

                        <button
                          className="secondary-action"
                          onClick={() => setPreview({
                            ...preview,
                            rows: [...(preview.rows || []), preview.fields.map(() => "")],
                          })}
                        >
                          <Plus size={15} />
                          Add row
                        </button>
                      </>
                    )}
                  </div>
                )}

                {preview.type === "travel" && (
                  <div className="travel-builder">
                    <label>
                      Destination
                      <input
                        value={preview.destination || ""}
                        onChange={(event) => setPreview({
                          ...preview,
                          destination: event.target.value,
                          title: event.target.value ? `Trip to ${event.target.value}` : "Trip planner",
                        })}
                        placeholder="Destination"
                      />
                    </label>

                    <div className="inline-fields">
                      <label>
                        Start
                        <input
                          type="date"
                          value={preview.startDate || ""}
                          onChange={(event) => setPreview({ ...preview, startDate: event.target.value })}
                        />
                      </label>
                      <label>
                        End
                        <input
                          type="date"
                          value={preview.endDate || ""}
                          onChange={(event) => setPreview({ ...preview, endDate: event.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {preview.type === "weather" && weather && (
                  weather.error ? (
                    <div className="conflict-alert">{weather.error}</div>
                  ) : (
                    <div className="weather-result">
                      <CloudSun size={24} />
                      <div>
                        <strong>{weather.temperature}°F</strong>
                        <span>{weather.label}</span>
                      </div>
                      <small>Feels {weather.feels}° · Wind {weather.wind} mph</small>
                    </div>
                  )
                )}

                {!["answer", "weather", "clear_history"].includes(preview.type) && (
                  <div className="next-steps">
                    <span>Suggested next steps</span>
                    <ul>
                      {nextStepsFor(preview.title, preview.type).map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="preview-actions">
                {preview.type === "meeting" && (
                  <button
                    className="confirm"
                    disabled={!preview.date || !preview.time || Boolean(conflict)}
                    onClick={scheduleMeeting}
                  >
                    <CalendarDays size={17} />
                    Create calendar draft
                  </button>
                )}

                {preview.type === "spreadsheet" && (
                  <button
                    className="confirm"
                    disabled={!preview.fields?.length}
                    onClick={downloadSpreadsheet}
                  >
                    <Download size={17} />
                    Download Excel file
                  </button>
                )}

                {preview.type === "travel" && preview.destination && (
                  <>
                    <button
                      className="confirm"
                      onClick={() => window.open(
                        `https://www.google.com/travel/flights?q=${encodeURIComponent("flights to " + preview.destination)}`,
                        "_blank",
                        "noopener,noreferrer"
                      )}
                    >
                      <Plane size={16} />
                      Flights
                    </button>

                    <button
                      className="cancel"
                      onClick={() => window.open(
                        `https://www.airbnb.com/s/${encodeURIComponent(preview.destination)}/homes`,
                        "_blank",
                        "noopener,noreferrer"
                      )}
                    >
                      <MapPin size={16} />
                      Airbnb
                    </button>

                    <button
                      className="cancel"
                      onClick={() => window.open(
                        `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(preview.destination)}`,
                        "_blank",
                        "noopener,noreferrer"
                      )}
                    >
                      <ExternalLink size={16} />
                      Hotels
                    </button>

                    <button
                      className="cancel"
                      onClick={() => window.open(
                        `https://www.google.com/search?q=${encodeURIComponent("things to do in " + preview.destination)}`,
                        "_blank",
                        "noopener,noreferrer"
                      )}
                    >
                      <Search size={16} />
                      Research
                    </button>
                  </>
                )}

                {!["meeting", "spreadsheet", "travel", "answer"].includes(preview.type) && (
                  <button className="confirm" disabled={busy} onClick={executeAction}>
                    <Check size={17} />
                    {preview.type === "task"
                      ? "Add task"
                      : preview.type === "note"
                      ? "Save note"
                      : preview.type === "weather"
                      ? busy ? "Checking…" : "Get weather"
                      : preview.type === "clear_history"
                      ? "Clear history"
                      : "Continue"}
                  </button>
                )}

                <button
                  className="cancel"
                  onClick={() => {
                    setPreview(null);
                    setWeather(null);
                  }}
                >
                  <X size={16} />
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard">
        <article className="data-card">
          <div className="data-heading">
            <div>
              <span className="section-label">TASKS</span>
              <h2>Action list</h2>
            </div>
            <span className="metric">{tasks.length - completedTasks} open</span>
          </div>

          <div className="item-list">
            {tasks.length === 0 ? (
              <p className="empty-copy">Voice-created tasks will appear here.</p>
            ) : (
              tasks.slice(0, 7).map((task) => (
                <div className={task.done ? "list-item done" : "list-item"} key={task.id}>
                  <button
                    className="check-button"
                    onClick={() =>
                      setTasks((current) =>
                        current.map((item) =>
                          item.id === task.id ? { ...item, done: !item.done } : item
                        )
                      )
                    }
                  >
                    {task.done && <Check size={14} />}
                  </button>

                  <div className="item-copy">
                    <strong>{task.title}</strong>
                    <span>{task.category} · {task.due ? `Due ${task.due}` : "No due date"}</span>
                  </div>

                  <button
                    className="delete-button"
                    onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="data-card">
          <div className="data-heading">
            <div>
              <span className="section-label">NOTES</span>
              <h2>Captured thoughts</h2>
            </div>
            <span className="metric">{notes.length} saved</span>
          </div>

          <div className="note-grid">
            {notes.length === 0 ? (
              <p className="empty-copy">Say “note that…” to capture something quickly.</p>
            ) : (
              notes.slice(0, 4).map((note) => (
                <div className="note-card" key={note.id}>
                  <FileText size={16} />
                  <span className="note-category">{note.category}</span>
                  <p>{note.text}</p>
                  <button
                    onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="data-card">
          <div className="data-heading">
            <div>
              <span className="section-label">TIMELINE</span>
              <h2>Dated by category</h2>
            </div>
            <CalendarDays size={19} />
          </div>

          <div className="history-list">
            {timeline.length === 0 ? (
              <p className="empty-copy">Dated tasks, notes, and meetings will appear here.</p>
            ) : (
              timeline.map((entry) => (
                <div className="history-item" key={entry.id}>
                  <div className="history-dot" />
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{entry.date || "Unscheduled"} · {entry.category} · {entry.type}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="data-card history-card">
          <div className="data-heading">
            <div>
              <span className="section-label">HISTORY</span>
              <h2>Recent commands</h2>
            </div>

            <button className="clear-link" onClick={() => processCommand("clear history")}>
              <History size={16} />
              Clear
            </button>
          </div>

          <div className="history-list">
            {history.length === 0 ? (
              <p className="empty-copy">Your interpreted commands will appear here.</p>
            ) : (
              history.slice(0, 7).map((entry) => (
                <div className="history-item" key={entry.id}>
                  <div className="history-dot" />
                  <div>
                    <strong>{entry.text}</strong>
                    <span>{entry.category} · {entry.intent}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <footer>
        <div className="footer-note">
          <CheckCircle2 size={16} />
          External actions stay visible and user-controlled.
        </div>
        <span>Tasks, notes, meetings, and history are stored locally in your browser.</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
