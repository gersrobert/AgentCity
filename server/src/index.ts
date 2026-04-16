import express from 'express';
import cors from 'cors';
import agentRouter from './routes/agent.js';
import gamemasterRouter from './routes/gamemaster.js';

const PORT = 3001;
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  })
);

app.use('/api/agent', agentRouter);
app.use('/api/gamemaster', gamemasterRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, async () => {
  console.log(`AgentCity server running on http://localhost:${PORT}`);

  // Check Ollama is reachable
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (res.ok) {
      const data = await res.json() as { models?: { name: string }[] };
      const models = (data.models ?? []).map(m => m.name);
      console.log(`Ollama connected. Available models: ${models.join(', ') || '(none)'}`);
    } else {
      console.warn(`Ollama responded with status ${res.status}. Is it running?`);
    }
  } catch {
    console.warn(`Could not reach Ollama at ${OLLAMA_URL}. Make sure 'ollama serve' is running.`);
  }
});
