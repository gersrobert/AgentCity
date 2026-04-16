"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const session_js_1 = require("../session.js");
const claudeService_js_1 = require("../services/claudeService.js");
const router = (0, express_1.Router)();
router.post("/think", async (req, res) => {
    const key = (0, session_js_1.getKey)();
    if (!key) {
        const body = {
            ok: false,
            error: "No API key set. Please enter your Anthropic API key first.",
        };
        res.status(401).json(body);
        return;
    }
    const thinkReq = req.body;
    if (!thinkReq.agent || !thinkReq.worldState) {
        const body = {
            ok: false,
            error: "Missing required fields: agent, worldState",
        };
        res.status(400).json(body);
        return;
    }
    try {
        const decision = await (0, claudeService_js_1.getAgentDecision)(thinkReq, key);
        console.log("decision", decision);
        const body = { ok: true, data: decision };
        res.json(body);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const body = { ok: false, error: message };
        res.status(502).json(body);
    }
});
router.post("/spawn", async (req, res) => {
    const key = (0, session_js_1.getKey)();
    if (!key) {
        const body = {
            ok: false,
            error: "No API key set. Please enter your Anthropic API key first.",
        };
        res.status(401).json(body);
        return;
    }
    const spawnReq = req.body;
    if (!spawnReq.startingPlanetId || !spawnReq.worldContext) {
        const body = {
            ok: false,
            error: "Missing required fields: startingPlanetId, worldContext",
        };
        res.status(400).json(body);
        return;
    }
    try {
        const profile = await (0, claudeService_js_1.spawnAgent)(spawnReq, key);
        const body = { ok: true, data: profile };
        res.json(body);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const body = { ok: false, error: message };
        res.status(502).json(body);
    }
});
exports.default = router;
