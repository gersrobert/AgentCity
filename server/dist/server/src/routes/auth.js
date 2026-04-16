"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const session_js_1 = require("../session.js");
const router = (0, express_1.Router)();
router.post('/key', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string') {
        const body = { ok: false, error: 'Missing apiKey' };
        res.status(400).json(body);
        return;
    }
    (0, session_js_1.setKey)(apiKey);
    const body = {
        ok: true,
        data: { validated: true },
    };
    res.json(body);
});
router.get('/status', (_req, res) => {
    res.json({ hasKey: (0, session_js_1.hasKey)() });
});
exports.default = router;
