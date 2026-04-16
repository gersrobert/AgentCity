"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_js_1 = __importDefault(require("./routes/auth.js"));
const agent_js_1 = __importDefault(require("./routes/agent.js"));
const gamemaster_js_1 = __importDefault(require("./routes/gamemaster.js"));
const PORT = 3001;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
}));
app.use('/api/session', auth_js_1.default);
app.use('/api/agent', agent_js_1.default);
app.use('/api/gamemaster', gamemaster_js_1.default);
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.listen(PORT, () => {
    console.log(`AgentCity server running on http://localhost:${PORT}`);
});
