const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const SCENARIOS = {
  "Normal Traffic": { density: 0.48, demand: [0.48, 0.44, 0.38, 0.36], incident: false, hour: 11 },
  "Rush Hour": { density: 0.91, demand: [0.84, 0.78, 0.72, 0.69], incident: false, hour: 17 },
  "Heavy Congestion": { density: 1.25, demand: [1, 0.94, 0.9, 0.86], incident: false, hour: 17 },
  "Lane Blockage": { density: 0.88, demand: [0.58, 0.53, 0.93, 0.55], incident: true, incidentType: "East lane blockage", hour: 15 },
  "Incident Recovery": { density: 0.72, demand: [0.7, 0.66, 0.74, 0.61], incident: false, incidentType: "Cleared · recovery in progress", hour: 16 },
};

const directions = ["north", "south", "east", "west"];
const initialDemands = SCENARIOS["Normal Traffic"].demand;
const makeState = () => ({ tick: 0, phase: "NS", phase_remaining: 34, phaseStage: "GREEN", demands: [...initialDemands], queues: [3, 3, 2, 2], directionThroughput: [0, 0, 0, 0], history: [], incident: false, incidentType: "", scenario: "Normal Traffic", weather: "clear", hour: 11, density: 0.48, aiControl: true });

function metricsFor(s) {
  const total = s.queues.reduce((a, b) => a + b, 0);
  const vehicles = s.queues.map(queue => clamp(queue + 3, 3, 9));
  const demand = s.demands.reduce((a, b) => a + b, 0);
  const occupancy = clamp(Math.round(12 + total * 2.5 + (s.incident ? 9 : 0)), 8, 96);
  const congestion = clamp(Math.round(occupancy * 0.67 + total * 1.25), 4, 98);
  const speed = clamp(Math.round(52 - congestion * 0.39 - (s.weather === "rain" ? 7 : s.weather === "fog" ? 10 : 0)), 8, 51);
  const throughput = Math.round(s.directionThroughput.reduce((a, b) => a + b, 0) * 60);
  const pressureNS = s.demands[0] + s.demands[1], pressureEW = s.demands[2] + s.demands[3];
  return { north:vehicles[0], south:vehicles[1], east:vehicles[2], west:vehicles[3], traffic_volume:vehicles.reduce((a,b)=>a+b,0), average_speed:speed, occupancy, congestion, queue_length:total, travel_time_min:Math.round((1.8 + congestion * 0.055) * 10) / 10, throughput_vph:throughput, intersection_health:clamp(100 - congestion, 2, 96), pressureNS, pressureEW, waiting_time:Math.round((total * 0.82 + congestion * 0.07) * 10) / 10, utilization:clamp(Math.round(demand * 22), 12, 94) };
}

function decisionFor(s, metrics) {
  const dominant = s.demands[0] + s.demands[1] >= s.demands[2] + s.demands[3] ? "NS" : "EW";
  const phase = s.aiControl ? dominant : s.phase;
  return { recommended_phase: phase, green_seconds:clamp(Math.round(26 + (phase === "NS" ? metrics.pressureNS : metrics.pressureEW) * 10), 26, 48), predicted_congestion:metrics.congestion, rationale:[`${phase === "NS" ? "North–south" : "East–west"} approaches carry the greatest combined demand.`, s.incident ? `${s.incidentType} reduces eastbound discharge; the controller allows a longer recovery window.` : "No active disruption; phase timing follows approach pressure.", `A ${s.phaseStage.toLowerCase()} clearance separates conflicting directions.`] };
}

export function snapshot(s) {
  const metrics = metricsFor(s);
  const decision = decisionFor(s, metrics);
  return { state:{ north:metrics.north, south:metrics.south, east:metrics.east, west:metrics.west, avg_speed:metrics.average_speed, occupancy:metrics.occupancy, queue_length:metrics.queue_length, weather:s.weather, incident:s.incident, incident_type:s.incidentType, hour:s.hour, phase:s.phase, phase_remaining:s.phase_remaining, phase_stage:s.phaseStage, scenario:s.scenario, density:s.density, throughput:metrics.throughput_vph, counts:{northbound:metrics.north,southbound:metrics.south,eastbound:metrics.east,westbound:metrics.west} }, metrics, decision };
}

export function advance(s, speed=1) {
  const n = { ...s, tick:s.tick + 1, demands:[...s.demands], queues:[...s.queues], directionThroughput:[...s.directionThroughput], history:[...s.history] };
  const m = metricsFor(n);
  if (n.phase_remaining > 0) n.phase_remaining = Math.max(0, n.phase_remaining - speed);
  else if (n.phaseStage === "GREEN") { n.phaseStage = "YELLOW"; n.phase_remaining = 4; }
  else if (n.phaseStage === "YELLOW") { n.phaseStage = "ALL RED"; n.phase_remaining = 2; }
  else { n.phase = n.phase === "NS" ? "EW" : "NS"; n.phaseStage = "GREEN"; n.phase_remaining = clamp(Math.round(26 + (n.phase === "NS" ? m.pressureNS : m.pressureEW) * 10), 26, 48); }

  const greenAxis = n.phaseStage === "GREEN" ? n.phase : null;
  n.demands = n.demands.map((value, i) => clamp(value + (i % 2 === 0 ? 0.018 : -0.014) * Math.sin(n.tick * 0.13 + i * 1.7), 0.12, 1.2));
  n.queues = n.queues.map((queue, i) => {
    const open = greenAxis === (i < 2 ? "NS" : "EW");
    const blocked = n.incident && i === 2;
    const incoming = n.demands[i] * (0.38 + (n.density - 0.48) * 0.12);
    const served = open && !blocked ? 0.75 + n.demands[i] * 0.35 : 0.12;
    const next = Math.round(clamp(queue + incoming - served + (blocked ? 0.65 : 0), 0, 34));
    if (open && !blocked) n.directionThroughput[i] = Math.max(0, n.directionThroughput[i] * 0.92 + Math.min(queue, 2) * 0.16);
    return next;
  });
  const now = snapshot(n);
  n.history.push({ ...now.metrics, ...now.state, at:Date.now() });
  if (n.history.length > 900) n.history.splice(0, n.history.length - 900);
  return n;
}

export function configure(s, scenario, changes={}) {
  const preset = SCENARIOS[scenario] || SCENARIOS["Normal Traffic"];
  return { ...s, ...changes, scenario, density:changes.density ?? preset.density, demands:[...preset.demand], queues:preset.demand.map(v=>Math.round(v*7)), incident:changes.incident ?? preset.incident, incidentType:changes.incidentType ?? (preset.incident ? preset.incidentType : ""), hour:changes.hour ?? preset.hour, phase_remaining:34, phaseStage:"GREEN", history:[] };
}

export function resetSimulation() { return makeState(); }
