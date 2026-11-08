/**
 * VehicleAI V10 tracking/counting. Uses only observed, pretrained YOLO detections.
 * No heuristic invents a van class (COCO does not contain one).
 * The classifier can still be wrong; expose review flags and allow explicit corrections.
 */
export const TYPES = ['car', 'van', 'motorcycle', 'bus', 'truck', 'bicycle'];
const DETECTABLE = new Set(TYPES.filter(x => x !== 'van'));
const COCO_LABELS = {1: 'bicycle', 2: 'car', 3: 'motorcycle', 5: 'bus', 7: 'truck'};
const mid = b => ({x:(b.x1+b.x2)/2, y:(b.y1+b.y2)/2});
const area = b => Math.max(0,b.x2-b.x1)*Math.max(0,b.y2-b.y1);
function overlap(a,b) {
  const x=Math.max(0,Math.min(a.x2,b.x2)-Math.max(a.x1,b.x1));
  const y=Math.max(0,Math.min(a.y2,b.y2)-Math.max(a.y1,b.y1));
  return (x*y)/(area(a)+area(b)-x*y+1e-8);
}
export function normalizeBoxes(results) {
  return (results?.boxes||[]).map(b=>{
    // COCO numeric class ID is authoritative when available. This avoids a
    // mismatch between cached textual class names and the model's ID mapping.
    const rawName=String(b.name??'').toLowerCase().trim();
    const cls=b.cls??b.classId;
    const numericName=cls===undefined||cls===null ? null : COCO_LABELS[Number(cls)]||null;
    const label=numericName || rawName;
    return {x1:Number(b.x1),y1:Number(b.y1),x2:Number(b.x2),y2:Number(b.y2),
      conf:Number(b.conf),label,modelClassId:cls===undefined?null:Number(cls),
      classMismatch:!!numericName&&!!rawName&&rawName!==numericName};
  }).filter(b=>DETECTABLE.has(b.label)&&[b.x1,b.y1,b.x2,b.y2,b.conf].every(Number.isFinite)
    && b.conf>=0&&b.conf<=1&&b.x2>b.x1&&b.y2>b.y1);
}
function refreshClass(track) {
  if(track.manualLabel){track.label=track.manualLabel;track.uncertain=false;track.reviewNeeded=false;return;}
  // Recent observations carry slightly more weight, but a different class needs
  // multiple agreeing predictions before replacing an existing vehicle label.
  // This dampens one-frame Bus/Truck/Car flicker without inventing a Van class.
  const recent=track.votes.slice(-12);
  const scores=new Map();
  for(let i=0;i<recent.length;i++){
    const v=recent[i],weight=.65+.35*(i+1)/recent.length;
    scores.set(v.label,(scores.get(v.label)||0)+v.conf*weight);
  }
  const ranking=[...scores.entries()].sort((a,b)=>b[1]-a[1]);
  const leader=ranking[0]?.[0]||track.label;
  const current=scores.get(track.label)||0;
  const challenger=scores.get(leader)||0;
  const leaderVotes=recent.filter(v=>v.label===leader).length;
  if(leader!==track.label && leaderVotes>=3 && challenger>=Math.max(current*1.45,current+.55))track.label=leader;
  const total=ranking.reduce((s,e)=>s+e[1],0);
  const share=total?(scores.get(track.label)||0)/total:1;
  track.agreement=Number(share.toFixed(2));
  const runner=ranking[1]?.[1]||0;
  const top=ranking[0]?.[1]||1;
  track.uncertain=runner>=top*.40 || track.votes.some(v=>v.classMismatch);
  // A COCO "bus" prediction could actually be a van; low-evidence labels need
  // manual review. We never automatically predict a Van class.
  const busNeedsReview=track.label==='bus' && (track.hits<5 || track.confidence<.83);
  const truckNeedsReview=track.label==='truck' && (track.hits<4 || track.confidence<.75);
  track.reviewNeeded=track.uncertain || busNeedsReview || truckNeedsReview
    || (track.hits<3 && track.confidence<.72) || (track.hits>=3&&share<.73);
}
export class CrossingTracker {
  constructor(lineFraction=.55){this.lineFraction=lineFraction;this.reset();}
  reset(){this.tracks=[];this.counter=1;this.events=[];this.visible=[];this.currentTime=0;}
  setLine(fraction){if(fraction<=0||fraction>=1)throw new Error('Line fraction out of range');this.lineFraction=fraction;this.reset();}
  get breakdown(){const counts=Object.fromEntries(TYPES.map(x=>[x,0]));for(const e of this.events)counts[e.label]=(counts[e.label]||0)+1;return counts;}
  get up(){return this.events.filter(e=>e.direction==='up').length;}
  get down(){return this.events.filter(e=>e.direction==='down').length;}
  get reviewCount(){return this.events.filter(e=>e.reviewNeeded&&!e.manuallyCorrected).length;}
  correction(id,label){
    if(!TYPES.includes(label))return false;
    const track=this.tracks.find(t=>t.id===id);
    const events=this.events.filter(e=>e.id===id);
    if(!track&&!events.length)return false;
    if(track){track.manualLabel=label;track.label=label;track.uncertain=false;track.reviewNeeded=false;}
    for(const e of events){e.label=label;e.manuallyCorrected=true;e.reviewNeeded=false;}
    this.visible=this.visible.map(b=>b.trackId===id?{...b,label,uncertain:false,reviewNeeded:false,manuallyCorrected:true}:b);
    return true;
  }
  update(boxes,time,width,height){
    if(!(width>0&&height>0))return {objects:[],events:[]};
    if(time<this.currentTime-.2)this.reset();
    this.currentTime=time;
    this.tracks=this.tracks.filter(t=>time>=t.t && time-t.t<2.5);
    const candidates=[];
    for(let bi=0;bi<boxes.length;bi++)for(let ti=0;ti<this.tracks.length;ti++){
      const b=boxes[bi],track=this.tracks[ti],c=mid(b),old=mid(track.box);
      const dt=Math.max(0,time-track.t);
      const projected={x:old.x+track.vx*Math.min(dt,.45),y:old.y+track.vy*Math.min(dt,.45)};
      const distance=Math.hypot((c.x-projected.x)/width,(c.y-projected.y)/height);
      const rawDistance=Math.hypot((c.x-old.x)/width,(c.y-old.y)/height);
      const iou=overlap(b,track.box);
      const sizeRatio=area(b)/Math.max(1,area(track.box));
      // A distant or vastly different-sized object is more likely a separate vehicle.
      if(distance>.36 && iou<.02)continue;
      if(rawDistance>.48 && iou<.08)continue;
      if((sizeRatio>.0 && (sizeRatio>3.5||sizeRatio<1/3.5)) && iou<.35)continue;
      const areaPenalty=.13*Math.abs(Math.log(Math.max(sizeRatio,.01)));
      // Give spatial and shape continuity priority over noisy classifier output.
      const score=2.5*iou-1.35*distance-.5*rawDistance-areaPenalty-(b.label===track.label?0:.025);
      candidates.push({bi,ti,score});
    }
    candidates.sort((a,b)=>b.score-a.score);
    const match=new Map(),used=new Set();
    for(const c of candidates)if(!match.has(c.bi)&&!used.has(c.ti)){match.set(c.bi,c.ti);used.add(c.ti);}
    const objects=[],eventBatch=[];
    for(let bi=0;bi<boxes.length;bi++){
      const b=boxes[bi],c=mid(b),line=height*this.lineFraction;
      const side=c.y<line-height*.012?-1:c.y>line+height*.012?1:0;
      let track=match.has(bi)?this.tracks[match.get(bi)]:null;
      if(!track){track={id:this.counter++,box:b,side,label:b.label,manualLabel:null,
        t:time,hits:0,counted:false,votes:[],confidence:b.conf,
        agreement:1,uncertain:false,reviewNeeded:false,vx:0,vy:0};this.tracks.push(track);}
      const prev=track.side,previousMid=mid(track.box),dt=time-track.t;
      if(track.hits>0&&dt>.001&&dt<1.5){
        const a=.40;track.vx=(1-a)*track.vx+a*(c.x-previousMid.x)/dt;
        track.vy=(1-a)*track.vy+a*(c.y-previousMid.y)/dt;
      }
      track.hits++;
      track.confidence=(track.confidence*(track.hits-1)+b.conf)/track.hits;
      track.votes.push({label:b.label,conf:b.conf,classMismatch:b.classMismatch});
      if(track.votes.length>15)track.votes.shift();
      refreshClass(track);
      // Relabel any previously recorded event when later frames strongly agree on a class.
      // This is a revision from observed model predictions, not a synthetic correction.
      const existing=this.events.find(e=>e.id===track.id);
      if(existing&&!existing.manuallyCorrected){
        existing.label=track.label;existing.reviewNeeded=track.reviewNeeded;
        existing.agreement=track.agreement;
      }
      if(side!==0){
        if(track.hits>=3&&!track.counted&&prev!==0&&prev!==side){
          const event={id:track.id,label:track.label,direction:prev<side?'down':'up',
            time:Math.max(0,time),confidence:b.conf,agreement:track.agreement,
            reviewNeeded:track.reviewNeeded,manuallyCorrected:!!track.manualLabel};
          track.counted=true;this.events.push(event);eventBatch.push(event);
        }
        track.side=side;
      }
      track.box=b;track.t=time;
      objects.push({...b,label:track.label,rawLabel:b.label,trackId:track.id,
        uncertain:track.uncertain,reviewNeeded:track.reviewNeeded,
        agreement:track.agreement,manuallyCorrected:!!track.manualLabel});
    }
    this.visible=objects;
    return {objects,events:eventBatch};
  }
}
export function csvFromEvents(events){
  const head='track_id,vehicle_type,direction,time_seconds,confidence,manually_corrected,review_required,class_agreement';
  return head+'\n'+events.map(e=>[e.id,e.label,e.direction,e.time.toFixed(2),e.confidence.toFixed(3),
    e.manuallyCorrected?'yes':'no',e.reviewNeeded&&!e.manuallyCorrected?'yes':'no',
    Number(e.agreement??1).toFixed(2)].join(',')).join('\n');
}
