const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
// On serverless hosts (e.g. Vercel) the project filesystem is read-only at
// runtime, so fall back to /tmp there. Locally / on a normal server, keep
// writing next to the project so messages persist across restarts.
const DATA_FILE = process.env.VERCEL
  ? "/tmp/messages.json"
  : path.join(__dirname, "data", "messages.json");

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..")));
function validateContactPayload(body) {
  const name    = typeof body.name    === "string" ? body.name.trim()    : "";
  const email   = typeof body.email   === "string" ? body.email.trim()   : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || name.length < 2)
    return { ok: false, error: "Name must be at least 2 characters." };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return { ok: false, error: "Please provide a valid email address." };

  if (!message || message.length < 10)
    return { ok: false, error: "Message must be at least 10 characters." };

  return { ok: true, data: { name, email, message } };
}

async function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

async function appendMessage(record) {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  let messages = [];
  try {
    messages = JSON.parse(raw);
    if (!Array.isArray(messages)) messages = [];
  } catch {
    messages = [];
  }
  messages.push(record);
  await fs.writeFile(DATA_FILE, JSON.stringify(messages, null, 2), "utf8");
}

app.post("/api/contact", async (req, res) => {
  const validation = validateContactPayload(req.body || {});
  if (!validation.ok)
    return res.status(400).json({ error: validation.error });

  const record = {
    id: Date.now(),
    ...validation.data,
    createdAt: new Date().toISOString(),
  };

  try {
    await appendMessage(record);
    return res.status(201).json({ message: "Message received successfully." });
  } catch (err) {
    return res.status(500).json({ error: "Server failed to save your message." });
  }
});

// Serve the portfolio HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "Portfolio.html"));
});
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Portfolio server running on http://localhost:${PORT}`);
  });
}

module.exports = app;