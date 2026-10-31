// 시안 B2 (바닷가 섬 + 48px 지도 + 아기자기 캐릭터) 화면 그리기
// 픽셀 그림·캐릭터·미로 타일·브라운관 효과는 mockups/mockup-B2-map.html 의 코드를 그대로 옮겨 왔다.
// 앱 동작(js/app-b2.js)은 원래 app.js 와 같고, 그리는 부분만 이 파일을 쓴다.
(function () {
const INK='#6b4a32';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const mkC=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};

/* ---------- 기기 맞춤 배치: 노트북·태블릿 화면 크기와 배율(devicePixelRatio)에 따라 모든 크기를 다시 정한다 ----------
   u   = 글자·버튼 배율 (1920×1080 정도의 교실 화면에서 1). 글자는 Galmuri11 크기(11의 배수)에 가깝게 정수 px로 맞춘다
   px  = 미로·캐릭터·테두리 배율 (픽셀 그림 1칸 = px CSS px). 0.125 배율씩 줄여 가며 들어가는 가장 큰 값을 고른다
   cpx = 아래 동작 카드 배율 = px 의 0.75 (카드를 납작하게 해 미로·카메라를 키운다), 화면 너비가 좁으면 더 줄인다
   블록 칸은 미로 아래에 가로로 놓이고, 처음부터 두 줄 높이로 잡는다 (15단계 정답 12개까지 화면이 움직이지 않게).
   오른쪽 세트(미로 + 블록 칸) 높이 = 줄 높이. 왼쪽 세트(카메라 + 버튼)는 이 높이에 맞춰
   카메라 높이 = 줄 높이 - 버튼 - 간격 으로 정해, 두 세트의 위아래 끝이 같은 선에 놓인다 */
const perRow=px=>Math.max(1,Math.floor((254*px-32+4*px)/(34*px)));   /* 미로 너비에 들어가는 블록 수 */
const rowsFor=(n,px)=>Math.max(2,Math.ceil(n/perRow(px)));
const blkH=(rows,px)=>(34*rows+4)*px+24;
function layout(n){
  if(n!=null)layout.n=n;
  const nb=layout.n||0;
  const dpr=window.devicePixelRatio||1,W=innerWidth,H=innerHeight,root=document.documentElement,r=root.style;
  const f2=Math.round(22*Math.max(.68,Math.min(1.3,W/1440,H/860))),u=f2/22;
  const top=Math.round(56*u),gap=Math.round(12*u),btn=Math.round(64*u),rowGap=18;
  const snap=v=>Math.floor(v*dpr*8)/(dpr*8);                                /* 기기 픽셀의 1/8 단위로 맞춘다 */
  const cpxW=(W-32-5*gap-6*8)/(6*96);                                        /* 카드 6장이 화면 너비에 들어가는 배율 */
  const cardP=px=>Math.max(.5,snap(Math.min(px*.75,cpxW)));
  const cardH=cpx=>53*cpx+f2+12;
  const setH=px=>254*px+gap+blkH(rowsFor(nb,px),px);
  /* 가로 배치(노트북·태블릿 가로): 카메라 세트 | 미로 세트, 높이를 맞춘다 */
  const side={camW:px=>(setH(px)-btn-gap)*4/3, setA:px=>setH(px),
    fits:px=>{const c=cardP(px);return setH(px)<=H-top-rowGap-cardH(c)-gap-7*c-4 && 32+side.camW(px)+16+254*px+8<=W}};
  /* 세로 배치(태블릿 세로): 카메라 세트 위, 미로 세트 아래, 너비를 맞춘다 (카메라 너비 = 미로 너비) */
  const stack={camW:px=>254*px, setA:px=>254*px*.75+gap+btn,
    fits:px=>{const c=cardP(px);return stack.setA(px)+rowGap+setH(px)<=H-top-gap-rowGap-cardH(c)-gap-7*c-4 && 254*px+32<=W}};
  const best=m=>{let s=8*dpr;while(s>dpr*.5&&!m.fits(s/dpr))s-=dpr>1?.25:.125;return s};
  const sS=best(side),sT=best(stack),portrait=sT>sS*1.1,m=portrait?stack:side,s=portrait?sT:sS;
  root.classList.toggle('portrait',portrait);
  const px=s/dpr,cpx=cardP(px);
  Object.entries({'--px':px,'--cpx':cpx,'--row':setH(px),'--seta':m.setA(px),'--blkh':blkH(rowsFor(nb,px),px),'--camw':m.camW(px),'--vh':H,
    '--f1':Math.round(11*u),'--f2':f2,'--f3':Math.round(33*u),'--ctl':Math.round(40*u),'--btn':btn,'--pad':Math.round(16*u),
    '--icgap':Math.round(8*u),'--top-h':top,'--gap':gap}).forEach(([k,v])=>r.setProperty(k,v+'px'));
  window.PXS={s,dpr,px,cpx,u,portrait,rows:rowsFor(nb,px)};
  fitButtons();
  return s;
}
/* 카메라 아래 버튼 3개에 글자가 다 안 들어가면(좁은 노트북·태블릿) 그림 위·글자 아래로 바꾸고 글자를 조금 줄인다 */
function fitButtons(){
  const root=document.documentElement,bs=[...document.querySelectorAll('#child-controls .big')];
  root.classList.remove('compact-btn');
  if(bs.some(b=>b.scrollWidth>b.clientWidth+1))root.classList.add('compact-btn');
}
layout.rowsFor=n=>rowsFor(n,(window.PXS||{}).px||2);
layout.fitButtons=fitButtons;
layout(0);

const NOOUT=new Set(['C','G']);            /* motion cue letters: drawn, never outlined */
function pic(rows,pal,outline=true,opt={}){
  const w=rows[0].length,h=rows.length,p=outline?(opt.glow?2:1):0,c=mkC(w+2*p,h+2*p);
  rows.forEach((r,j)=>{if(r.length!==w)throw new Error('pixel map row '+j+' has '+r.length+' chars, expected '+w)});
  const x=c.getContext('2d');
  const solid=(i,j)=>i>=0&&j>=0&&i<w&&j<h&&rows[j][i]!=='.'&&!!pal[rows[j][i]]&&!NOOUT.has(rows[j][i]);
  const isOut=(i,j)=>!solid(i,j)&&(solid(i+1,j)||solid(i-1,j)||solid(i,j+1)||solid(i,j-1));
  if(outline){
    if(opt.glow){x.fillStyle=opt.glowColor||'#fff3b0';
      const act=(i,j)=>i>=0&&j>=0&&i<w&&j<h&&opt.glow.includes(rows[j][i]);
      for(let j=-2;j<=h+1;j++)for(let i=-2;i<=w+1;i++){if(solid(i,j)||isOut(i,j))continue;
        let hit=false;for(const[a,b]of[[1,0],[-1,0],[0,1],[0,-1]]){const ii=i+a,jj=j+b;if(isOut(ii,jj)){for(let u=-1;u<=1&&!hit;u++)for(let v=-1;v<=1;v++)if(act(ii+u,jj+v)){hit=true;break}}if(hit)break}
        if(hit)x.fillRect(i+p,j+p,1,1)}}
    x.fillStyle=INK;for(let j=-1;j<=h;j++)for(let i=-1;i<=w;i++)if(isOut(i,j))x.fillRect(i+p,j+p,1,1)}
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const ch=rows[j][i];if(ch!=='.'&&pal[ch]){x.fillStyle=pal[ch];x.fillRect(i+p,j+p,1,1)}}
  return c;
}
const toImg=(c,cls='')=>`<img class="px ${cls}" alt="" aria-hidden="true" src="${c.toDataURL()}" style="width:calc(var(--px)*${c.width});height:calc(var(--px)*${c.height})">`;
/* n-times upscale of a small pixel map with rounded corners, so icons get more pixels, not bigger pixels */
function up(rows,n){
  if(n===1)return rows;
  const h=rows.length,w=rows[0].length,out=[];
  const at=(i,j)=>(i>=0&&j>=0&&i<w&&j<h)?rows[j][i]:'.';
  for(let y=0;y<h*n;y++){let s='';for(let x=0;x<w*n;x++){
    const fx=(x+.5)/n-.5,fy=(y+.5)/n-.5,i0=Math.floor(fx),j0=Math.floor(fy),tx=fx-i0,ty=fy-j0,v={};
    [[0,0,(1-tx)*(1-ty)],[1,0,tx*(1-ty)],[0,1,(1-tx)*ty],[1,1,tx*ty]].forEach(([a,b,wt])=>{const c=at(i0+a,j0+b);v[c]=(v[c]||0)+wt});
    let best='.',bw=-1;for(const c in v){const wv=v[c]-(c==='.'?1e-6:0);if(wv>bw){bw=wv;best=c}}
    s+=best}out.push(s)}
  return out;
}
const ARROW=['....X....','...XXX...','..XXXXX..','.XXXXXXX.','...XXX...','...XXX...','...XXX...','...XXX...','.........'];
const TURN=['.........','.....X...','.....XX..','.XXXXXXX.','.X...XX..','.X...X...','.X.......','.X.......','.........'];
const mirror=m=>m.map(r=>[...r].reverse().join(''));
const SHELL=['..XXXX..','.XhXXdX.','XXhXdXXX','XhXXdXXX','XXdXXXdX','.XXXXXX.','..dddd..','...dd...'];
const STAR=['....X....','...XXX...','XXXXXXXXX','.XXXdXXX.','..XXXXX..','..XXdXX..','.XXX.XXX.','.XX...XX.','.X.....X.'];
const LEAF=['......XX','....XXXX','..XXXXXd','.XXXXXd.','XXXXdd..','XXdd....','Xd......','d.......'];
const BROOM=['......dd','.....dd.','....dd..','...dd...','..XXXX..','.XXXXXX.','.XhXXhX.','.X.X.X..'];
const DISK=['XXXXXXX.','XhhhhhX.','XhhhhhXX','XXXXXXXX','XdddddXX','XdXXXdXX','XdXXXdXX','XXXXXXXX'];
const PAUSE=['XX..XX','XX..XX','XX..XX','XX..XX','XX..XX','XX..XX'];
const CAMI=['..XXX...','XXXXXXXX','XXXhhXXX','XXhXXhXX','XXhXXhXX','XXXhhXXX','XXXXXXXX'];
const TARGET=['..XXX..','.X...X.','X..X..X','X.XXX.X','X..X..X','.X...X.','..XXX..'];
const PLAY=['XX.....','XXXX...','XXXXXX.','XXXXXXX','XXXXXX.','XXXX...','XX.....'];
const IC={
  arrow:[ARROW,{X:'#fff4d6'}], turn:[TURN,{X:'#fff4d6'}], turnL:[mirror(TURN),{X:'#fff4d6'}],
  shell:[SHELL,{X:'#ffc9d6',h:'#fff',d:'#e88aa6'}], star:[STAR,{X:'#f4a259',d:'#d9772f'}], leaf:[LEAF,{X:'#4cbf5a',d:'#2f8f4a'}],
  broom:[BROOM,{X:'#e8c15a',h:'#fff0a8',d:'#8b5a2b'}], disk:[DISK,{X:'#3d8fe0',h:'#fff4d6',d:'#25609e'}],
  pause:[PAUSE,{X:'#e8554e'}], cam:[CAMI,{X:'#3d8fe0',h:'#fff4d6'}], target:[TARGET,{X:'#2f8f4a'}],
  play:[PLAY,{X:'#3d8fe0'}], prev:[mirror(PLAY),{X:'#3d8fe0'}], next:[PLAY,{X:'#3d8fe0'}]
};
const ICONS={};
Object.keys(IC).forEach(k=>ICONS[k]=(n=2)=>toImg(pic(up(IC[k][0],n),IC[k][1])));

/* ---------- cute chibi character (original design) ----------
   A tiny volumetric model (head sphere, torso ellipsoid, capsule limbs) rendered straight onto a pixel grid.
   yaw: 0 = facing viewer (front), 90 = facing screen-right, 180 = back.  Light from top-left: 3 tones per material.
   k = detail multiplier (more pixels, same pixel size).  pad = extra rows on top (raised hands). */
const T_CAP=['q','R','r'],T_HAIR=['j','h','H'],T_SKIN=['k','s','S'],T_SHIRT=['c','b','B'],T_SHORT=['o','n','N'],T_ACT=['A','a','b'];
const LT=(()=>{const v=[-.55,-.7,.45],n=Math.hypot(...v);return v.map(a=>a/n)})();
const tone=(nx,ny,nz,t)=>{const d=nx*LT[0]+ny*LT[1]+nz*LT[2];return t[d>.62?0:d>.02?1:2]};
const HY=11.4,HR=12.3,HRY=10.4;
function chibi(o={}){
  const yaw=(o.yaw||0)*Math.PI/180,ca=Math.cos(yaw),sa=Math.sin(yaw),k=o.k||1,pad=o.pad||0,W=o.w||40,ox=W/2,leg=o.leg||'stand';
  const gw=Math.round(W*k),gh=Math.round((42+pad)*k),g=Array.from({length:gh},()=>Array(gw).fill('.'));
  let cur=null;
  const put=(i,j,c)=>{if(i>=0&&j>=0&&i<gw&&j<gh){g[j][i]=c;if(cur)cur.add(j*gw+i)}};
  const putXY=(x,y,c)=>put(Math.floor((x+ox)*k),Math.floor((y+pad)*k),c);
  const paint=(x0,y0,x1,y1,fn)=>{
    const i0=Math.max(0,Math.floor((x0+ox)*k)),i1=Math.min(gw,Math.ceil((x1+ox)*k)),j0=Math.max(0,Math.floor((y0+pad)*k)),j1=Math.min(gh,Math.ceil((y1+pad)*k));
    for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++){const c=fn((i+.5)/k-ox,(j+.5)/k-pad);if(c)put(i,j,c)}};
  /* a part gets a 1px inner line where it overlaps earlier parts (keeps arms readable over the body) */
  const part=(edge,f)=>{const m=new Set();cur=m;f();cur=null;if(!edge)return;const hits=[];
    m.forEach(id=>{const i=id%gw,j=(id-i)/gw;for(const[a,b]of[[1,0],[-1,0],[0,1],[0,-1]]){const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=gw||jj>=gh)continue;
      if(!m.has(jj*gw+ii)&&g[jj][ii]!=='.'&&!NOOUT.has(g[jj][ii])){hits.push(id);break}}});
    hits.forEach(id=>{const i=id%gw;g[(id-i)/gw][i]='O'})};
  const P=(L,y,F)=>({x:-L*ca+F*sa,y,z:L*sa+F*ca});
  const ell=(cx,cy,rx,ry,t)=>paint(cx-rx,cy-ry,cx+rx,cy+ry,(x,y)=>{const nx=(x-cx)/rx,ny=(y-cy)/ry,d=nx*nx+ny*ny;if(d>1)return null;
    return typeof t==='string'?t:Array.isArray(t)?tone(nx,ny,Math.sqrt(1-d),t):t(nx,ny,Math.sqrt(1-d),x,y)});
  const seg=(a,b,r,t)=>paint(Math.min(a.x,b.x)-r,Math.min(a.y,b.y)-r,Math.max(a.x,b.x)+r,Math.max(a.y,b.y)+r,(x,y)=>{
    const vx=b.x-a.x,vy=b.y-a.y,L=vx*vx+vy*vy;let u=L?((x-a.x)*vx+(y-a.y)*vy)/L:0;u=Math.max(0,Math.min(1,u));
    const dx=x-a.x-vx*u,dy=y-a.y-vy*u,d=(dx*dx+dy*dy)/(r*r);if(d>1)return null;return typeof t==='string'?t:tone(dx/r,dy/r,Math.sqrt(1-d),t)});
  /* open hand: paddle along u (fingers), thumb on side th, two finger slits */
  const palm=(w,u,th,t=T_SKIN)=>{const px=-u[1]*th,py=u[0]*th;
    ell(w.x+u[0]*1.2+px*2.3,w.y+u[1]*1.2+py*2.3,1.25,1.25,t);
    const b={x:w.x+u[0]*3.2,y:w.y+u[1]*3.2};seg({x:w.x+u[0]*.8,y:w.y+u[1]*.8},b,2.45,t);
    if(t===T_SKIN)[-1,1].forEach(q=>{for(let s=0;s<=1.5;s+=.2/k)putXY(b.x+u[0]*(2.3-s)-u[1]*q*.9,b.y+u[1]*(2.3-s)+u[0]*q*.9,'S')})};
  const arm=a=>part(true,()=>{const p=a.pts;seg(p[0],p[1],2.5,a.act?T_ACT:T_SHIRT);
    for(let i=1;i<p.length-1;i++)seg(p[i],p[i+1],2.05,T_SKIN);
    const h=p[p.length-1];if(a.open)palm(h,a.open,a.th||1);else ell(h.x,h.y,2.35,2.35,T_SKIN)});
  const sw=leg==='step'?1:leg==='stepM'?-1:0;
  const arms=typeof o.arms==='function'?o.arms(P):o.arms||[1,-1].map(s=>({pts:[P(6.2*s,25.5,0),P(7.6*s,28.8,.3-1.4*sw*s),P(8.1*s,32.2,.6-2.4*sw*s)]}));
  const back=arms.filter(a=>a.pts[0].z<-1),mid=arms.filter(a=>a.pts[0].z>=-1&&!(a.over||Math.max(...a.pts.map(p=>p.z))>1.5)),over=arms.filter(a=>!back.includes(a)&&!mid.includes(a));
  /* legs + shoes, far one first */
  [1,-1].map(s=>{const f=sw?(s*sw>0?3:-2):0,lift=f>0?1.6:0;return{s,f,lift,z:P(3.3*s,0,f).z}}).sort((a,b)=>a.z-b.z).forEach(l=>part(true,()=>{
    const hp=P(3.3*l.s,34,0),ft=P(3.3*l.s,38.2-l.lift,l.f);seg(hp,ft,2.3,T_SKIN);
    const c=P(3.3*l.s,39.7-l.lift,l.f+1.1);ell(c.x,c.y,Math.hypot(3.5*ca,4.4*sa),2.3,(nx,ny)=>ny>.3?'W':'w')}));
  back.forEach(arm);
  const tw=Math.hypot(7.2*ca,5.8*sa);
  part(true,()=>ell(0,29,tw,6.4,(nx,ny,nz,x,y)=>tone(nx,ny,nz,y>32.4?T_SHORT:T_SHIRT)));
  const nk=P(0,23.2,1.8);if(nk.z>-1)ell(nk.x*.6,23.2,2.6,1.5,T_SKIN);
  mid.forEach(arm);
  /* ears (behind or in front of the head) */
  const ears=[1,-1].map(s=>({x:-s*(HR-.3)*ca,z:s*HR*sa}));
  const ear=e=>part(true,()=>ell(e.x+(Math.abs(e.x)>3?Math.sign(e.x)*.6:0),HY+3.4,1.7,2.1,T_SKIN));
  ears.filter(e=>e.z<=2).forEach(ear);
  /* cap brim: flat half-disc seen slightly from above; per-column top surface + 1px underside */
  const brim=()=>{const top={},bot={};
    for(let L=-10.4;L<=10.4;L+=.1/k){const fm=4+9.4*Math.sqrt(Math.max(0,1-(L/10.6)**2));for(let F=2;F<=fm;F+=.1/k){
      const x=-L*ca+F*sa,z=L*sa+F*ca,y=8.1+z*.1,i=Math.floor((x+ox)*k);top[i]=Math.min(top[i]??1e9,y);bot[i]=Math.max(bot[i]??-1e9,y+1)}}
    part(true,()=>{for(const i in top){const j0=Math.floor((top[i]+pad)*k),j1=Math.floor((bot[i]+pad)*k);
      for(let j=j0;j<j1;j++)put(+i,j,j-j0<k&&j1-j0>k?'R':'r');for(let j=j1;j<j1+k;j++)put(+i,j,'d')}})};
  const brimFront=ca>-.35;
  if(!brimFront)brim();
  /* head */
  const capEdge=F=>-.14-.15*F;
  part(true,()=>ell(0,HY,HR,HRY,(nx,ny,nz)=>{
    const L=-nx*ca+nz*sa,F=nx*sa+nz*ca,ce=capEdge(F);
    if(ny<ce){
      if(F<-.55&&Math.abs(L)<.2&&ny>ce-.16)return tone(nx,ny,nz,T_HAIR);           /* cap back opening */
      if(F>.3&&(L/.16)**2+((ny+.6)/.17)**2<1)return'w';                                /* cap badge */
      return tone(nx,ny,nz,T_CAP)}
    const fr=ce+.42+.13*Math.abs(Math.sin(L*8.5));
    if(ny<fr||(F<.5&&ny<.5)||F<-.1)return tone(nx,ny,nz,T_HAIR);
    return tone(nx,ny,nz,T_SKIN)}));
  /* face features on the sphere (pulled slightly toward the face centre for cuteness) */
  const feat=(eL,ey,draw)=>{const eF=Math.sqrt(Math.max(0,1-eL*eL-ey*ey)),z=eL*sa+eF*ca;if(z<.12)return;
    draw(HR*(-eL*ca+eF*sa*.78),HY+ey*HRY,.4+.6*z,z)};
  [-1,1].forEach(s=>{
    feat(.64*s,.58,(x,y,f)=>ell(x,y,2.1*f,1.2,'p'));
    feat(.4*s,.36,(x,y,f,z)=>{ell(x,y,1.7*f,2.2,'e');if(z>.45)ell(x-.5,y-.85,.6,.6,'w')})});
  feat(0,.78,(x,y,f)=>{seg({x:x-1.1*f,y:y-.45},{x,y:y+.35},.45,'m');seg({x,y:y+.35},{x:x+1.1*f,y:y-.45},.45,'m')});
  ears.filter(e=>e.z>2).forEach(ear);
  if(brimFront)brim();
  /* shadow under the brim */
  for(let j=gh-1;j>0;j--)for(let i=0;i<gw;i++){let d=false;for(let t=1;t<=k&&j-t>=0;t++)if(g[j-t][i]==='d')d=true;
    if(d){const c=g[j][i];if(T_SKIN.includes(c))g[j][i]='S';else if(T_HAIR.includes(c))g[j][i]='H'}}
  over.forEach(arm);
  if(o.cue)o.cue({seg,ell,palm,putXY});
  return g.map(r=>r.join(''));
}
function shade(hex,f){const n=parseInt(hex.slice(1),16),c=v=>Math.max(0,Math.min(255,Math.round(v*f)));return'#'+[n>>16,n>>8&255,n&255].map(v=>c(v).toString(16).padStart(2,'0')).join('')}
function mix(hex,hex2,t){const a=parseInt(hex.slice(1),16),b=parseInt(hex2.slice(1),16),m=s=>Math.round((a>>s&255)*(1-t)+(b>>s&255)*t);return'#'+[16,8,0].map(s=>m(s).toString(16).padStart(2,'0')).join('')}
const CPAL=(shirt='#3d8fe0')=>({q:'#ff8f84',R:'#e8554e',r:'#bc3f3a',d:'#7d2723',j:'#aa723f',h:'#8a5530',H:'#62401f',
  k:'#ffe8c8',s:'#ffd4a6',S:'#e9aa7a',c:shade(shirt,1.16),b:shirt,B:shade(shirt,.74),A:mix(shirt,'#ffffff',.55),a:mix(shirt,'#ffffff',.32),
  o:'#c08a52',n:'#a06c3a',N:'#79512c',w:'#fffaf0',W:'#cdbfa8',e:'#3a2418',p:'#ff9da3',m:'#a8483f',O:'#8a5c3c',C:'#f39a42',G:'rgba(255,226,196,.6)'});

/* ---------- gesture poses (front view unless noted; screen x, y, depth z; child's right arm = picture right) ---------- */
const XY=(x,y,z=0)=>({x,y,z});
const mirX=a=>a.map(p=>XY(-p.x,p.y,p.z));
const NA=[XY(-6.2,25.5),XY(-7.6,28.8,.3),XY(-8.1,32.2,.6)];
const DOWN=[XY(-6.2,25.5),XY(-7.0,29,.3),XY(-7.4,32.6,.6)];
const SIDE=[XY(6.4,25.2),XY(21,24.8),XY(37,24.4)];
const ROUND=[XY(-6.6,25),XY(-13.6,17.6,.5),XY(-15.2,8.2,1),XY(-11.6,.6,1.2),XY(-2.3,-3.4,1.5)];
const WIPE=[XY(-6.4,25.4),XY(-11.5,31,2),XY(-4.4,29.2,6)];
const POSE={
  neutral:{arms:[{pts:NA},{pts:mirX(NA)}]},
  '오른쪽':{arms:[{pts:DOWN},{pts:SIDE,open:[1,0],th:-1,act:1}]},
  '왼쪽':{arms:[{pts:mirX(SIDE),open:[-1,0],th:1,act:1},{pts:mirX(DOWN)}]},
  '하나 지우기':{arms:[{pts:[XY(-6.4,25.4),XY(-13,35,3),XY(10,22.5,6)],act:1},{pts:[XY(6.4,25.4),XY(13,35,3),XY(-10,22.5,6.5)],act:1}]},
  '모두 지우기':{arms:[{pts:WIPE,open:[0,-1],th:1,act:1},{pts:mirX(WIPE),open:[0,-1],th:-1,act:1}],
    cue:({seg,palm})=>{[-1,1].forEach(s=>{palm(XY(15*s,29.2),[0,-1],-s,'G');
      seg(XY(19.5*s,22.4),XY(25*s,22.4),.5,'C');seg(XY(19.5*s,36.4),XY(25*s,36.4),.5,'C');
      seg(XY(19*s,29.4),XY(30*s,29.4),.6,'C');seg(XY(30.4*s,29.4),XY(27*s,26),.6,'C');seg(XY(30.4*s,29.4),XY(27*s,32.8),.6,'C')})}},
  '실행':{arms:[{pts:ROUND,act:1,over:1},{pts:mirX(ROUND),act:1,over:1}]},
  '앞으로':{yaw:55,arms:P=>[{pts:[P(6.4,25.6,0),P(5.6,27.4,15),P(4.8,27.4,30)],act:1},{pts:[P(-6.4,25.2,0),P(-5.4,23.6,15),P(-4.6,23.4,30)],act:1}],
    cue:({seg})=>[33,38].forEach(x=>{seg(XY(x,22),XY(x+3,25.4),.6,'C');seg(XY(x+3,25.4),XY(x,28.8),.6,'C')})}
};
/* figure used by guide cards, candidate box and tutorial (same design, same pixel size) */
function figCanvas(pose,shirt='#3d8fe0',o={}){
  const d=POSE[pose]||POSE.neutral;
  return pic(chibi({yaw:d.yaw||0,arms:d.arms,cue:d.cue,k:o.k||1,pad:7,w:92}),CPAL(shirt),true,{glow:'Aa'});
}
function cropX(c){const x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let a=c.width,b=0;
  for(let j=0;j<c.height;j++)for(let i=0;i<c.width;i++)if(d[(j*c.width+i)*4+3]){a=Math.min(a,i);b=Math.max(b,i)}
  const o=mkC(b-a+1,c.height);o.getContext('2d').drawImage(c,-a,0);return o}
const fig=(pose,shirt,o={})=>toImg(o.tight?cropX(figCanvas(pose,shirt,o)):figCanvas(pose,shirt,o));

/* ---------- camera placeholder ---------- */
(function(){
  const rows=chibi({k:2.3}),h=rows.length,w=rows[0].length,c=mkC(w,h),x=c.getContext('2d');
  const on=(i,j)=>i>=0&&j>=0&&i<w&&j<h&&rows[j][i]!=='.';
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(on(i,j)){
    const edge=!on(i+1,j)||!on(i-1,j)||!on(i,j+1)||!on(i,j-1);
    x.fillStyle=edge?(((i+j)>>2)%2?'rgba(168,230,200,0)':'rgba(168,230,200,.38)'):'rgba(168,230,200,.05)';x.fillRect(i,j,1,1)}
  $('#sil').innerHTML=toImg(c);
})();
/* CRT effect start */
/* crtPower(screenEl, on, done?) -> Promise<boolean> (false if interrupted by a newer call).
   crtPower.speed = 1 (set 4 for slow review). Honors prefers-reduced-motion (3-step fade). */
const crtPower=(()=>{
  const RM=matchMedia('(prefers-reduced-motion: reduce)');
  const NOISE=['#1d2836','#2c3b4d','#56687c','#a8b8c8','#e8eef0','#fff4d6'];
  function setup(box){
    if(box._crt)return box._crt;
    const pic=document.createElement('div');pic.className='crt-pic';
    [...box.childNodes].forEach(n=>{if(!(n.nodeType===1&&n.hasAttribute('data-crt-keep')))pic.appendChild(n)});
    const fx=document.createElement('div');fx.className='crt-fx';fx.setAttribute('aria-hidden','true');
    fx.innerHTML='<canvas class="crt-noise"></canvas><i class="crt-scan"></i><i class="crt-beam"></i>';
    box.prepend(pic,fx);
    return box._crt={pic,noise:fx.children[0],beam:fx.children[2],run:0};
  }
  function crtPower(box,on,done){
    const c=setup(box),id=++c.run,sp=crtPower.speed||1;
    const L=parseFloat(getComputedStyle(box).getPropertyValue('--px'))||2;
    const W=box.clientWidth,H=box.clientHeight,snap=v=>Math.max(L,Math.round(v/L)*L);
    const P=c.pic.style,B=c.beam.style,N=c.noise;
    // picture squashed to height h (snapped, centered), brightness b
    const pic=(h,b)=>{if(h==null){P.visibility='hidden';return}
      h=Math.min(H,snap(h));const y=snap((H-h)/2);P.visibility='visible';
      P.transform=h>=H?'':`translateY(${y}px) scaleY(${h/H})`;P.filter=b&&b!==1?`brightness(${b})`:''};
    const beam=(w,h,o=1)=>{if(w==null){B.display='none';return}
      w=snap(w);h=snap(h);Object.assign(B,{display:'block',width:w+'px',height:h+'px',left:snap((W-w)/2)+'px',top:snap((H-h)/2)+'px',opacity:o})};
    const noise=(h,o)=>{if(h==null){N.style.display='none';return}
      h=Math.min(H,snap(h));const cw=Math.ceil(W/L),ch=Math.round(h/L),x=N.getContext('2d');
      N.width=cw;N.height=ch;Object.assign(N.style,{display:'block',top:snap((H-h)/2)+'px',height:h+'px',opacity:o});
      for(let j=0;j<ch;j++)for(let i=0;i<cw;){const r=1+(Math.random()*3|0);x.fillStyle=NOISE[Math.random()*NOISE.length|0];x.fillRect(i,j,r,1);i+=r}};
    const reset=()=>{beam();noise();P.transform=P.filter=P.opacity='';P.visibility=''};
    let F;
    if(RM.matches){
      F=on?[[0,()=>{reset();P.opacity=.33}],[90,()=>P.opacity=.66],[90,()=>P.opacity='']]
          :[[0,()=>P.opacity=.66],[90,()=>P.opacity=.33],[90,()=>P.opacity=0]];
    }else if(!on){ // OFF ≈ 660ms: squash 200 · line 60 · shrink 160 · dot 140 · fade 100
      F=[[0,()=>{reset();pic(H*.72,1.3)}],[40,()=>pic(H*.46,1.6)],[40,()=>pic(H*.26,1.9)],[40,()=>pic(H*.12,2.3)],[40,()=>pic(H*.05,2.8)],
        [40,()=>{pic(null);beam(W,2*L)}],[60,()=>beam(W*.7,2*L)],[40,()=>beam(W*.45,2*L)],[40,()=>beam(W*.24,2*L)],[40,()=>beam(W*.1,2*L)],
        [40,()=>beam(4*L,4*L)],[140,()=>beam(4*L,4*L,.66)],[50,()=>beam(2*L,2*L,.33)],[50,()=>beam()]];
    }else{ // ON ≈ 720ms: dot 120 · line 175 · expand+static 225 · flicker 200
      F=[[0,()=>{reset();pic(null);beam(2*L,2*L)}],[60,()=>beam(4*L,4*L)],
        [60,()=>beam(W*.12,2*L)],[35,()=>beam(W*.3,2*L)],[35,()=>beam(W*.55,2*L)],[35,()=>beam(W*.8,2*L)],[35,()=>beam(W,2*L)],
        [35,()=>{beam(W,4*L);pic(H*.06,2.6)}],[45,()=>{beam();pic(H*.18,2)}],[45,()=>pic(H*.4,1.6)],
        [45,()=>{pic(H*.7,1.3);noise(H*.7,.85)}],[45,()=>{pic(H,1.45);noise(H,.55)}],
        [45,()=>{noise();pic(H,.75)}],[40,()=>pic(H,1.2)],[40,()=>pic(H,.9)],[40,()=>pic(H,1)]];
    }
    box.classList.remove('crt-on','crt-off');box.classList.add(on?'crt-on':'crt-off');
    if(on)box.classList.remove('crt-dark');
    return new Promise(res=>{let i=0;
      const step=()=>{if(id!==c.run)return res(false);
        if(i<F.length){const[ms,fn]=F[i++];return setTimeout(()=>{if(id!==c.run)return res(false);fn();step()},ms*sp)}
        reset();box.classList.remove('crt-on','crt-off');box.classList.toggle('crt-dark',!on);done&&done(on);res(true)};
      step();});
  }
  return crtPower;
})();
/* CRT effect end */
/* ---------- maze tiles (48 px, 240x240 logical canvas) ---------- */
const T=48;
let cx=null;
const WALK=c=>c==='.'||c==='G';
const DIRV=[[0,-1],[1,0],[0,1],[-1,0]];                 /* 0 up, 1 right, 2 down, 3 left */
const rnd=(a,b,c)=>{let n=(a*374761393+b*668265263+c*2147483647)|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296};

/* ---- character sprites: 8 facings (45° steps) x stand; walk frames for the 4 map directions ---- */
const yawOf=d=>((180-90*d)%360+360)%360;              /* up = back view (180), right = 90, down = front (0), left = 270 */
const SPR={};
for(let a=0;a<360;a+=45){const pal=CPAL();SPR[a]={stand:pic(chibi({yaw:a}),pal)};
  if(a%90===0){SPR[a].step=pic(chibi({yaw:a,leg:'step'}),pal);SPR[a].stepM=pic(chibi({yaw:a,leg:'stepM'}),pal)}}
/* ---- drawing helpers for tiles ---- */
let D=cx;
const R=(x,y,w,h,c)=>{D.fillStyle=c;D.fillRect(x,y,w,h)};
class Gd{constructor(w,h){this.w=w;this.h=h;this.a=Array.from({length:h},()=>Array(w).fill('.'))}
  set(x,y,c){x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<this.w&&y<this.h)this.a[y][x]=c}
  rect(x,y,w,h,c){for(let j=0;j<h;j++)for(let i=0;i<w;i++)this.set(x+i,y+j,c)}
  ell(cx,cy,rx,ry,c){for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++){const dx=(x+.5-cx)/rx,dy=(y+.5-cy)/ry;if(dx*dx+dy*dy<=1){const v=typeof c==='function'?c(x,y):c;if(v)this.a[y][x]=v}}}
  rows(){return this.a.map(r=>r.join(''))}}
const TP={t:'#b9803f',T:'#8a5a2c',g:'#2f8f4a',l:'#4cbf5a',k:'#6b4220',a:'#aab3bd',b:'#8a94a0',c:'#e6ecf1',x:'#f9ecc2',z:'#e0c47c',y:'#e8c15a',P:'#8b5a2b',G:'#4cbf5a',F:'#fff4d6',j:'#2f8f4a',L:'#7be08a'};

function water(ox,oy,gx,gy){
  R(ox,oy,T,T,'#5bb8ec');
  for(let i=0;i<8;i++)R(ox+3+Math.floor(rnd(gx,gy,i)*40),oy+3+Math.floor(rnd(gx,gy,i+9)*40),2,1,'#4aa6dc');
  for(let i=0;i<3;i++){const x=ox+3+Math.floor(rnd(gx,gy,i+20)*30),y=oy+5+Math.floor(rnd(gx,gy,i+30)*34);R(x+1,y,5,1,'#a9e3fa');R(x,y+1,1,1,'#a9e3fa');R(x+6,y+1,1,1,'#a9e3fa')}
}
function sand(ox,oy,gx,gy){
  R(ox,oy,T,T,'#f3dfa6');
  for(let i=0;i<10;i++)R(ox+2+Math.floor(rnd(gx,gy,i+40)*42),oy+2+Math.floor(rnd(gx,gy,i+50)*42),rnd(gx,gy,i+60)>.6?2:1,1,'#e0c47c');
  for(let i=0;i<4;i++)R(ox+3+Math.floor(rnd(gx,gy,i+70)*38),oy+3+Math.floor(rnd(gx,gy,i+80)*40),2,1,'#f9ecc2');
  /* 칸 테두리: 이웃 모래 칸과 맞닿으면 두 줄이 된다. 예측하기처럼 모래만 있는 지도에서도 칸이 보이게 */
  R(ox,oy,T,1,'#c9a35c');R(ox,oy+T-1,T,1,'#c9a35c');R(ox,oy,1,T,'#c9a35c');R(ox+T-1,oy,1,T,'#c9a35c');
}
function grass(ox,oy,gx,gy){
  R(ox,oy,T,T,'#9ad98a');
  for(let i=0;i<10;i++){const x=ox+2+Math.floor(rnd(gx,gy,i+100)*42),y=oy+2+Math.floor(rnd(gx,gy,i+110)*42);R(x,y,2,1,'#7bc27a');R(x+(i%2),y-1,1,1,'#7bc27a')}
  for(let i=0;i<5;i++)R(ox+2+Math.floor(rnd(gx,gy,i+120)*42),oy+2+Math.floor(rnd(gx,gy,i+130)*42),2,1,'#b9eaa8');
}
const E=(ox,oy,s,i,d,c)=>{const p=[[i,d],[T-1-d,i],[i,T-1-d],[d,i]][s];R(ox+p[0],oy+p[1],1,1,c)};
function foam(ox,oy,s){for(let i=0;i<T;i++){if((i+s*3)%9<6)E(ox,oy,s,i,0,'#f1fbff');if((i+5+s*3)%9<5)E(ox,oy,s,i,1,'#bfeafd');if((i*7+s)%5===0)E(ox,oy,s,i,2,'#a9e3fa')}}
function grassRim(ox,oy,s){for(let i=0;i<T;i++){E(ox,oy,s,i,0,'#5fae5c');E(ox,oy,s,i,1,'#6fba68');if(i%7<3)E(ox,oy,s,i,2,'#7bc27a')}}

function palmGrid(lean){
  const g=new Gd(46,46);
  const tx=t=>21+lean*(5*t+2.5*Math.sin(t*Math.PI));
  for(let i=0;i<=28;i++){const t=i/28,y=43-i,x=Math.round(tx(t)),w=i<3?3:2;g.rect(x-w,y,w*2+1,1,'t');g.rect(x+1,y,w,1,'T');if(i%4===0)g.rect(x-w,y,w*2+1,1,'T')}
  const C=[tx(1),15],tips=[[2,23],[4,11],[13,2],[37,2],[44,11],[45,24]].map(([x,y])=>[lean>0?x:46-x,y]);
  const bz=(e,t)=>{const kx=(C[0]+e[0])/2,ky=Math.min(C[1],e[1])-5;return[(1-t)*(1-t)*C[0]+2*(1-t)*t*kx+t*t*e[0],(1-t)*(1-t)*C[1]+2*(1-t)*t*ky+t*t*e[1]]};
  tips.forEach(e=>{for(let s=0;s<=60;s++){const t=s/60,[x,y]=bz(e,t),r=2.5-1.5*t;g.ell(x,y,r,r,'g')}});
  tips.forEach(e=>{for(let s=0;s<=60;s++){const t=s/60,[x,y]=bz(e,t),r=2.5-1.5*t;if(r>1.5)g.ell(x,y-.8,r-1,r-1,'l')}});
  g.rect(Math.round(C[0])-3,16,2,2,'k');g.rect(Math.round(C[0])+1,17,2,2,'k');
  return g.rows();
}
function rockGrid(){
  const g=new Gd(46,46),sh=(cx,cy,ry)=>(x,y)=>y>cy+ry*.3?'b':'a';
  g.ell(20,29,14,10,sh(20,29,10));g.ell(37,35,7,5,sh(37,35,5));g.ell(9,38,4,3,sh(9,38,3));
  g.ell(14.5,23.5,3,1.6,'c');g.ell(35,32.5,1.6,.9,'c');
  return g.rows();
}
/* goal: small sand mound in the BACK-RIGHT corner (pole + flag drawn per frame so a character standing front-centre never hides it) */
function moundGrid(){
  const g=new Gd(48,48);
  g.ell(41,16,6.5,3,(x,y)=>y>16?'z':'x');
  return g.rows();
}
/* flag cloth hangs to the LEFT of the pole (attached edge on the right), above the character's head */
function clothGrid(ph,amp=1.2){
  const g=new Gd(18,12),top=x=>1+Math.round(Math.sin((15-x)/2.6+ph)*amp*(15-x)/15);
  for(let x=0;x<16;x++){g.rect(x,top(x),1,8,'G');g.set(x,top(x)+7,'j');g.set(x,top(x),'L')}
  g.set(10,top(10)+3,'F');g.set(11,top(11)+3,'F');g.set(11,top(11)+4,'F');
  return g.rows();
}
const PALM=[pic(palmGrid(1),TP),pic(palmGrid(-1),TP)],ROCK=pic(rockGrid(),TP),MOUND=pic(moundGrid(),TP,false);
const CLOTH=[pic(clothGrid(0),TP),pic(clothGrid(2.2),TP)],CLOTHW=[0,2.1,4.2].map(p=>pic(clothGrid(p,1.8),TP));
const SHELLC=pic(SHELL,IC.shell[1]),STARC=pic(STAR,IC.star[1]);
/* ---- footprints on the next tile (faint, oriented) ---- */
const FOOT=up(['.XXX.','XXXXX','XXXXX','.XXX.','..XX.','..XX.','.XXX.'],2);
const rotCW=m=>m[0].split('').map((_,c)=>m.map(r=>r[c]).reverse().join(''));
const FOOTD=[FOOT,rotCW(FOOT),rotCW(rotCW(FOOT)),rotCW(rotCW(rotCW(FOOT)))];
function prints(ox,oy,dir){
  const P=[[[9,6],[28,26]],[[6,10],[26,28]],[[28,6],[9,26]],[[26,10],[6,28]]][dir];
  cx.fillStyle='rgba(190,148,70,.8)';
  P.forEach(([px,py])=>FOOTD[dir].forEach((r,j)=>[...r].forEach((c,i)=>{if(c==='X')cx.fillRect(ox+px+i,oy+py+j,1,1)})));
}
/* ---------- typing text ---------- */
let tok=0,figTimer=null;
function type(el,text){
  const id=++tok;let i=0;const parts=[];
  text.split(/(\{[gko]:[^}]*\})/).forEach(t=>{const m=t.match(/^\{([gko]):(.*)\}$/);if(m)[...m[2]].forEach(c=>parts.push([c,m[1]]));else [...t].forEach(c=>parts.push([c,'']))});
  el.textContent='';el.classList.add('typing');
  (function step(){if(id!==tok)return;i++;let h='',cur=null;
    parts.slice(0,i).forEach(([c,k])=>{if(k!==cur){if(cur)h+='</span>';if(k)h+='<span class="'+k+'">';cur=k}h+=c});if(cur)h+='</span>';
    el.innerHTML=h;
    if(i<parts.length)setTimeout(step,38);else el.classList.remove('typing')})();
}
/* ---------- 단계 지도: 벽 칸은 바다·야자수·바위, 길 칸은 모래, 도착 칸은 깃발 ---------- */
let MAP=null,BG=null,BGID=null;
const WALL=['w','p','r'];
function stageMap(st){
  return st.grid.map((row,y)=>row.map((v,x)=>{
    if(v===2)return'G';if(v===1)return'.';
    const h=rnd(x,y,st.id*31+7);return h<.42?'w':h<.74?'p':'r'}).join(''));
}
const terr=(x,y)=>{const c=MAP[y]&&MAP[y][x];return!c?'out':(c==='w'||c==='r')?'water':c==='p'?'grass':'sand'};
function buildBG(id){
  BG=mkC(240,240);D=BG.getContext('2d');
  MAP.forEach((row,gy)=>[...row].forEach((c,gx)=>{
    const ox=gx*T,oy=gy*T,me=terr(gx,gy);
    if(me==='water')water(ox,oy,gx,gy);else if(me==='grass'){grass(ox,oy,gx,gy);
      if(c==='p')[[22,40],[18,41],[12,42]].forEach(([w,y])=>R(ox+23-w/2,oy+y,w,1,'#7bc27a'))}
    else sand(ox,oy,gx,gy);
    DIRV.forEach((v,s)=>{const nb=terr(gx+v[0],gy+v[1]);
      if(me==='water'&&(nb==='sand'||nb==='grass'))foam(ox,oy,s);
      if(me==='grass'&&(nb==='sand'||nb==='water'))grassRim(ox,oy,s)});
    if(c==='p')D.drawImage(PALM[(gx+gy)%2],ox,oy);
    if(c==='r'){
      [[20,29,14,10],[37,35,7,5],[9,38,4,3]].forEach(([ex,ey,rx,ry])=>{for(let a=0;a<64;a++){const t=a/64*Math.PI*2;R(ox+Math.round(ex+1+Math.cos(t)*(rx+3)),oy+Math.round(ey+1+Math.sin(t)*(ry+2.2)),1,1,'#cdeffc')}});
      D.drawImage(ROCK,ox,oy);
    }
    if(c==='G'){sand(ox,oy,gx,gy);D.drawImage(MOUND,ox,oy)}
    /* 장식: 바다에 불가사리, 모래 구석에 조개 (캐릭터 발밑은 비운다) */
    if(c==='w'&&rnd(gx,gy,id+92)<.35)D.drawImage(STARC,ox+30,oy+30);
    if(c==='.'&&rnd(gx,gy,id+90)<.3)D.drawImage(SHELLC,ox+(rnd(gx,gy,id+91)<.5?3:37),oy+3);
  }));
  D=cx;
}
function flag(g,now,wave){
  /* 깃발은 칸 위로 솟게 그린다. 맨 윗줄 칸이면 지도 밖으로 잘리므로 칸 안으로 내린다 */
  const fx=g.x*T,fy=g.y*T+(g.y===0?17:0),wv=wave&&now-wave<1800;
  R(fx+40,fy-15,4,31,INK);R(fx+41,fy-14,2,29,'#a8703f');R(fx+42,fy-14,1,29,'#7d5232');
  R(fx+39,fy-18,6,4,INK);R(fx+40,fy-17,4,2,'#ffe27a');R(fx+40,fy-17,1,1,'#fff8d0');
  const c=wv?CLOTHW[Math.floor(now/110)%3]:CLOTH[Math.floor(now/420)%2];
  D.drawImage(c,fx+41-c.width+1,fy-15+(wv&&Math.floor(now/220)%2?-1:0));
}
const STARBIG=pic(up(STAR,2),IC.star[1]);
const WALKF=['step','stand','stepM','stand'];

/* s = { view:{x,y,angle}, player:{x,y,dir}, showSteps, predictMark, wave, guess } — 칸 좌표, 각도는 앱이 보간한다 */
function drawMaze(canvas,st,s){
  if(!cx){cx=canvas.getContext('2d');cx.imageSmoothingEnabled=false;D=cx}
  if(BGID!==st.id){MAP=stageMap(st);buildBG(st.id);BGID=st.id}
  const now=performance.now(),v=s.view,p=s.player;
  cx.clearRect(0,0,240,240);cx.drawImage(BG,0,0);
  if(st.goal)flag(st.goal,now,s.wave);
  const ox=Math.round(v.x*T),oy=Math.round(v.y*T);
  const moving=Math.abs(p.x-v.x)+Math.abs(p.y-v.y)>.04;
  const turning=Math.abs(((p.dir*90-v.angle)%360+540)%360-180)>6;
  /* 바라보는 쪽 다음 칸에 발자국: 지금 '앞으로'를 하면 갈 곳 */
  if(s.showSteps&&!moving&&!turning){const nx=p.x+DIRV[p.dir][0],ny=p.y+DIRV[p.dir][1];if(MAP[ny]&&WALK(MAP[ny][nx]))prints(nx*T,ny*T,p.dir)}
  /* 예측하기: 도착한 칸에 노란 자리 표시 */
  const pm=s.predictMark;
  if(pm){cx.fillStyle='rgba(255,226,122,.75)';const mx=pm.x*T,my=pm.y*T;
    cx.fillRect(mx+10,my+40,28,1);cx.fillRect(mx+7,my+41,34,6);cx.fillRect(mx+10,my+47,28,1)}
  /* ground shadow: fixed ellipse, does not hop or spin */
  cx.fillStyle='rgba(70,45,25,.26)';
  cx.fillRect(ox+15,oy+43,18,1);cx.fillRect(ox+13,oy+44,22,3);cx.fillRect(ox+15,oy+47,18,1);
  const yaw=((Math.round((180-v.angle)/45)*45)%360+360)%360,set=SPR[yaw]||SPR[180];
  let frame='stand',hop=0;
  if(moving&&set.step){const b=Math.floor(now/180)%4;frame=WALKF[b];hop=b%2}
  else if(turning)hop=2;
  const img=set[frame]||set.stand;
  cx.drawImage(img,ox+24-(img.width>>1),oy+2-hop);
  /* 예측하기: 아이가 누른 칸 (맞으면 초록, 아니면 주황 테두리) */
  const gs=s.guess;
  if(gs){const c=gs.ok?'#4fae5a':'#f39a42',gx=gs.x*T,gy=gs.y*T;R(gx+1,gy+1,T-2,2,c);R(gx+1,gy+T-3,T-2,2,c);R(gx+1,gy+1,2,T-2,c);R(gx+T-3,gy+1,2,T-2,c)}
  if(pm)cx.drawImage(STARBIG,pm.x*T+T-STARBIG.width,pm.y*T+(Math.floor(now/450)%2));
}

/* ---------- 앱에 내놓는 것 ---------- */
const POSE_OF={neutral:'neutral',forward:'앞으로',right:'오른쪽',left:'왼쪽',delete_one:'하나 지우기',delete_all:'모두 지우기',run:'실행'};   /* 그림 이름(내부용). 화면 글자는 앱의 SHORT·LABEL */
const figOf=(t,o={})=>fig(POSE_OF[t]||'neutral',String(t).startsWith('delete')?'#f39a42':'#3d8fe0',o);
const BLK_IC={forward:'arrow',right:'turn',left:'turnL'};
const plain=t=>t.replace(/\{[gko]:([^}]*)\}/g,'$1');
function fillIcons(){$$('[data-ic]').forEach(e=>e.innerHTML=ICONS[e.dataset.ic](+e.dataset.n||2))}
function deco(){[['#decoL','star'],['#decoL2','shell'],['#decoR','shell'],['#decoR2','star']].forEach(([id,ic])=>{const e=$(id);if(e)e.innerHTML=ICONS[ic](5)})}

window.BCM_B2={layout,ICONS,figOf,blockIcon:t=>ICONS[BLK_IC[t]](2),crtPower,drawMaze,type,plain,fillIcons,deco};
})();
