import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('slow video playback is default, adjustable, and camera stays at normal rate',()=>{
 assert.match(html,/id="playbackSpeed"/);
 assert.match(html,/<option value="0\.5" selected>/);
 assert.match(app,/const rate=camera\?1:Number\(\$\('playbackSpeed'\)\.value\)/);
 assert.match(app,/video\.playbackRate=rate/);
 assert.match(app,/addEventListener\('change'/);
});
test('detailed scan defaults to ten real timeline samples per video second',()=>{
 assert.match(html,/<option value="10" selected>/);
 assert.match(app,/const fps=Number\(\$\('scanFps'\)\.value\)\|\|5/);
 assert.match(app,/Math\.abs\(timestamp-lastAnalyzedVideoTime\)>0\.012/);
});
