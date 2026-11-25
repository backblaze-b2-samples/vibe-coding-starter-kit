// Mentions fetch("/api/x") and import "@tanstack/react-query" in a comment only.
/* window.fetch("/api/x"); new XMLHttpRequest(); */
export const doc = 'Use fetch("/api/x") via the client, not directly.';
export const tpl = `do not call fetch (url) or require("@tanstack/react-query")`;
export const note = "from '@tanstack/react-query' is only text here";
