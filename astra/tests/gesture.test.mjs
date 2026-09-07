import test from 'node:test';
import assert from 'node:assert/strict';
import {shotFromDrag} from '../dist/core/gesture.mjs';
import {resolveShot,pathPoint,normalizeAim} from '../dist/core/physics.mjs';
import {createMatch,reduceMatch,currentQuestion} from '../dist/core/game.mjs';
import {restoreMatch} from '../dist/core/storage.mjs';
test('drag starts on ball, must move upward and rejects malformed input',()=>{
 const start={x:550,y:584};
 assert.equal(shotFromDrag({x:10,y:10},{x:750,y:220},400),null);
 assert.equal(shotFromDrag(start,{x:750,y:600},400),null);
 assert.equal(shotFromDrag(start,{x:750,y:220},NaN),null);
 assert.equal(shotFromDrag(start,{x:750,y:220},20),null);
 assert.equal(shotFromDrag(start,{x:750,y:220},6000),null);
 assert.deepEqual(shotFromDrag(start,{x:750,y:220},400,.5),{x:750,y:220,power:72,spin:.5});
});
test('curve changes the route, never the requested final target',()=>{
 const a={x:550,y:300,power:72};const left=resolveShot({...a,spin:-1},2),right=resolveShot({...a,spin:1},2);
 assert.equal(pathPoint(left.end,1).x,pathPoint(right.end,1).x);
 assert.ok(pathPoint(left.end,.5).x<pathPoint(right.end,.5).x);
 assert.equal(resolveShot({...a,spin:0},2).type,'wall');
 assert.notEqual(left.type,'wall');assert.notEqual(right.type,'wall');
});
test('legacy aim defaults to straight and invalid spin is rejected',()=>{
 assert.equal(normalizeAim({x:550,y:300,power:70}).spin,0);
 assert.throws(()=>normalizeAim({x:550,y:300,power:70,spin:Infinity}));
 assert.equal(normalizeAim({x:550,y:300,power:70,spin:20}).spin,1);
});
test('curved shot survives reload with the same collision and rewards',()=>{
 let m=createMatch();const go=e=>m=reduceMatch(m,e).match;
 go({type:'ANSWER',value:currentQuestion(m).answer});go({type:'AIM',value:{x:730,y:240,power:72,spin:-.8}});go({type:'SHOOT'});go({type:'FINISH'});
 const restored=restoreMatch(JSON.parse(JSON.stringify(m)));
 assert.deepEqual(restored.outcome,m.outcome);assert.equal(restored.xp,m.xp);assert.equal(restored.aim.spin,-.8);
});
