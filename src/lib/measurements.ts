export const measurementFields = {neck:'Pescoço',shoulders:'Ombros',chest:'Peito',waist:'Cintura',abdomen:'Abdômen',hips:'Quadril',right_arm:'Braço direito',left_arm:'Braço esquerdo',forearm:'Antebraço',right_thigh:'Coxa direita',left_thigh:'Coxa esquerda',calf:'Panturrilha'} as const;
export type MeasureKey=keyof typeof measurementFields;
export type Measurement={user_id:string;date:string;note:string}&Partial<Record<MeasureKey,number|null>>;
export function navyBodyFat(sex:string,height:number|null,neck:number|null|undefined,waist:number|null|undefined,hips?:number|null):number|null {
 if(!height||height<120||height>230||!neck||neck<20||neck>65||!waist||waist<40||waist>200||waist<=neck)return null;
 let density:number;if(sex==='male')density=1.0324-.19077*Math.log10(waist-neck)+.15456*Math.log10(height);
 else if(sex==='female'&&hips&&hips>=50&&hips<=200)density=1.29579-.35004*Math.log10(waist+hips-neck)+.221*Math.log10(height);else return null;
 const result=495/density-450;return Number.isFinite(result)&&result>=2&&result<=60?Math.round(result*10)/10:null;
}
export function waistHeightRatio(waist:number|null|undefined,height:number|null){return waist&&height&&waist>=40&&waist<=200&&height>=120&&height<=230?waist/height:null;}
export function measurementTrend(rows:Measurement[],key:MeasureKey){const points=rows.filter(r=>r[key]!=null).map(r=>({date:r.date,value:r[key]!}));const last=points.at(-1);return {points,firstDelta:last&&points.length>1?last.value-points[0].value:null,previousDelta:last&&points.length>1?last.value-points[points.length-2].value:null};}
