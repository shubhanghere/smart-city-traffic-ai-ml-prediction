import { AlertTriangle, CloudRain, SlidersHorizontal, Sparkles } from "lucide-react";
import { SCENARIOS } from "../lib/simulation";

export default function ControlPanel({ density,setDensity,incident,setIncident,weather,setWeather,aiControl,setAiControl,hour,setHour,onReset,onScenario,scenario,onSelectScenario }) {
  return <aside className="control-panel">
    <div className="panel-title"><span className="status-dot"/><div><b>SIMULATED SIGNAL POLICY</b><small>SC-NYC-01 · DEMO MODE</small></div></div>
    <div className="control-block"><label>Traffic scenario</label><select aria-label="Traffic scenario" value={scenario} onChange={e=>onSelectScenario(e.target.value)}>{Object.keys(SCENARIOS).map(name=><option key={name}>{name}</option>)}</select></div>
    <div className="control-block"><label>Traffic density <b>{Math.round(density*100)}%</b></label><input type="range" min="0.2" max="1.4" step="0.05" value={density} onChange={e=>setDensity(Number(e.target.value))}/><div className="range-labels"><span>Free flow</span><span>Peak</span></div></div>
    <div className="control-block"><label><span><CloudRain size={13}/> Weather profile</span></label><div className="segmented">{["clear","rain","fog"].map(w=><button key={w} className={weather===w?"active":""} onClick={()=>setWeather(w)}>{w}</button>)}</div></div>
    <div className="toggle-row"><span><AlertTriangle size={14}/> Simulated incident</span><button className={`switch ${incident?"on":""}`} onClick={()=>setIncident(v=>!v)} aria-label="Toggle traffic incident"><span/></button></div>
    <div className="toggle-row"><span><Sparkles size={14}/> Simulated adaptive signal control</span><button className={`switch ${aiControl?"on":""}`} onClick={()=>setAiControl(v=>!v)} aria-label="Toggle Simulated adaptive signal control"><span/></button></div>
    <div className="controller-time"><span>TIME OF DAY</span><select aria-label="Scenario time of day" value={hour} onChange={e=>setHour(Number(e.target.value))}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i%12||12).padStart(2,"0")}:00 {i<12?"AM":"PM"}</option>)}</select></div>
    <div className="controller-status"><div><span>CONTROLLER STATUS</span><b><i/> {aiControl?"ADAPTING":"MANUAL MODE"}</b></div><div><span>CONTROL POLICY</span><b>PRESSURE-AWARE</b></div></div>
    <button className="primary-button run-scenario" onClick={onScenario}><SlidersHorizontal size={15}/> Apply scenario</button>
    <button className="reset-btn" onClick={onReset}>Reset to baseline</button>
  </aside>;
}
