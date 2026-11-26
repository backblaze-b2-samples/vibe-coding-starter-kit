export const load = async () => (await import("axios")).default.get("/api/x");
