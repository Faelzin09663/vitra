export function TrendChart({points,label}:{points:{date:string;value:number}[];label:string}){
 if(points.length<2)return <p>Registre em pelo menos duas datas para ver a tendência.</p>;
 const min=Math.min(...points.map(p=>p.value)),max=Math.max(...points.map(p=>p.value)),range=max-min||1;
 return <figure className="trend-chart"><svg viewBox="0 0 400 140" role="img" aria-label={`${label}: de ${points[0].value} para ${points.at(-1)!.value}`}><polyline fill="none" stroke="var(--primary)" strokeWidth="3" points={points.map((p,i)=>`${10+i/(points.length-1)*380},${125-(p.value-min)/range*110}`).join(' ')}/></svg><figcaption>{new Date(points[0].date+'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(points.at(-1)!.date+'T12:00:00').toLocaleDateString('pt-BR')} · {label}</figcaption></figure>;
}
