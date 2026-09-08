import { FIELD, SCENARIOS, pathPoint, clamp } from './core/physics.mjs';
import { keeperPose } from './core/keeper.mjs';

/** Presentation uses the exact flight and contact points from the resolver. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible.');
  const photo = new Image(); photo.src = new URL('./assets/stadium.webp', import.meta.url).href;
  let cachedLeague = -1, background, photoReady = false;
  photo.onload = () => { photoReady = true; cachedLeague = -1; };
  const layer = document.createElement('canvas'); layer.width = 1100; layer.height = 650;
  const line = (ax, ay, bx, by, color, width = 2) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  };
  const polygon = (points, fill) => {
    ctx.fillStyle = fill; ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath(); ctx.fill();
  };
  const ellipse = (x,y,rx,ry,color) => {ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
  const smooth = t => {t=clamp(t,0,1);return t*t*(3-2*t);};
  function stadium(league) {
    ctx.fillStyle = '#071727'; ctx.fillRect(0,0,1100,650);
    if (photoReady) {
      // Reuse the stadium artwork from V10; crop out its goal so geometry stays authoritative.
      const sx=photo.naturalWidth/1152, sy=photo.naturalHeight/2048;
      ctx.drawImage(photo,0,250*sy,1152*sx,630*sy,0,0,1100,192);
      ctx.drawImage(photo,0,760*sy,1152*sx,115*sy,0,192,1100,185);
      ctx.drawImage(photo,0,1170*sy,1152*sx,878*sy,0,376,1100,274);
    } else {
      const sky=ctx.createLinearGradient(0,0,0,377);sky.addColorStop(0,'#07172a');sky.addColorStop(1,'#225369');ctx.fillStyle=sky;ctx.fillRect(0,0,1100,377);
      ctx.fillStyle='#205133';ctx.fillRect(0,377,1100,273);
    }
    const wash = ['#5b422716','#17395714','#11164920'][league];ctx.fillStyle=wash;ctx.fillRect(0,0,1100,650);
    for(let i=0;i<8;i++) {
      const a=376+(i/8)**1.8*274,b=376+((i+1)/8)**1.8*274;
      ctx.fillStyle=i%2?'#0519082c':'#7dcf4313';ctx.fillRect(0,a,1100,b-a);
    }
    for(const p of [[0,377,1100,377],[200,377,-95,650],[900,377,1195,650],[72,529,1028,529],[337,377,280,453],[763,377,820,453],[280,453,820,453]])line(...p,'#e6f1d5a8',2);
    ctx.strokeStyle='#e6f1d586';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(550,529,151,44,0,0,Math.PI);ctx.stroke();
    // Side netting and a recessed back plane create depth without moving the scoring plane.
    polygon([[280,192],[310,211],[310,367],[280,376]],'#d6ecf11b');
    polygon([[820,192],[790,211],[790,367],[820,376]],'#d6ecf11b');
    polygon([[280,192],[820,192],[790,211],[310,211]],'#d6ecf12b');
    polygon([[310,211],[790,211],[790,367],[310,367]],'#02111c9c');
    for(let x=310;x<=790;x+=16)line(x,211,x,367,'#d9edf754',.8);
    for(let y=211;y<=367;y+=13)line(310,y,790,y,'#d9edf747',.8);
    for(let k=0;k<=10;k++){const a=k/10;line(280,192+a*184,310,211+a*156,'#d9edf769',.8);line(820,192+a*184,790,211+a*156,'#d9edf769',.8);}
    for(let x=280;x<=820;x+=24)line(x,192,310+(x-280)*480/540,211,'#d9edf760',.8);
    for(const p of [[280,376,280,192],[280,192,820,192],[820,192,820,376]]) {line(...p,'#06131c',11);line(...p,'#e9f5ff',7);line(p[0]-1,p[1],p[2]-1,p[3],'#fff',2);}
    const shade=ctx.createLinearGradient(0,485,0,650);shade.addColorStop(0,'#00120800');shade.addColorStop(1,'#000d1266');ctx.fillStyle=shade;ctx.fillRect(0,485,1100,165);
    layer.getContext('2d').drawImage(canvas,0,0); background = layer; cachedLeague=league;
  }
  // Jointed athletes: depth, kit shading, planted boots, run-up and diving poses.
  function athlete(x,y,scale,shirt,{number='',run=0,kick=0,dive=0,angle=0,wall=false,time=0}={}) {
    ellipse(x,y+2,24*scale,5*scale,'#000a1280');
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
    const stride=Math.sin(run*Math.PI*4)*12;
    const hipY=-31, kneeY=-16;
    line(-7,hipY,-8-stride*.4,kneeY,'#142433',9);
    line(-8-stride*.4,kneeY,-11-stride,0,'#b0c4c3',7);
    line(7,hipY,9+stride*.4+kick*19,kneeY-kick*13,'#142433',9);
    line(9+stride*.4+kick*19,kneeY-kick*13,12+stride+kick*38,-kick*32,'#b0c4c3',7);
    line(-13-stride,1,-4-stride,2,'#ebfae6',5);
    line(10+stride+kick*38,-kick*32,19+stride+kick*38,-kick*32,'#fe7349',5);
    const kit=ctx.createLinearGradient(-16,-68,17,-27);kit.addColorStop(0,shirt);kit.addColorStop(1,'#253e48');
    polygon([[-15,-64],[14,-64],[12,-32],[-11,-32]],kit);
    line(-9,-33,10,-33,'#08151e',3);
    line(-13,-58,wall?-19:-25-stride*.3,wall?-43:-45+dive*12,shirt,8);
    line(wall?-19:-25-stride*.3,wall?-43:-45+dive*12,wall?-4:-30-dive*12,wall?-38:-33+dive*12,'#c39376',6);
    line(13,-58,wall?19:25+stride*.3,wall?-43:-45-dive*5,shirt,8);
    line(wall?19:25+stride*.3,wall?-43:-45-dive*5,wall?4:30+dive*12,wall?-38:-33-dive*6,'#c39376',6);
    if(dive){ellipse(-30-dive*12,-33+dive*12,6,5,'#efffff');ellipse(30+dive*12,-33-dive*6,6,5,'#efffff');}
    ctx.fillStyle='#bc9075';ctx.fillRect(-4,-71,8,8);
    ellipse(0,-77,9,11,'#c79d81');ellipse(-1,-83,9,5,'#152022');
    if(number){ctx.fillStyle='#f8ffeb';ctx.font='bold 17px system-ui';ctx.textAlign='center';ctx.fillText(number,0,-43);}
    ctx.restore();
  }
  function football(p,t=0) {
    const {x,y,r}=p;
    const fill=ctx.createRadialGradient(x-r*.35,y-r*.45,1,x,y,r);fill.addColorStop(0,'#fff');fill.addColorStop(.65,'#e8f4f5');fill.addColorStop(1,'#7f9da7');
    ellipse(x,y,r,r,fill);ctx.save();ctx.translate(x,y);ctx.rotate(t*13);
    for(let j=0;j<6;j++){const a=j*Math.PI/3;const cx=j?Math.cos(a)*r*.75:0,cy=j?Math.sin(a)*r*.75:0;polygon(Array.from({length:5},(_,i)=>[cx+Math.cos(i*Math.PI*2/5)*r*.29,cy+Math.sin(i*Math.PI*2/5)*r*.29]),'#182a37');}ctx.restore();
  }
  function goalkeeper(pose) {
    const {body,hands,feet,angle,phase,direction}=pose;
    const rotatePoint=(x,y)=>({x:body.x+x*Math.cos(angle)-y*Math.sin(angle),y:body.y+x*Math.sin(angle)+y*Math.cos(angle)});
    const shoulderLeft=rotatePoint(-13,-17),shoulderRight=rotatePoint(13,-17),hipLeft=rotatePoint(-9,17),hipRight=rotatePoint(9,17);
    const elbow=(shoulder,hand,bend)=>({x:(shoulder.x+hand.x)/2+direction*bend,y:(shoulder.y+hand.y)/2+8});
    const knee=(hip,foot,bend)=>({x:(hip.x+foot.x)/2-direction*bend,y:(hip.y+foot.y)/2-3});
    const shadowWidth=phase==='ready'?28:46;
    ellipse(body.x,Math.min(378,Math.max(feet.left.y,feet.right.y)+3),shadowWidth,5,'#00081299');
    const leftKnee=knee(hipLeft,feet.left,phase==='plant'?7:3),rightKnee=knee(hipRight,feet.right,phase==='plant'?7:3);
    line(hipLeft.x,hipLeft.y,leftKnee.x,leftKnee.y,'#172838',11);line(leftKnee.x,leftKnee.y,feet.left.x,feet.left.y,'#c3d4d3',8);
    line(hipRight.x,hipRight.y,rightKnee.x,rightKnee.y,'#172838',11);line(rightKnee.x,rightKnee.y,feet.right.x,feet.right.y,'#c3d4d3',8);
    line(feet.left.x-5,feet.left.y,feet.left.x+8,feet.left.y,'#e8fbf3',6);line(feet.right.x-5,feet.right.y,feet.right.x+8,feet.right.y,'#e8fbf3',6);
    ctx.save();ctx.translate(body.x,body.y);ctx.rotate(angle);
    const kit=ctx.createLinearGradient(-19,-29,18,22);kit.addColorStop(0,'#f2a641');kit.addColorStop(.48,'#df762a');kit.addColorStop(1,'#73331d');
    polygon([[-17,-27],[17,-27],[15,20],[-14,20]],kit);line(-14,19,15,19,'#101b25',4);
    ctx.fillStyle='#bd8c70';ctx.fillRect(-4,-38,8,9);ellipse(0,-47,9,12,'#c99a7b');ellipse(-1,-54,9,5,'#101b22');
    ctx.restore();
    const leftElbow=elbow(shoulderLeft,hands.left,-4),rightElbow=elbow(shoulderRight,hands.right,4);
    line(shoulderLeft.x,shoulderLeft.y,leftElbow.x,leftElbow.y,'#df762a',10);line(leftElbow.x,leftElbow.y,hands.left.x,hands.left.y,'#c99a7b',7);
    line(shoulderRight.x,shoulderRight.y,rightElbow.x,rightElbow.y,'#f0a13d',10);line(rightElbow.x,rightElbow.y,hands.right.x,hands.right.y,'#c99a7b',7);
    ellipse(hands.left.x,hands.left.y,8,6,'#efffff');ellipse(hands.right.x,hands.right.y,8,6,'#efffff');
    line(hands.left.x-5,hands.left.y,hands.left.x+5,hands.left.y,'#7bb7c1',1.5);line(hands.right.x-5,hands.right.y,hands.right.x+5,hands.right.y,'#7bb7c1',1.5);
  }
  function draw(match, fraction=0, visual={}) {
    ctx.setTransform(1,0,0,1,0,0);
    if(cachedLeague!==match.league||!background)stadium(match.league);
    const shot=match.outcome, scene=SCENARIOS[match.plan[match.index].scenario];
    const now=visual.time??0, reduced=visual.reduced??false;
    const resultAge=visual.resultAge??(match.phase==='result'?0:9999);
    const t=shot?clamp(fraction,0,1)*shot.stop:0;
    const follow=reduced?0:smooth(t)*.14;
    ctx.save();ctx.translate(550,290);ctx.scale(1+follow,1+follow);ctx.translate(-550,-290);
    ctx.drawImage(background,0,0);
    const keeper=keeperPose(scene,shot,fraction,{resultAge,reduced,time:now});
    goalkeeper(keeper);
    if(shot?.type==='save'&&fraction>.82&&resultAge<180){ellipse(shot.contact.x,shot.contact.y,11,8,'#efffff55');}
    for(const [i,x] of [scene.wall-34,scene.wall,scene.wall+34].entries())athlete(x,441,1.12,'#f0f4fa',{wall:true,number:String(4+i)});
    if(match.phase==='aim') {
      const end={x:match.aim.x,y:match.aim.y,spin:match.aim.spin};
      ctx.setLineDash([3,12]);ctx.strokeStyle='#d8ff777b';ctx.lineWidth=2;ctx.beginPath();
      for(let i=0;i<=40;i++){const p=pathPoint(end,i/40);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.stroke();ctx.setLineDash([]);
      const p=match.aim,pulse=reduced?0:Math.sin(now*.005)*2;
      ellipse(p.x,p.y,20+pulse,20+pulse,'#d6ff4917');ctx.strokeStyle='#dbff74';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,16+pulse,0,Math.PI*2);ctx.stroke();
      line(p.x-27,p.y,p.x-12,p.y,'#efffbd');line(p.x+12,p.y,p.x+27,p.y,'#efffbd');line(p.x,p.y-27,p.x,p.y-12,'#efffbd');line(p.x,p.y+12,p.x,p.y+27,'#efffbd');
      ellipse(550,594,42,12,'#d6ff493a');
    }
    const windup=visual.windup??1;
    const kick=shot?1:0;
    athlete(469+Math.min(windup,1)*kick*43,628-kick*9,1.58,'#d9ff4e',{number:'10',run:shot?windup:0,kick:shot?Math.max(0,1-fraction*4)*windup:0});
    if(shot&&fraction>0&&!reduced){
      for(let i=8;i>0;i--){const p=pathPoint(shot.end,Math.max(0,t-i*.013));ellipse(p.x,p.y,p.r*.75,p.r*.75,`rgba(212,247,255,${.025*(9-i)})`);}
    }
    const p=shot?pathPoint(shot.end,t):{x:550,y:584,r:14};
    ellipse(p.x,600-224*t,p.r*1.25,3.5,'#000e1aaa');football(p,t);
    const since=resultAge;
    if(shot?.goal&&since<950&&!reduced){
      ctx.strokeStyle=`rgba(217,249,255,${.55*(1-since/950)})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(shot.contact.x,shot.contact.y,12+since*.06,9+since*.035,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
    if(shot?.goal&&since<1600&&!reduced){
      for(let i=0;i<44;i++){const seed=i*9.723,age=since/1000;const x=550+Math.sin(seed)*(160+age*370),y=200-Math.cos(seed)*160*age+age*age*170;ctx.save();ctx.translate(x,y);ctx.rotate(seed+age*3);ctx.fillStyle=i%3?'#d6ff4b':'#bdf2ff';ctx.globalAlpha=Math.max(0,1-age/1.6);ctx.fillRect(-3,-7,6,14);ctx.restore();}
    }
    const vignette=ctx.createRadialGradient(550,320,210,550,320,640);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#00101855');ctx.fillStyle=vignette;ctx.fillRect(0,0,1100,650);
  }
  return {draw};
}
