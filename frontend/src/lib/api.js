const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export const getState = () => request("/api/simulation/state");
export const tick = () => request("/api/simulation/tick", { method: "POST" });
export const reset = () => request("/api/simulation/reset", { method: "POST" });
export const control = (params) => request(`/api/simulation/control?${new URLSearchParams(params)}`, { method: "POST" });
export const optimize = (payload) => request("/api/control/optimize", { method: "POST", body: JSON.stringify(payload) });
export const summary = () => request("/api/analytics/summary");
