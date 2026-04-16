"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasKey = exports.clearKey = exports.getKey = exports.setKey = void 0;
let sessionKey = null;
const setKey = (key) => {
    sessionKey = key;
};
exports.setKey = setKey;
const getKey = () => sessionKey;
exports.getKey = getKey;
const clearKey = () => {
    sessionKey = null;
};
exports.clearKey = clearKey;
const hasKey = () => sessionKey !== null;
exports.hasKey = hasKey;
