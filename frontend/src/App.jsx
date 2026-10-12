import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Camera, ChevronDown, CircleHelp, CloudRain, Gauge, LayoutDashboard, LocateFixed, Map, Maximize2, Pause, Play, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, Video, Zap } from "lucide-react";
import CityScene from "./components/CityScene";
import ControlPanel from "./components/ControlPanel";
import MetricCard from "./components/MetricCard";
import { advance, configure, resetSimulation, snapshot, SCENARIOS } from "./lib/simulation";
import "./styles.css";

const screenItems = [
  { id:"twin", label:"3D Digital Twin", icon:Map },
  { id:"simulation", label:"Traffic Simulation", icon:Activity },
  { id:"vision", label:"Computer Vision", icon:Camera },
  { id:"control", label:"Control Center", icon:LayoutDashboard },
  { id:"analytics", label:"Analytics & Forecasts", icon:BarChart3 },
];
const pad = (v) => String(v).padStart(2, "0");

function SectionTitle({ eyebrow, title, description, action }) {
  return <div className="section-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}

function Sparkline({ values = [], color = "#6db7ff", height = 64 }) {
  const safe = values.length ? values : [0, 0];
  const min = Math.min(...safe), max = Math.max(...safe), spread = Math.max(1, max-min);
  const points = safe.map((v,i)=>`${(i/(safe.length-1 || 1))*100},${height-5-((v-min)/spread)*(height-14)}`).join(" ");
  return <svg className="sparkline" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/><circle cx="100" cy={height-5-((safe.at(-1)-min)/spread)*(height-14)} r="2.5" fill={color}/></svg>;
}

function MetricStrip({ metrics }) {
  return <div className="metrics-grid">
    <MetricCard label="Traffic volume" value={metrics.traffic_volume} suffix=" veh" icon={<Activity size={15}/>} />
    <MetricCard label="Average speed" value={metrics.average_speed} suffix=" km/h" tone="green" icon={<Gauge size={15}/>} />
    <MetricCard label="Queue length" value={metrics.queue_length} suffix=" veh" tone="amber" icon={<BarChart3 size={15}/>} />
    <MetricCard label="Intersection health" value={metrics.intersection_health} suffix="/100" tone="purple" icon={<ShieldCheck size={15}/>} />
    <MetricCard label="Throughput" value={metrics.throughput_vph} suffix=" veh/h" icon={<Zap size={15}/>} />
    <MetricCard label="Travel time" value={metrics.travel_time_min} suffix=" min" tone="green" icon={<Activity size={15}/>} />
  </div>;
}

function TwinView({ state, metrics, decision, connectionStatus, density, incident, weather, aiControl, setDensity, setIncident, setWeather, setAiControl, hour, setHour, onReset, onScenario, cameraMode, setCameraMode, cameraResetKey, onCameraReset, paused, setPaused, speed, setSpeed, fullscreen, scenario, onSelectScenario }) {
  return <>
    <div className="page-heading"><div><span className="eyebrow">NYC · MIDTOWN / 7TH AVE & W 34TH ST</span><h2>Intersection overview</h2><p>Simulated digital twin · 40.7506° N, 73.9877° W</p></div><div className="heading-actions"><span className="data-chip"><i className="pulse-dot"/> {"BROWSER SIMULATION"}</span><button className="icon-button" title="Toggle fullscreen" onClick={fullscreen}><Maximize2 size={16}/></button></div></div>
    <div className="workspace-grid">
      <section className="visual-card">
        <div className="scene-head"><div><b>Midtown Manhattan · 34th Street</b><span>Procedural 3D environment · synchronized with simulation state</span></div><div className="scene-head-right"><span className={`phase-pill ${state.phase === "EW" ? "east" : "north"}`}><i/> {state.phase} {state.phase_stage} · {Math.ceil(state.phase_remaining)}s</span><button className="icon-button"><ChevronDown size={15}/></button></div></div>
        <CityScene phase={state.phase} phaseStage={state.phase_stage} counts={state.counts} incident={state.incident} density={density} weather={state.weather} hour={state.hour} cameraMode={cameraMode} paused={paused} simulationSpeed={speed} resetCameraKey={cameraResetKey}/>
        <div className="scene-toolbar"><div className="camera-selector"><Camera size={14}/>{["Aerial","Intersection","Street-level","Traffic cam","AI Analysis"].map((m)=><button key={m} className={cameraMode===m?"selected":""} onClick={()=>setCameraMode(m)}>{m}</button>)}</div><div className="scene-actions"><button className="icon-button" onClick={onCameraReset} title="Reset camera view"><LocateFixed size={14}/></button><button className="icon-button" onClick={()=>setPaused(v=>!v)} title={paused?"Resume simulation":"Pause simulation"}>{paused?<Play size={15}/>:<Pause size={15}/>}</button><button className="icon-button" onClick={onReset} title="Reset simulation"><RotateCcw size={15}/></button><label className="speed-select"><span>{speed.toFixed(1)}×</span><input aria-label="Simulation speed" type="range" min="0.5" max="2.5" step="0.1" value={speed} onChange={e=>setSpeed(Number(e.target.value))}/></label></div></div>
        <div className="scene-foot"><span><i className="foot-dot green-dot"/> SIMULATED CAMERA VIEW</span><span><i className="foot-dot blue-dot"/> V2X CONCEPT</span><span><i className="foot-dot amber-dot"/> DETECTOR CONCEPT</span><span className="scene-clock">SIM HOUR {pad(state.hour)}:00 EDT</span></div>
      </section>
      <ControlPanel scenario={scenario} onSelectScenario={onSelectScenario} density={density} setDensity={setDensity} incident={incident} setIncident={setIncident} weather={weather} setWeather={setWeather} aiControl={aiControl} setAiControl={setAiControl} hour={hour} setHour={setHour} onReset={onReset} onScenario={onScenario}/>
    </div>
    <MetricStrip metrics={metrics}/>
    <div className="lower-grid">
      <AiDecision decision={decision} state={state}/>
      <Telemetry state={state}/>
    </div>
  </>;
}

function AiDecision({decision,state}) {
  const ns=(state.north||0)+(state.south||0), ew=(state.east||0)+(state.west||0);
  return <section className="panel ai-panel"><div className="panel-heading"><div className="heading-label"><Sparkles size={15}/><span>SIMULATED SIGNAL CONTROLLER</span></div><span className="ai-badge"><i/> {decision ? "POLICY ACTIVE" : "POLICY PAUSED"}</span></div>
    <div className="decision"><div className="decision-main"><small>RECOMMENDED PHASE</small><b>{decision?.recommended_phase || state.phase}</b><em>{decision?.green_seconds || state.phase_remaining}s optimized green window</em></div><div className="decision-bars"><div><span>North / south pressure</span><b>{ns}</b></div><div><span>East / west pressure</span><b>{ew}</b></div><div><span>Congestion forecast</span><b>{decision?.predicted_congestion ?? "—"}<small>/100</small></b></div></div></div>
    <ul className="rationale">{(decision?.rationale || ["Waiting for AI inference…"]).map((r,i)=><li key={i}>{r}</li>)}</ul>
  </section>;
}

function Telemetry({state}) {
  return <section className="panel telemetry-panel"><div className="panel-heading"><div className="heading-label"><Activity size={15}/><span>SIMULATED TELEMETRY</span></div><span className="weather-label"><CloudRain size={14}/>{state.weather?.toUpperCase()}</span></div>
    <div className="telemetry">{[["NORTH",state.north],["SOUTH",state.south],["EAST",state.east],["WEST",state.west]].map(([d,v])=><div key={d}><span>{d}</span><b>{v}</b><small>vehicles</small></div>)}</div>
    <div className="occupancy-row"><span>Road occupancy</span><b>{state.occupancy}%</b></div><div className="bar"><i style={{width:`${state.occupancy}%`}}/></div><small className="muted">Hour {pad(state.hour)}:00 {state.incident ? "· INCIDENT ACTIVE" : "· NO ACTIVE INCIDENTS"}</small>
  </section>;
}

function SimulationView(props) {
  const {state,metrics,decision,density,incident,weather,aiControl,setDensity,setIncident,setWeather,setAiControl,hour,setHour,onReset,onScenario,cameraMode,setCameraMode,cameraResetKey,onCameraReset,paused,setPaused,speed,setSpeed,fullscreen,scenario,onSelectScenario}=props;
  return <>
    <SectionTitle eyebrow="OPERATIONS / SIMULATION" title="Traffic simulation" description="Tune a scenario and watch signal timing, queues, and network conditions respond in real time." action={<button className="primary-button" onClick={onScenario}><Play size={15}/> Run scenario</button>}/>
    <div className="simulation-layout"><section className="visual-card simulation-visual"><div className="scene-head"><div><b>SC-NYC-01 · Midtown Manhattan</b><span>Simulated adaptive-signal intersection · shared simulation state</span></div><span className={`phase-pill ${state.phase === "EW" ? "east" : "north"}`}><i/> {state.phase} {state.phase_stage} · {Math.ceil(state.phase_remaining)}s</span></div><CityScene phase={state.phase} phaseStage={state.phase_stage} counts={state.counts} incident={state.incident} density={density} weather={state.weather} hour={state.hour} cameraMode={cameraMode} paused={paused} simulationSpeed={speed} resetCameraKey={cameraResetKey}/><div className="scene-toolbar"><div className="camera-selector"><Camera size={14}/>{["Aerial","Intersection","Street-level","Traffic cam","AI Analysis"].map(m=><button key={m} className={cameraMode===m?"selected":""} onClick={()=>setCameraMode(m)}>{m}</button>)}</div><div className="scene-actions"><button className="icon-button" onClick={onCameraReset} title="Reset camera view"><LocateFixed size={14}/></button><button className="icon-button" onClick={()=>setPaused(v=>!v)}>{paused?<Play size={15}/>:<Pause size={15}/>}</button><button className="icon-button" onClick={onReset}><RotateCcw size={15}/></button><label className="speed-select">{speed.toFixed(1)}×<input aria-label="Simulation speed" type="range" min="0.5" max="2.5" step="0.1" value={speed} onChange={e=>setSpeed(Number(e.target.value))}/></label><button className="icon-button" onClick={fullscreen}><Maximize2 size={15}/></button></div></div></section>
      <div className="simulation-side"><ScenarioCard {...{density,setDensity,incident,setIncident,weather,setWeather,hour,setHour,scenario,onSelectScenario}}/><AiDecision decision={decision} state={state}/><section className="panel sim-status"><div className="panel-heading"><div className="heading-label"><Gauge size={15}/><span>NETWORK STATUS</span></div></div><div className="status-list"><div><span>Average speed</span><b>{metrics.average_speed} km/h</b></div><div><span>Queue estimate</span><b>{metrics.queue_length} vehicles</b></div><div><span>Intersection health</span><b className="green-text">{metrics.intersection_health}/100</b></div></div><div className="toggle-row"><span>Adaptive signal control</span><button className={`switch ${aiControl ? "on" : ""}`} onClick={()=>setAiControl(v=>!v)}><span/></button></div></section></div>
    </div>
  </>;
}

function ScenarioCard({density,setDensity,incident,setIncident,weather,setWeather,hour,setHour,scenario,onSelectScenario}) {
  return <section className="panel scenario-card"><div className="panel-heading"><div className="heading-label"><SlidersHorizontal size={15}/><span>SCENARIO BUILDER</span></div><span className="muted-inline">CONFIGURE INPUTS</span></div><div className="control-block"><label>Traffic scenario</label><select aria-label="Traffic scenario" value={scenario} onChange={e=>onSelectScenario(e.target.value)}>{Object.keys(SCENARIOS).map(name=><option key={name}>{name}</option>)}</select></div><div className="control-block"><label>Traffic density <b>{Math.round(density*100)}%</b></label><input type="range" min="0.2" max="1.4" step="0.05" value={density} onChange={e=>setDensity(Number(e.target.value))}/><div className="range-labels"><span>Light</span><span>Heavy</span></div></div><div className="control-block"><label>Weather conditions</label><div className="segmented">{["clear","rain","fog"].map(w=><button key={w} className={weather===w?"active":""} onClick={()=>setWeather(w)}>{w}</button>)}</div></div><div className="toggle-row"><span><AlertTriangle size={14}/> Active simulated incident</span><button className={`switch ${incident?"on":""}`} onClick={()=>setIncident(v=>!v)}><span/></button></div><div className="scenario-time"><span>TIME OF DAY</span><select aria-label="Scenario time of day" value={hour} onChange={e=>setHour(Number(e.target.value))}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{pad(i%12||12)}:00 {i<12?"AM":"PM"}</option>)}</select></div></section>;
}

function VisionView({state}) {
  const [file,setFile]=useState(null), [preview,setPreview]=useState(""), [result,setResult]=useState(null), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const inputRef=useRef(null);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
  const pick=(f)=>{if(!f)return;setFile(f);setPreview(URL.createObjectURL(f));setResult(null);setError("")};
  const analyze=async()=>{if(!file)return;setBusy(true);setError("");await new Promise(resolve=>setTimeout(resolve,450));setResult({candidate_vehicle_regions:Math.round(3+state.occupancy/12),image_width:640,image_height:420,method:"Illustrative local demo",note:"This visual is illustrative only. No deployed vehicle detector or inference service is connected."});setBusy(false)};
  return <><SectionTitle eyebrow="PERCEPTION / COMPUTER VISION" title="Camera analysis concept" description="Explore an illustrative camera panel alongside the simulated intersection context. No image is sent to a service or analyzed by a deployed model." action={<span className="data-chip"><i className="pulse-dot"/> NETWORK CONTEXT LINKED</span>}/>
    <div className="vision-grid"><section className="panel vision-upload"><div className="panel-heading"><div className="heading-label"><Video size={15}/><span>CAMERA FEED ANALYSIS</span></div><span className="ai-badge"><i/> READY</span></div>
      <input ref={inputRef} className="hidden-input" type="file" accept="image/*" onChange={e=>pick(e.target.files?.[0])}/>
      {preview?<div className="image-preview"><img src={preview} alt="Selected traffic frame"/><span className="preview-tag">{file?.name}</span>{result?.regions?.slice(0,35).map((box,i)=><i key={i} className="detection-box" style={{left:`${box.x/result.image_width*100}%`,top:`${box.y/result.image_height*100}%`,width:`${box.width/result.image_width*100}%`,height:`${box.height/result.image_height*100}%`}}/>)}</div>:<button className="drop-zone" onClick={()=>inputRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();pick(e.dataTransfer.files?.[0])}}><div className="upload-icon"><Camera size={22}/></div><b>Drop an image or browse files</b><span>JPG, PNG or WEBP · up to 20 MB</span></button>}
      <div className="vision-actions"><button className="secondary-button" onClick={()=>inputRef.current?.click()}><Camera size={15}/>{preview?"Change image":"Choose image"}</button><button className="primary-button" disabled={!file||busy} onClick={analyze}>{busy?<><span className="spinner"/>Analyzing…</>:<><Sparkles size={15}/>Analyze frame</>}</button></div>
      {error&&<p className="inline-error">{error}</p>}
    </section><div className="vision-side"><section className="panel"><div className="panel-heading"><div className="heading-label"><Sparkles size={15}/><span>FRAME INSIGHTS</span></div><span className="muted-inline">{result?"ANALYSIS COMPLETE":"WAITING FOR FRAME"}</span></div><div className="vision-kpis"><div><span>Candidate regions</span><b>{result?.candidate_vehicle_regions ?? "—"}</b></div><div><span>Frame dimensions</span><b>{result?`${result.image_width} × ${result.image_height}`:"—"}</b></div><div><span>Detection method</span><b className="method-value">{result?.method||"Illustrative local demo"}</b></div></div>{result&&<p className="vision-note">{result.note}</p>}</section>
      <section className="panel network-context"><div className="panel-heading"><div className="heading-label"><Activity size={15}/><span>SIMULATED NETWORK CONTEXT</span></div><span className="ai-badge"><i/> SIMULATED</span></div><div className="context-row"><div><span>Current density</span><b>{state.occupancy}%</b></div><div><span>Active queue</span><b>{state.queue_length} <small>veh</small></b></div></div><div className="bar"><i style={{width:`${state.occupancy}%`}}/></div><p className="muted">Intersection SC-NYC-01 · {state.weather} conditions · signal {state.phase}</p></section></div></div>
  </>;
}

function SignalDiagram({state}) {
  return <div className="signal-diagram"><div className="cross-road horizontal-road"/><div className="cross-road vertical-road"/><div className="crosswalk cw-top"/><div className="crosswalk cw-bottom"/><div className="crosswalk cw-left"/><div className="crosswalk cw-right"/><div className="intersection-center"><span>SC-NYC-01<br/>{state.phase} {state.phase_stage}<br/>{Math.ceil(state.phase_remaining)}s</span></div>{[["N",state.north,"north",-1,0],["S",state.south,"south",1,0],["E",state.east,"east",0,1],["W",state.west,"west",0,-1]].map(([dir,count,key,x,z])=>{const axis=x===0?"EW":"NS";const lamp=state.phase_stage==="GREEN"&&state.phase===axis?"signal-green":state.phase_stage==="YELLOW"&&state.phase===axis?"signal-yellow":"signal-red";return <div key={dir} className={`signal-node node-${key}`}><i className={lamp}/><span>{dir} · {count}</span></div>})}</div>;
}

function ControlView({state,metrics,decision,history,onReset,paused,setPaused}) {
  return <><SectionTitle eyebrow="OPERATIONS / COMMAND CENTER" title="Intersection control center" description="A single operational view of signal state, approach pressure, incidents, and AI guidance." action={<div className="heading-actions"><button className="secondary-button" onClick={()=>setPaused(v=>!v)}>{paused?<Play size={14}/>:<Pause size={14}/>} {paused?"Resume":"Pause"}</button><button className="icon-button" onClick={onReset} title="Reset"><RotateCcw size={15}/></button></div>}/>
    <MetricStrip metrics={metrics}/><div className="control-dashboard"><section className="panel intersection-panel"><div className="panel-heading"><div className="heading-label"><Map size={15}/><span>INTERSECTION STATUS MAP</span></div><span className="muted-inline">34TH ST & 7TH AVE</span></div><SignalDiagram state={state}/><div className="legend"><span><i className="signal-green"/> Active green phase</span><span><i className="signal-red"/> Stop phase</span><span><i className="pulse-dot"/> Simulated approach pressure</span></div></section><div className="control-stack"><AiDecision decision={decision} state={state}/><section className="panel alerts-panel"><div className="panel-heading"><div className="heading-label"><AlertTriangle size={15}/><span>ACTIVE ALERTS</span></div><span className={state.incident?"alert-count":"clear-count"}>{state.incident?"01":"CLEAR"}</span></div>{state.incident?<div className="alert-item"><span className="alert-icon"><AlertTriangle size={15}/></span><div><b>Simulated incident</b><span>East approach · signal priority adjusted</span></div><time>DEMO</time></div>:<div className="all-clear"><ShieldCheck size={17}/> No active simulated incidents.</div>}</section><section className="panel approaches-panel"><div className="panel-heading"><div className="heading-label"><Activity size={15}/><span>APPROACH PERFORMANCE</span></div></div><div className="approach-list">{[["North",state.north], ["South",state.south], ["East",state.east], ["West",state.west]].map(([label,val])=><div className="approach-row" key={label}><span>{label}</span><div className="approach-bar"><i style={{width:`${Math.min(100,val*2.5)}%`}}/></div><b>{val}</b></div>)}</div></section></div></div>
  </>;
}

function ChartCard({title,unit,color,values,labels}) {
  const max=Math.max(...values,1), min=Math.min(...values,0), span=Math.max(1,max-min), w=520,h=170;
  const pts=values.map((v,i)=>`${(i/(values.length-1||1))*w},${h-14-((v-min)/span)*(h-28)}`).join(" ");
  const area=`0,${h} ${pts} ${w},${h}`;
  return <section className="panel chart-card"><div className="panel-heading"><div><span className="chart-title">{title}</span><small>{unit}</small></div><span className="chart-current" style={{color}}>{values.at(-1) ?? "—"}</span></div><svg className="chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"><defs><linearGradient id={`fill-${title.replaceAll(" ","")}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".24"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs>{[.25,.5,.75,1].map(t=><line key={t} x1="0" x2={w} y1={h-14-t*(h-28)} y2={h-14-t*(h-28)} stroke="#20364a" strokeDasharray="3 5"/>)}<polygon points={area} fill={`url(#fill-${title.replaceAll(" ","")})`}/><polyline points={pts} fill="none" stroke={color} strokeWidth="2.3" vectorEffect="non-scaling-stroke"/></svg><div className="chart-labels"><span>{labels[0]||"−15 min"}</span><span>{labels[Math.floor(labels.length/2)]||"−7 min"}</span><span>{labels.at(-1)||"NOW"}</span></div></section>;
}

function AnalyticsView({metrics,history,decision}) {
  const [range,setRange]=useState("LIVE");
  const count=range==="LIVE"?12:range==="1 MIN"?50:range==="5 MIN"?250:range==="15 MIN"?750:900;
  const points=history.slice(-count); const vals=(field,fallback)=>points.length?points.map(p=>Math.round(p[field]??fallback)):Array(12).fill(fallback);
  const labels=points.map((_,i)=>{if(i===points.length-1)return "NOW";const elapsed=Math.max(1,Math.round((points.length-i)*1.2));return elapsed>=60?`−${Math.round(elapsed/60)} min`:`−${elapsed}s`});
  const congestion=decision?.predicted_congestion;
  return <><SectionTitle eyebrow="INTELLIGENCE / PERFORMANCE" title="Analytics & traffic forecasts" description="Rolling simulation samples from the same state driving the digital twin." action={<div className="range-tabs">{["LIVE","1 MIN","5 MIN","15 MIN","HISTORICAL"].map(x=><button key={x} className={range===x?"active":""} onClick={()=>setRange(x)}>{x}</button>)}</div>}/><div className="analytics-summary"><div className="panel summary-card"><span>Peak approach</span><b>{[["North",metrics.north||0],["South",metrics.south||0],["East",metrics.east||0],["West",metrics.west||0]].sort((a,b)=>b[1]-a[1])[0]?.[0]||"North"}</b><small>Current demand leader</small></div><div className="panel summary-card"><span>Intersection health</span><b className="green-text">{metrics.intersection_health}<small>/100</small></b><small>Based on occupancy and queue</small></div><div className="panel summary-card"><span>Flow throughput</span><b>{metrics.throughput_vph}<small> veh/h</small></b><small>Estimated from speed & flow</small></div><div className="panel summary-card"><span>Simulation samples</span><b>{history.length}<small> points</small></b><small>Captured this session</small></div></div>
    <div className="charts-grid"><ChartCard title="Congestion estimate" unit="simulated index / 100" color="#f0bd5b" values={vals("congestion",metrics.congestion)} labels={labels}/><ChartCard title="Traffic volume" unit="vehicles / approach" color="#66b5ff" values={vals("traffic_volume",metrics.traffic_volume)} labels={labels}/><ChartCard title="Queue length" unit="estimated vehicles" color="#f0bd5b" values={vals("queue_length",metrics.queue_length)} labels={labels}/><ChartCard title="Average speed" unit="km/h" color="#50dda0" values={vals("average_speed",metrics.average_speed)} labels={labels}/><ChartCard title="Throughput" unit="vehicles / hour" color="#aa8aff" values={vals("throughput_vph",metrics.throughput_vph)} labels={labels}/><ChartCard title="Waiting time" unit="estimated minutes" color="#f0bd5b" values={vals("waiting_time",metrics.waiting_time)} labels={labels}/><ChartCard title="Signal phase split" unit="north / south green share %" color="#aa8aff" values={points.map(p=>p.phase==="NS"&&p.phase_stage==="GREEN"?100:0)} labels={labels}/><ChartCard title="Incident samples" unit="active simulated incident" color="#f08a69" values={vals("incident",0).map(Boolean).map(Number)} labels={labels}/></div>
    <section className="panel forecast-panel"><div className="panel-heading"><div className="heading-label"><Sparkles size={15}/><span>SCENARIO-BASED OUTLOOK</span></div><span className="ai-badge"><i/> {decision ? "SIMULATED POLICY · LOCAL SIMULATION" : "SIMULATED POLICY · ACTIVE"}</span></div><div className="forecast-content"><div><small>Simulated congestion estimate</small><b>{congestion ?? "—"}<small>{congestion==null?"":"/100"}</small></b><span>Scenario-based estimate from local volume, queue, weather and incident state.</span></div><div className="forecast-track"><div className="forecast-line"><i style={{left:`${Math.min(95,Math.max(5,congestion??0))}%`}}/></div><div className="forecast-labels"><span>LOW CONGESTION</span><span>MODERATE</span><span>SEVERE</span></div></div><div className="forecast-confidence"><span>Signal policy status</span><b><i/> Active in browser</b></div></div></section>
  </>;
}

export default function App() {
  const [sim,setSim]=useState(()=>resetSimulation()), [paused,setPaused]=useState(false), [speed,setSpeed]=useState(1);
  const {state,metrics,decision}=useMemo(()=>snapshot(sim),[sim]);
  const density=sim.density, incident=sim.incident, weather=sim.weather, aiControl=sim.aiControl, scenarioHour=sim.hour;
  const setDensity=(value)=>setSim(s=>({...s,density:value}));
  const setIncident=(value)=>setSim(s=>{const next=typeof value==="function"?value(s.incident):value;return {...s,incident:next,incidentType:next?(s.incidentType||"East approach surge"):""}});
  const setWeather=(value)=>setSim(s=>({...s,weather:value}));
  const setAiControl=(value)=>setSim(s=>({...s,aiControl:typeof value==="function"?value(s.aiControl):value}));
  const setScenarioHour=(value)=>setSim(s=>({...s,hour:value}));
  const [screen,setScreen]=useState("twin"), [cameraMode,setCameraMode]=useState("Intersection"), [cameraResetKey,setCameraResetKey]=useState(0);
  useEffect(()=>{if(paused)return;const id=setInterval(()=>setSim(s=>advance(s,speed)),1000);return()=>clearInterval(id)},[paused,speed]);
  const doReset=()=>{setSim(resetSimulation());setPaused(false)};
  const runScenario=()=>setSim(s=>configure(s,s.scenario));
  const selectScenario=(name)=>setSim(s=>configure(s,name));
  const fullscreen=()=>{const el=document.querySelector(".visual-card");if(el?.requestFullscreen)el.requestFullscreen().catch(()=>{})};
  const history=sim.history, connectionStatus="simulated";
  const shared={state,metrics,decision,connectionStatus,density,incident,weather,aiControl,setDensity,setIncident,setWeather,setAiControl,hour:scenarioHour,setHour:setScenarioHour,onReset:doReset,onScenario:runScenario,cameraMode,setCameraMode,cameraResetKey,onCameraReset:()=>setCameraResetKey(v=>v+1),paused,setPaused,speed,setSpeed,fullscreen,scenario:sim.scenario,onSelectScenario:selectScenario};
  return <div className="app-shell"><header className="topbar"><a className="brand" href="#home" onClick={e=>{e.preventDefault();setScreen("twin")}}><span className="brand-mark"><Activity size={18}/></span><span><b>GRIDLINE</b><small>TRAFFIC INTELLIGENCE</small></span></a><nav className="main-nav" aria-label="Main screens">{screenItems.map(({id,label,icon:Icon})=><button key={id} className={screen===id?"active":""} onClick={()=>setScreen(id)}><Icon size={15}/><span>{label}</span></button>)}</nav><div className="top-status"><button className="icon-button" title="Help"><CircleHelp size={16}/></button><div className="operator"><span>JD</span><b>Operator</b></div></div></header>
    <main className="main-content">{screen==="twin"&&<TwinView {...shared}/>}{screen==="simulation"&&<SimulationView {...shared}/>}{screen==="vision"&&<VisionView state={state}/>}{screen==="control"&&<ControlView state={state} metrics={metrics} decision={decision} history={history} onReset={doReset} paused={paused} setPaused={setPaused}/>}{screen==="analytics"&&<AnalyticsView metrics={metrics} history={history} decision={decision}/>}</main>
    <footer className="app-footer"><span>GRIDLINE <i/> SMART CITY TRAFFIC AI</span><span>LOCAL SIMULATION <i/> THREE.JS SCENE</span><span>NYC DIGITAL TWIN | SC-NYC-01</span></footer>
  </div>;
}
