"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const session_js_1 = require("../session.js");
const claudeService_js_1 = require("../services/claudeService.js");
const router = (0, express_1.Router)();
router.post('/chat', async (req, res) => {
    const key = (0, session_js_1.getKey)();
    if (!key) {
        const body = {
            ok: false,
            error: 'No API key set. Please enter your Anthropic API key first.',
        };
        res.status(401).json(body);
        return;
    }
    const gmReq = req.body;
    if (!gmReq.playerMessage || !gmReq.worldState) {
        const body = {
            ok: false,
            error: 'Missing required fields: playerMessage, worldState',
        };
        res.status(400).json(body);
        return;
    }
    try {
        const event = await (0, claudeService_js_1.processGMMessage)(gmReq, key);
        const body = { ok: true, data: event };
        res.json(body);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const body = { ok: false, error: message };
        res.status(502).json(body);
    }
});
exports.default = router;
