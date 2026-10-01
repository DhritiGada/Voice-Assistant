import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  History,
  ListTodo,
  Mic,
  MicOff,
  NotebookPen,
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

function parseDueDate(text) {
  const lower = text.toLowerCase();
  const now = new Date();

  if (lower.includes("tomorrow")) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  if (lower.includes("today")) {
    return now.toISOString().slice(0, 10);
  }

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
      return date.toISOString().slice(0, 10);
    }
  }

  return "";
}

function stripDateWords(text) {
  return text
    .replace(/\b(today|tomorrow|this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCommand(raw) {
  const text = normalize(raw);
  const lower = text.toLowerCase();

  if (!text) return null;

  const taskPatterns = [
    /^remind me to\s+(.+)/i,
    /^create (?:a )?task\s+(.+)/i,
    /^add (?:a )?task\s+(.+)/i,
    /^task\s+(.+)/i,
  ];

  for (const pattern of taskPatterns) {
    const match = text.match(pattern);
    if (match) {
      const due = parseDueDate(text);
      return {
        type: "task",
        label: "Create task",
        title: stripDateWords(match[1]),
        due,
        description: due ? "Task ready with a detected due date." : "Task ready to add.",
      };
    }
  }

  const notePatterns = [
    /^note that\s+(.+)/i,
    /^take (?:a )?note\s+(.+)/i,
    /^save (?:a )?note\s+(.+)/i,
    /^remember\s+(.+)/i,
  ];

  for (const pattern of notePatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        type: "note",
        label: "Save note",
        title: match[1].trim(),
        description: "This note will be saved locally in your browser.",
      };
    }
  }

  const openMatch = text.match(/^open\s+(.+)/i);
  if (openMatch) {
    const destination = openMatch[1].trim();
    const sites = {
      google: "https://google.com",
      youtube: "https://youtube.com",
      github: "https://github.com",
      linkedin: "https://linkedin.com",
      gmail: "https://mail.google.com",
      calendar: "https://calendar.google.com",
      "stack overflow": "https://stackoverflow.com",
    };
    const key = Object.keys(sites).find((site) => destination.toLowerCase().includes(site));
    return {
      type: "open",
      label: "Open website",
      title: key ? key.replace(/\b\w/g, (c) => c.toUpperCase()) : destination,
      url: key ? sites[key] : /^https?:\/\//i.test(destination) ? destination : `https://www.google.com/search?q=${encodeURIComponent(destination)}`,
      description: key ? "Ready to open this destination." : "No direct shortcut found, so this will open a web search.",
    };
  }

  const searchMatch = text.match(/^(?:search(?: the web)? for|google)\s+(.+)/i);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    return {
      type: "search",
      label: "Search web",
      title: query,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      description: "Ready to search the web.",
    };
  }

  if (/\b(what time|current time|time is it)\b/i.test(text)) {
    const time = new Intl.DateTimeFormat([], {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());

    return {
      type: "answer",
      label: "Current time",
      title: time,
      description: "Based on your device time.",
    };
  }

  return {
    type: "unknown",
    label: "Command not recognized",
    title: text,
    description: "Try creating a task, saving a note, opening a site, or searching the web.",
  };
}

function ActionIcon({ type }) {
  if (type === "task") return <ListTodo size={19} />;
  if (type === "note") return <NotebookPen size={19} />;
  if (type === "search") return <Search size={19} />;
  if (type === "open") return <ExternalLink size={19} />;
  if (type === "answer") return <Clock3 size={19} />;
  return <Sparkles size={19} />;
}

function App() {
  const [tasks, setTasks] = useState(() => load(STORAGE.tasks, []));
  const [notes, setNotes] = useState(() => load(STORAGE.notes, []));
  const [history, setHistory] = useState(() => load(STORAGE.history, []));
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceReply, setVoiceReply] = useState(true);
  const [status, setStatus] = useState("Ready");
  const recognitionRef = useRef(null);

  useEffect(() => save(STORAGE.tasks, tasks), [tasks]);
  useEffect(() => save(STORAGE.notes, notes), [notes]);
  useEffect(() => save(STORAGE.history, history), [history]);

  const supportsSpeech = useMemo(
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

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

    setPreview(command);
    setInput(text);
    setHistory((current) => [
      {
        id: crypto.randomUUID(),
        text,
        intent: command.label,
        timestamp: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 30));

    if (command.type === "answer") speak(`The time is ${command.title}`);
  }

  function startListening() {
    if (!supportsSpeech) {
      setStatus("Speech recognition is not supported in this browser");
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = "en-US";
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

  function executeAction() {
    if (!preview) return;

    if (preview.type === "task") {
      setTasks((current) => [
        {
          id: crypto.randomUUID(),
          title: preview.title,
          due: preview.due,
          done: false,
        },
        ...current,
      ]);
      speak("Task added.");
    } else if (preview.type === "note") {
      setNotes((current) => [
        {
          id: crypto.randomUUID(),
          text: preview.title,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      speak("Note saved.");
    } else if (preview.type === "open" || preview.type === "search") {
      window.open(preview.url, "_blank", "noopener,noreferrer");
      speak(preview.type === "search" ? "Opening your search." : "Opening it now.");
    }

    setPreview(null);
    setInput("");
  }

  const examples = [
    "Remind me to submit my application tomorrow",
    "Note that the recruiter asked about SQL",
    "Open LinkedIn",
    "Search for product manager interview questions",
  ];

  const completedTasks = tasks.filter((task) => task.done).length;

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Mic size={19} /></div>
          <div>
            <strong>Command Center</strong>
            <span>Voice-first productivity</span>
          </div>
        </div>
        <button
          className="voice-toggle"
          onClick={() => setVoiceReply((value) => !value)}
        >
          {voiceReply ? <Volume2 size={16} /> : <VolumeX size={16} />}
          Voice responses {voiceReply ? "on" : "off"}
        </button>
      </header>

      <section className="hero">
        <span className="eyebrow"><Sparkles size={14} /> VOICE TO ACTION</span>
        <h1>Say what you need.<br /><em>See what will happen.</em></h1>
        <p>
          Turn natural voice commands into structured tasks, notes, searches, and
          quick actions with a visible confirmation step before anything happens.
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
            <span>{supportsSpeech ? "Microphone input" : "Use typed input in this browser"}</span>
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
              placeholder="e.g. Remind me to send the report tomorrow"
            />
            <button aria-label="Submit command"><Send size={18} /></button>
          </form>

          <div className="examples">
            <span>Try saying</span>
            <div className="example-list">
              {examples.map((example) => (
                <button
                  key={example}
                  onClick={() => processCommand(example)}
                >
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
                <span>{preview.type === "task" ? "Task" : preview.type === "note" ? "Content" : preview.type === "answer" ? "Result" : "Destination"}</span>
                <h3>{preview.title}</h3>
                {preview.due && (
                  <div className="due-pill"><Clock3 size={14} /> Due {preview.due}</div>
                )}
                <p>{preview.description}</p>
              </div>

              <div className="preview-actions">
                {preview.type !== "unknown" && preview.type !== "answer" && (
                  <button className="confirm" onClick={executeAction}>
                    <Check size={17} />
                    {preview.type === "task" ? "Add task" : preview.type === "note" ? "Save note" : "Continue"}
                  </button>
                )}
                <button className="cancel" onClick={() => setPreview(null)}>
                  <X size={16} /> Dismiss
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
            ) : tasks.slice(0, 6).map((task) => (
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
                  <span>{task.due ? `Due ${task.due}` : "No due date"}</span>
                </div>
                <button
                  className="delete-button"
                  onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
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
            ) : notes.slice(0, 4).map((note) => (
              <div className="note-card" key={note.id}>
                <FileText size={16} />
                <p>{note.text}</p>
                <button
                  onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="data-card history-card">
          <div className="data-heading">
            <div>
              <span className="section-label">HISTORY</span>
              <h2>Recent commands</h2>
            </div>
            <History size={19} />
          </div>

          <div className="history-list">
            {history.length === 0 ? (
              <p className="empty-copy">Your interpreted commands will appear here.</p>
            ) : history.slice(0, 6).map((entry) => (
              <div className="history-item" key={entry.id}>
                <div className="history-dot" />
                <div>
                  <strong>{entry.text}</strong>
                  <span>{entry.intent}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <footer>
        <div className="footer-note">
          <CheckCircle2 size={16} />
          Commands are previewed before external actions run.
        </div>
        <span>Tasks, notes, and history are stored locally in your browser.</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
