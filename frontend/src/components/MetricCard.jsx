export default function MetricCard({label,value,suffix="",tone="blue",icon}) {
  return <div className={`metric-card ${tone}`}><div className="metric-label"><span>{label}</span>{icon&&<i>{icon}</i>}</div><strong>{value ?? "—"}<small>{suffix}</small></strong><div className="metric-foot"><span className="metric-status-dot"/> LIVE MEASURE</div></div>;
}
