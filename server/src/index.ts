import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import agentRouter from './routes/agent.js';
import gamemasterRouter from './routes/gamemaster.js';

const PORT = 3001;

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  })
);

app.use('/api/session', authRouter);
app.use('/api/agent', agentRouter);
app.use('/api/gamemaster', gamemasterRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`AgentCity server running on http://localhost:${PORT}`);
});
