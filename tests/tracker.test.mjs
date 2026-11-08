import test from 'node:test';import assert from 'node:assert/strict';
import {CrossingTracker,normalizeBoxes,csvFromEvents} from '../public/tracker.mjs';
const car=y=>({x1:100,y1:y-10,x2:170,y2:y+10,conf:.9,label:'car'});
test('counts a tracked crossing once',()=>{
 const t=new CrossingTracker(.5);t.update([car(30)],0,400,200);t.update([car(70)],.1,400,200);
 t.update([car(130)],.2,400,200);t.update([car(160)],.3,400,200);
 assert.equal(t.events.length,1);assert.equal(t.events[0].direction,'down');assert.equal(t.breakdown.car,1);
});
test('initial frame does not count',()=>{const t=new CrossingTracker();t.update([car(190)],0,400,200);assert.equal(t.events.length,0)});
test('only vehicle classes kept',()=>{const x=normalizeBoxes({boxes:[{name:'person',x1:0,y1:1,x2:10,y2:12,conf:.9},{name:'truck',x1:0,y1:1,x2:10,y2:12,conf:.8}]});assert.equal(x.length,1);assert.equal(x[0].label,'truck');});
test('CSV exports real events',()=>{assert.match(csvFromEvents([{id:1,label:'car',direction:'up',time:3.7,confidence:.88}]),/1,car,up,3.70,0.880/);});
test('line setting resets old counting',()=>{const t=new CrossingTracker();t.update([car(10)],0,200,200);t.setLine(.6);assert.equal(t.tracks.length,0);});
const rect=(label,cy,conf=.9)=>({label,x1:100,x2:165,y1:cy-12,y2:cy+12,conf});
test('class switch across frames retains the same ID and one crossing',()=>{
 const t=new CrossingTracker(.5);
 let objects=t.update([rect('car',30)],0,400,200).objects;
 assert.equal(objects[0].trackId,1);
 objects=t.update([rect('bus',65)],.1,400,200).objects;
 assert.equal(objects[0].trackId,1); // Class disagreement is not a new vehicle.
 assert.equal(objects[0].label,'car'); // A single inconsistent frame cannot flip class.
 t.update([rect('car',95)],.2,400,200);
 objects=t.update([rect('car',132)],.3,400,200).objects;
 assert.equal(t.events.length,1);
 assert.equal(t.events[0].label,'car');
 assert.equal(objects[0].trackId,1);
});
test('consistent later predictions can update a mistaken first label',()=>{
 const t=new CrossingTracker(.5);
 let label='';
 for(let i=0;i<9;i++){
  const b=rect(i===0?'bus':'truck',35+i*2);
  label=t.update([b],i*.1,400,200).objects[0].label;
 }
 assert.equal(label,'truck');
});
test('manual van correction relabels counted event and CSV, without fake van inference',()=>{
 const t=new CrossingTracker(.5);
 t.update([rect('bus',35)],0,400,200);
 t.update([rect('bus',66)],.1,400,200);
 t.update([rect('bus',130)],.2,400,200);
 assert.equal(t.breakdown.bus,1);
 assert.equal(t.correction(1,'van'),true);
 assert.equal(t.breakdown.bus,0);assert.equal(t.breakdown.van,1);
 assert.equal(t.events[0].manuallyCorrected,true);
 assert.match(csvFromEvents(t.events),/van,down,0.20,0.900,yes/);
 assert.equal(normalizeBoxes({boxes:[{name:'van',x1:0,y1:0,x2:9,y2:10,conf:1}]}).length,0);
});
test('box normalization accepts numeric COCO classes',()=>{
 const x=normalizeBoxes({boxes:[{cls:7,x1:1,y1:2,x2:10,y2:12,conf:.9}]});
 assert.equal(x[0].label,'truck');
});
test('a recorded crossing can be corrected after the vehicle has left the scene',()=>{
 const t=new CrossingTracker(.5);
 t.update([rect('bus',30)],0,400,200);
 t.update([rect('bus',60)],.1,400,200);
 t.update([rect('bus',130)],.2,400,200);
 t.update([],6,400,200);
 assert.equal(t.tracks.length,0);
 assert.equal(t.correction(1,'truck'),true);
 assert.equal(t.breakdown.truck,1);
 assert.equal(t.breakdown.bus,0);
});

test('COCO numeric class ID takes priority over a mismatched text label and triggers review',()=>{
 const boxes=normalizeBoxes({boxes:[{cls:7,name:'bus',x1:30,y1:30,x2:70,y2:80,conf:.82}]});
 assert.equal(boxes.length,1);assert.equal(boxes[0].label,'truck');assert.equal(boxes[0].classMismatch,true);
 const t=new CrossingTracker(.5);let a=t.update(boxes,0,100,100);
 assert.equal(a.objects[0].reviewNeeded,true);
});

test('recorded event class is revised when subsequent reliable observations disagree with first prediction',()=>{
 const t=new CrossingTracker(.5);
 const observations=[
  ['bus',30],['bus',63],['bus',122],
  ['truck',130],['truck',140],['truck',148],['truck',156],['truck',160],['truck',165],['truck',170],['truck',172]
 ];
 observations.forEach(([label,cy],i)=>t.update([rect(label,cy)],i*.1,400,200));
 assert.equal(t.events.length,1);
 assert.equal(t.events[0].label,'truck');
 assert.equal(t.breakdown.truck,1);assert.equal(t.breakdown.bus,0);
});

test('two spatially separate vehicles crossing create distinct IDs and counts',()=>{
 const t=new CrossingTracker(.5), mk=(x,y)=>({label:'car',x1:x,y1:y-12,x2:x+44,y2:y+12,conf:.94});
 for(const [i,y] of [35,70,130,145].entries())t.update([mk(35,y),mk(300,y)],i*.2,600,200);
 assert.equal(t.events.length,2);
 assert.equal(new Set(t.events.map(e=>e.id)).size,2);
 assert.equal(t.breakdown.car,2);
});

test('correcting uncertain event clears review and keeps export transparent',()=>{
 const t=new CrossingTracker(.5);
 t.update([rect('bus',30,.6)],0,400,200);
 t.update([rect('car',65,.6)],.1,400,200);
 t.update([rect('bus',131,.6)],.2,400,200);
 assert.equal(t.events.length,1);
 assert.equal(t.reviewCount,1);
 assert.equal(t.correction(1,'van'),true);
 assert.equal(t.reviewCount,0);
 assert.match(csvFromEvents(t.events),/van,down,0.20,0.600,yes,no/);
});
