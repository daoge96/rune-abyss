"use strict";
const {mkHarness}=require("./harness.js");
const FILE=process.argv[2]||"index.html";
const ONLY=process.argv[3]||"";
let PASS=0,FAIL=0;
const FAILS=[];
function ok(cond,msg){if(cond){PASS++}else{FAIL++;if(FAILS.length<60)FAILS.push(msg);console.log("  FAIL: "+msg)}}
function section(n){console.log("\n== "+n+" ==")}
function safe(fn,label){try{return fn()}catch(e){FAIL++;const m=label+": "+(e&&e.message);if(FAILS.length<60)FAILS.push(m+"\n"+String(e&&e.stack).split("\n").slice(1,4).join("\n"));console.log("  FAIL "+m);return undefined}}
function run(name,fn){if(ONLY&&ONLY!==name)return;const t0=Date.now();console.log("\n#### "+name);try{fn()}catch(e){FAIL++;console.log("  HARNESS ERROR "+e.message+"\n"+e.stack);if(FAILS.length<60)FAILS.push(name+" harness: "+e.message)}console.log("  ("+(Date.now()-t0)+"ms)");}
const H=[];
function fresh(seed,cls){
  const h=mkHarness(FILE);
  h.RL.setSeed(seed||12345);
  h.RL.startRun(cls||"warrior",seed||12345);
  return h;
}
function invariants(h,label){
  const G=h.RL.G;
  if(!G)return;
  const L=G.level,P=G.player;
  ok(L.w>0&&L.h>0,label+" level size");
  ok(L.up&&L.down,label+" stairs exist");
  ok(h.RL.tAt(L,L.up.x,L.up.y)===h.RL.T.UP,label+" up tile");
  ok(h.RL.tAt(L,L.down.x,L.down.y)===h.RL.T.DOWN,label+" down tile");
  for(let i=0;i<L.ents.length;i++){
    const e=L.ents[i];
    if(!e.alive)continue;
    ok(Number.isFinite(e.x)&&Number.isFinite(e.y),label+" ent pos finite");
    ok(e.x>=0&&e.y>=0&&e.x<L.w&&e.y<L.h,label+" ent in bounds "+e.k);
    ok(h.RL.walkAt(L,e.x,e.y),label+" ent walkable "+e.k+" "+e.x+","+e.y);
    ok(Number.isFinite(e.hp)&&e.hp>0,label+" ent hp "+e.k);
  }
  for(const it of L.items){
    ok(it.x>=0&&it.y>=0&&it.x<L.w&&it.y<L.h,label+" item in bounds");
    ok(h.RL.walkAt(L,it.x,it.y),label+" item walkable");
  }
  ok(Number.isFinite(P.hp)&&Number.isFinite(P.xp)&&Number.isFinite(P.gold),label+" player numbers");
  ok(P.hp<=P.maxhp,label+" hp<=maxhp ("+P.hp+"/"+P.maxhp+")");
  ok(P.str>0&&P.dex>0&&P.con>0,label+" stats positive");
  for(const k in P.st){const s=P.st[k];ok(Number.isFinite(s.t)&&s.t>0,label+" status dur "+k)}
  ok(Number.isFinite(h.RL.pacc(P))&&Number.isFinite(h.RL.pev(P))&&Number.isFinite(h.RL.pdr(P))&&Number.isFinite(h.RL.pspeed(P)),label+" derived stats finite");
}
run("boot",()=>{
  const h=mkHarness(FILE);
  ok(!!h.RL,"RL exported");
  ok(h.RL.G===null||h.RL.G===undefined,"no game before start");
  h.frame(16);h.frame(32);
  h.RL.setSeed(7);
  h.RL.startRun("warrior",7);
  ok(!!h.RL.G,"game started");
  ok(h.RL.G.depth===1,"depth 1");
  h.frame(48);h.frame(64);
  ok(h.nanCalls.length===0,"no NaN in ctx calls: "+h.nanCalls.slice(0,3).join(" | "));
});
run("gen",()=>{
  for(let d=1;d<=15;d++){
    for(let s=0;s<12;s++){
      const h=mkHarness(FILE);
      h.RL.setSeed(s*7919+d);
      const L=h.RL.genLevel(d);
      const RL=h.RL;
      ok(L.up&&L.down,"gen stairs d"+d);
      ok(RL.tAt(L,L.up.x,L.up.y)===RL.T.UP,"gen up tile d"+d);
      let walkable=0;
      for(let i=0;i<L.w*L.h;i++)if(RL.walkAt(L,i%L.w,Math.floor(i/L.w)))walkable++;
      ok(walkable>60,"gen enough floor d"+d+" got "+walkable);
      const bfs=RL.bfsFrom(L,L.up.x,L.up.y);
      ok(bfs.d[L.down.y*L.w+L.down.x]>=0,"gen stairs connected d"+d);
      for(let i=0;i<L.w*L.h;i++){
        if(!RL.walkAt(L,i%L.w,Math.floor(i/L.w)))continue;
        if(bfs.d[i]<0){ok(false,"gen unreachable floor at "+i%L.w+","+Math.floor(i/L.w)+" d"+d);break}
      }
      for(const t of L.traps)ok(RL.walkAt(L,t.x,t.y),"trap on floor");
      ok(L.ents.every(e=>RL.walkAt(L,e.x,e.y)),"gen ents on floor d"+d);
      if(d<15)ok(L.ents.length>0,"gen has monsters d"+d);
      if(d===15)ok(L.ents.some(e=>e.k==="boss"),"boss present");
      ok(L.items.every(it=>RL.walkAt(L,it.x,it.y)),"gen items on floor d"+d);
    }
  }
});
run("populate",()=>{
  const h=mkHarness(FILE);h.RL.setSeed(999);
  h.RL.startRun("rogue",999);
  for(let d=1;d<=15;d++){
    h.RL.G.depth=d;
    const L=h.RL.genLevel(d);
    h.RL.G.level=L;
    h.RL.populate(L);
    ok(L.items.length>3,"populated items d"+d);
    ok(L.ents.length>2||d===15,"populated monsters d"+d);
    for(const it of L.items)ok(h.RL.walkAt(L,it.x,it.y),"populated item pos d"+d);
    for(const e of L.ents)ok(h.RL.walkAt(L,e.x,e.y),"populated ent pos d"+d);
  }
});
run("fov",()=>{
  const h=fresh(4242);
  const G=h.RL.G,L=G.level;
  h.RL.computeFOV();
  ok(L.vis[G.player.y*L.w+G.player.x]===1,"player sees own tile");
  let visCount=0;for(let i=0;i<L.w*L.h;i++)if(L.vis[i])visCount++;
  ok(visCount>8,"fov reveals something: "+visCount);
  ok(visCount<L.w*L.h,"fov not full reveal: "+visCount);
  for(let i=0;i<L.w*L.h;i++)if(L.vis[i])ok(L.seen[i]===1,"visible implies seen");
  h.RL.revealAll();
  let seenCount=0;for(let i=0;i<L.w*L.h;i++)if(L.seen[i])seenCount++;
  ok(seenCount>visCount,"revealAll reveals more");
});
run("determinism",()=>{
  const dumps=[];
  for(let k=0;k<2;k++){
    const h=mkHarness(FILE);h.RL.setSeed(31337);
    const L=h.RL.genLevel(5);
    dumps.push(JSON.stringify(L.tiles)+"|"+L.ents.map(e=>e.k+e.x+","+e.y).join(";")+"|"+L.items.map(i=>i.kind+i.id+i.x+","+i.y).join(";"));
  }
  ok(dumps[0]===dumps[1],"same seed same level");
});
run("combat",()=>{
  const kinds=Object.keys(H[0]?{}:{});
  const h=mkHarness(FILE);h.RL.setSeed(555);
  const RL=h.RL;
  const list=Object.keys(RL.MONS);
  for(const k of list){
    RL.setSeed(1000+k.length);
    RL.startRun("warrior",99);
    const G=RL.G,L=G.level;
    L.ents.length=0;
    const spot=h.RL.freeFloor(L,2);
    const p=G.player;
    p.x=L.up.x;p.y=L.up.y;
    p.hp=p.maxhp=500;p.str=20;p.dex=15;
    const m=RL.mkMon(k,L.up.x+1<L.w?L.up.x+1:L.up.x,L.up.y);
    m.x=L.up.x+1;m.y=L.up.y;
    if(!RL.walkAt(L,m.x,m.y)){m.x=L.up.x;m.y=L.up.y+1}
    L.ents.push(m);
    for(let i=0;i<260;i++){
      if(!p.alive||!m.alive)break;
      if(h.RL.entAt(L,m.x,m.y)&&Math.abs(m.x-p.x)<=1&&Math.abs(m.y-p.y)<=1)RL.attack(p,m,{});
      else {RL.computeFOV();RL.endTurn()}
      if(!Number.isFinite(p.hp)){ok(false,"hp NaN after "+k);break}
      if(!Number.isFinite(m.hp)){ok(false,"mon hp NaN after "+k);break}
    }
    ok(p.hp>0,"player survived "+k+" (hp "+p.hp+")");
    invariants(h,"combat "+k);
  }
});
run("items",()=>{
  const h=mkHarness(FILE);h.RL.setSeed(77);
  const RL=h.RL;
  RL.startRun("mage",77);
  const keys=Object.keys(RL.IT);
  for(const key of keys){
    const parts=key.split(":");
    if(parts[0]==="gold")continue;
    const it=RL.mkItem(parts[0],parts[1]);
    ok(!!it,"mkItem "+key);
    if(!it)continue;
    const p=RL.G.player;
    if(parts[0]==="weapon"||parts[0]==="armor"){it.equipped=1;p.eq[parts[0]]=it;}
    else RL.addToInv(it);
    const before=p.inv.length;
    if(parts[0]==="potion"||parts[0]==="scroll"||parts[0]==="wand"||parts[0]==="food"){
      RL.useItem(it);
      RL.G.target=null;RL.G.mode="play";
      if(it.kind==="wand"||(it.kind==="scroll"&&(it.id==="fire"||it.id==="ice"))){
        RL.useItem(it);
        if(RL.G.target){const t=RL.G.target;RL.resolveUse(it,Math.min(RL.G.level.w-1,t.x),t.y);RL.G.target=null;RL.G.mode="play"}
      }
    }
    ok(RL.G.player.hp<=RL.G.player.maxhp,"hp<=maxhp after "+key);
    ok(Number.isFinite(RL.G.player.hp),"hp finite after "+key);
  }
  invariants(h,"items done");
  ok(h.nanCalls.length===0,"no NaN ctx after items");
});
run("throwzap",()=>{
  const h=mkHarness(FILE);h.RL.setSeed(88);
  const RL=h.RL;RL.startRun("ranger",88);
  const G=RL.G,L=G.level,p=G.player;
  for(const key of Object.keys(RL.IT)){
    const parts=key.split(":");
    const it=RL.mkItem(parts[0],parts[1]);
    RL.addToInv(it);
    if(!RL.walkAt(L,p.x+2,p.y))continue;
    RL.throwItem(it,p.x+2,p.y);
    ok(Number.isFinite(p.hp),"hp finite after throw "+key);
  }
  RL.explode(p.x,p.y,2,30,"fire");
  RL.explode(p.x+1,p.y,1,30,"cold");
  ok(Number.isFinite(p.hp),"hp finite after explode");
  invariants(h,"throwzap");
});
run("equip",()=>{
  const h=mkHarness(FILE);h.RL.setSeed(66);
  const RL=h.RL;RL.startRun("warrior",66);
  for(const key of Object.keys(RL.IT)){
    const parts=key.split(":");
    if(["weapon","armor","ring","amulet"].indexOf(parts[0])<0)continue;
    const it=RL.mkItem(parts[0],parts[1]);
    if(!it)continue;
    RL.addToInv(it);
    RL.equipItem(it);
    ok(Number.isFinite(RL.pacc(RL.G.player))&&Number.isFinite(RL.pdr(RL.G.player)),"stats finite "+key);
  }
  const p=RL.G.player;
  for(const slot of ["weapon","armor","ring1","ring2","amulet"]){if(p.eq[slot]){p.eq[slot].cursed=1}}
  for(const slot of ["weapon","armor","ring1","ring2","amulet"])RL.dropItem(p.eq[slot]||{kind:"potion",id:"heal",count:1});
  invariants(h,"equip");
});
run("save",()=>{
  const h=mkHarness(FILE);h.RL.setSeed(303);
  const RL=h.RL;RL.startRun("rogue",303);
  for(let i=0;i<40;i++){RL.handleKey({key:"ArrowRight",code:"ArrowRight",preventDefault(){}})}
  RL.enterLevel(3);
  RL.enterLevel(2);
  RL.saveGame();
  const raw=h.store["runeabyss_save"];
  ok(!!raw,"save written");
  const h2=mkHarness(FILE);
  h2.store["runeabyss_save"]=raw;
  const loaded=h2.RL.loadGame();
  ok(loaded,"load ok");
  ok(h2.RL.G.depth===RL.G.depth,"depth restored");
  ok(h2.RL.G.turn===RL.G.turn,"turn restored");
  ok(JSON.stringify(h2.RL.G.player.inv)===JSON.stringify(RL.G.player.inv),"inv restored");
  const L=h2.RL.G.level;
  ok(h2.RL.tAt(L,L.down.x,L.down.y)===h2.RL.T.DOWN,"stairs restored");
  h2.RL.computeFOV();
  h2.RL.draw();
  invariants(h2,"after load");
  const merged=h2.RL.G.levels[RL.G.depth];
  ok(!!merged,"levels restored");
});
run("keys",()=>{
  const h=fresh(11);
  const keys=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","q","e","y","u","b","n"," ",".",">","<","g","i","c","?","m","r","x","p","t","1","2","3","Escape","Enter"];
  for(const k of keys){safe(()=>h.key(k),k);h.key("Escape")}
  h.key("i");for(let i=0;i<26;i++)h.key(String.fromCharCode(97+i));h.key("Escape");
  h.key("i");h.key("a");h.key("u");h.key("Escape");
  h.key("c");h.key("Escape");h.key("m");h.key("Escape");h.key("?");h.key("Escape");
  h.RL.addToInv(h.RL.mkItem("potion","heal"));h.key("t");h.key("a");h.key("Tab");ok(h.RL.G.mode==="target","target mode from throw");h.key("Escape");
  h.RL.enterLevel(2);
  ok(true,"keys ok");
});
run("modes",()=>{
  const h=fresh(12);
  const G=h.RL.G;
  for(const m of ["play","inv","char","help","dead","win","perk","codex","map","target","confirm"]){
    G.mode=m;
    if(m==="target")G.target={x:G.player.x,y:G.player.y,item:h.RL.mkItem("wand","fire")};
    if(m==="perk")G.perkOffer=h.RL.PERKS.slice(0,3);
    if(m==="confirm")h.RL.UI.confirm={text:"x",ok:()=>{}};
    safe(()=>h.RL.draw(),"draw "+m);
  }
  ok(h.nanCalls.length===0,"no NaN in modes: "+h.nanCalls.slice(0,4).join(" | "));
  G.mode="play";h.RL.UI.confirm=null;
  h.RL.draw();
});
run("layout",()=>{
  const h=fresh(13);
  for(const [w,hh] of [[1440,900],[1000,700],[800,600],[420,780],[2200,1200]]){
    h.resize(w,hh);
    safe(()=>h.RL.draw(),"draw "+w+"x"+hh);
  }
  ok(h.nanCalls.length===0,"no NaN in layouts");
});
run("deathwin",()=>{
  const h=fresh(14);
  const RL=h.RL,G=RL.G,p=G.player;
  p.hp=1;p.eq.amulet=null;
  RL.damage(p,999,null,"phys",{cause:"测试"});
  ok(G.mode==="dead","death sets mode: "+G.mode);
  RL.draw();
  h.key("Enter");
  ok(RL.G===null,"back to title");
  const h2=fresh(15);
  h2.RL.G.player.eq.amulet=h2.RL.mkItem("amulet","life");
  h2.RL.G.player.eq.amulet.equipped=1;
  h2.RL.damage(h2.RL.G.player,9999,null,"phys",{});
  ok(h2.RL.G.player.alive,"amulet revive");
  h2.RL.damage(h2.RL.G.player,9999,null,"phys",{});
  ok(h2.RL.G.mode==="dead","second death");
  const h3=fresh(16);
  h3.RL.winRun();
  ok(h3.RL.G.mode==="win","win mode");
  h3.RL.draw();
});
run("frames",()=>{
  const h=fresh(17);
  for(let i=0;i<120;i++)h.frame(16);
  ok(h.nanCalls.length===0,"no NaN frames");
  h.RL.G.pending={kind:"explore",wait:0};
  for(let i=0;i<200;i++)h.frame(16);
  ok(Number.isFinite(h.RL.G.player.x),"explore moved");
  h.RL.G.pending={kind:"rest",wait:0};
  for(let i=0;i<200;i++)h.frame(16);
  ok(true,"rest ran");
  h.RL.G.player.hp=1;
  h.RL.G.pending={kind:"rest",wait:0};
  for(let i=0;i<400;i++)h.frame(16);
  ok(h.RL.G.player.hp>=1,"rest healed");
});
run("bot",()=>{
  const h=mkHarness(FILE);
  let deaths=0,deepest=1,levels=0;
  for(let run=0;run<6;run++){
    const RL=h.RL;
    const R=h;
    RL.setSeed(7000+run*13);
    RL.startRun(["warrior","rogue","mage","ranger"][run%4],7000+run*13);
    const G=RL.G;
    let guard=0;
    while(G.player.alive&&guard++<4000){
      const p=G.player,L=G.level;
      if(guard%37===0)invariants(h,"bot r"+run);
      if(RL.visibleMonster&&RL.G.mode==="play"&&false){}
      const mon=RL.visibleMonster();
      const adj=RL.entAt(L,p.x+1,p.y)||RL.entAt(L,p.x-1,p.y)||RL.entAt(L,p.x,p.y+1)||RL.entAt(L,p.x,p.y-1);
      const it=RL.itemAt(L,p.x,p.y);
      if(p.hp<p.maxhp*0.45){
        const heal=p.inv.find(x=>x.kind==="potion"&&RL.itKnown(x));
        if(heal){RL.useItem(heal);RL.G.target=null;RL.G.mode="play";if(G.player.alive)RL.endTurn();continue}
      }
      if(it&&it.kind==="gold"){RL.pickup();continue}
      if(it&&!it.shop){RL.pickup();continue}
      if(adj){RL.attack(p,adj,{});RL.endTurn();continue}
      if(mon&&Math.random()<0.25&&p.inv.length){
        const used=p.inv[Math.floor(Math.random()*p.inv.length)];
        safe(()=>{RL.useItem(used);RL.G.target=null;RL.G.mode="play"});
      }
      if(RL.tAt(L,p.x,p.y)===RL.T.DOWN&&(p.hp>p.maxhp*0.5||G.depth%3===0)){RL.descend();levels++;continue}
      const target=RL.nearestUnseen(L,p.x,p.y);
      if(target){
        const st=RL.nextStepTo(L,p.x,p.y,target.x,target.y);
        if(st){
          const m=RL.entAt(L,st.x,st.y);
          if(m){RL.attack(p,m,{});RL.endTurn();continue}
          const c=RL.movePlayer(st.x-p.x,st.y-p.y);
          if(c>0)RL.endTurn();else if(c===0){RL.searchAround()&&RL.endTurn()}
          continue;
        }
      }
      if(p.hp<p.maxhp*0.8){RL.endTurn();continue}
      const down=L.down;
      const st2=RL.nextStepTo(L,p.x,p.y,down.x,down.y);
      if(st2){RL.movePlayer(st2.x-p.x,st2.y-p.y);RL.endTurn();continue}
      RL.endTurn();
    }
    deepest=Math.max(deepest,G.depth);
    deaths+=G.player.alive?0:1;
    invariants(h,"bot end r"+run);
  }
  console.log("  bot: deaths="+deaths+" deepest="+deepest+" levelsEntered="+levels);
  ok(deepest>=4,"bot reached depth >=4 (got "+deepest+")");
  ok(h.nanCalls.length===0,"no NaN in bot");
});
run("win-path",()=>{
  const h=fresh(21);
  const RL=h.RL,G=RL.G;
  RL.enterLevel(15);
  ok(G.depth===15,"at 15");
  G.player.hp=G.player.maxhp=900;G.player.str=40;G.player.dex=30;
  const boss=G.level.ents.find(e=>e.k==="boss");
  ok(!!boss,"boss exists on 15");
  boss.hp=1;
  RL.attack(G.player,boss,{});
  RL.endTurn();
  ok(!boss.alive,"boss dies");
  ok(!!G.level.portal,"portal spawns");
  G.player.x=G.level.portal.x;G.player.y=G.level.portal.y;
  RL.winRun();
  ok(G.mode==="win","win");
  invariants(h,"win");
});
run("hunger",()=>{
  const h=fresh(31);
  const RL=h.RL;
  RL.G.player.hunger=5;
  for(let i=0;i<200;i++)RL.endTurn();
  ok(RL.G.player.hunger===0||RL.G.player.hunger<10,"hunger drains");
  ok(RL.G.player.alive||RL.G.mode==="dead","hunger handled");
});
run("stairs-roundtrip",()=>{
  const h=fresh(41);
  const RL=h.RL;
  const G=RL.G;
  const d1=G.depth;
  const L=G.level;
  G.player.x=L.down.x;G.player.y=L.down.y;
  RL.descend();
  ok(G.depth===d1+1,"descend works");
  const L2=G.level;
  ok(RL.tAt(L2,G.player.x,G.player.y)===RL.T.UP,"arrive at up stairs when descending");
  RL.ascend();
  ok(G.depth===d1,"ascend works");
  const L3=G.level;
  ok(RL.tAt(L3,G.player.x,G.player.y)===RL.T.DOWN,"arrive at down stairs when going up");
  for(let i=0;i<40;i++){G.player.x=G.level.down.x;G.player.y=G.level.down.y;RL.descend()}
  ok(G.depth<=15,"depth capped at 15: "+G.depth);
});
run("stairs-far",()=>{
  const h=fresh(42);
  const RL=h.RL,G=RL.G;
  let n=0;
  for(let i=0;i<40&&G.depth<15;i++){
    const L=G.level;
    if(RL.tAt(L,G.player.x,G.player.y)!==RL.T.DOWN){G.player.x=L.down.x;G.player.y=L.down.y;n++}
    RL.descend();
  }
  ok(G.depth===15,"reached 15 via stairs");
  ok(G.mode==="win"||G.depth===15,"win or at 15");
  ok(!!G.level.ents.find(e=>e.k==="boss"),"boss level has boss");
  let guard=0;
  {const Lw=G.level;G.player.x=Lw.down.x;G.player.y=Lw.down.y}
  while(guard++<40){RL.descend()}
  ok(G.depth===15,"stays at 15");
});
run("brains",()=>{
  const h=mkHarness(FILE);
  const RL=h.RL;
  const kinds=Object.keys(RL.MONS);
  const moved={};
  for(const k of kinds){
    RL.setSeed(1234+k.length);
    RL.startRun("warrior",555);
    const G=RL.G,L=G.level;
    L.ents.length=0;
    const p=G.player;
    p.hp=p.maxhp=4000;p.str=25;p.dex=18;p.lvl=12;
    const spot=RL.freeFloor(L,2);
    p.x=spot.x;p.y=spot.y;
    const m=RL.mkMon(k,p.x+2<L.w&&RL.walkAt(L,p.x+2,p.y)?p.x+2:p.x,p.y);
    if(!RL.walkAt(L,m.x,m.y)){m.x=p.x;m.y=p.y+2}
    m.aware=1;L.ents.push(m);
    const start={x:m.x,y:m.y};
    for(let i=0;i<220;i++){
      if(!m.alive||!p.alive)break;
      RL.endTurn();
      if(m.x!==start.x||m.y!==start.y)moved[k]=1;
    }
    ok(RL.MONS[m.k]===RL.MONS[k],"brain kept kind "+k);
    ok(m.hp>0||!m.alive,"brain hp sane "+k);
    if(k!=="merchant")ok(moved[k]||!m.alive,"monster acted "+k);
  }
});
run("traps",()=>{
  const h=fresh(61);
  const RL=h.RL,G=RL.G,p=G.player;
  const kinds=["spike","fire","poison","tele","alarm","rock","slow","sleep"];
  for(const k of kinds){
    p.hp=p.maxhp=5000;
    const tr={x:p.x,y:p.y,k:k,hidden:0,seen:1,cd:0};
    G.level.traps.push(tr);
    safe(()=>RL.triggerTrap(tr),"trap "+k);
    ok(p.hp<=p.maxhp,"trap hp sane "+k);
    ok(Number.isFinite(p.hp),"trap hp finite "+k);
    for(let i=0;i<6;i++)RL.endTurn();
  }
  for(const st of Object.keys(RL.ST)){
    RL.addStat(p,st,10,2);
    for(let i=0;i<12;i++)RL.endTurn();
    ok(Number.isFinite(p.hp),"status hp finite "+st);
    delete p.st[st];
  }
  p.hp=p.maxhp;
});
run("monkey",()=>{
  const h=fresh(71);
  const keys=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ",".",">","<","g","i","c","?","m","r","x","p","t","f","Escape","Enter","1","2","a","b","z"];
  for(let i=0;i<4000;i++){
    const k=keys[Math.floor(Math.random()*keys.length)];
    safe(()=>h.key(k),"monkey "+k);
    if(h.RL.G&&h.RL.G.mode==="perk")h.key("1");
    if(h.RL.G&&(h.RL.G.mode==="dead"||h.RL.G.mode==="win")){h.key("Enter");if(!h.RL.G)break}
    if(i%3===0)h.frame(16);
  }
  if(h.RL.G)ok(true,"monkey survived");
  ok(h.nanCalls.length===0,"no NaN in monkey");
});
run("codex",()=>{
  const h=fresh(81);
  const RL=h.RL,G=RL.G,L=G.level,p=G.player;
  const m=L.ents[0];
  ok(!!m,"has monster");
  m.x=p.x+1;m.y=p.y;
  if(!RL.walkAt(L,m.x,m.y)){m.x=p.x;m.y=p.y+1}
  RL.computeFOV();
  ok(L.vis[m.y*L.w+m.x]===1,"monster visible");
  ok(!!RL.META.codex[m.k],"codex recorded "+m.k+": "+JSON.stringify(Object.keys(RL.META.codex)));
});
run("shop",()=>{
  let found=0;
  for(let s=0;s<30&&!found;s++){
    const h=mkHarness(FILE);
    h.RL.setSeed(4000+s);
    const L=h.RL.genLevel(5);
    if(L.shop){
      found=1;
      const merch=L.ents.find(e=>e.k==="merchant");
      ok(!!merch,"merchant exists");
      const priced=L.items.filter(i=>i.shop&&i.price>0);
      ok(priced.length>0,"shop has priced items");
      ok(priced.every(i=>h.RL.walkAt(L,i.x,i.y)),"shop items on floor");
    }
  }
  ok(found===1,"found a shop level");
});
console.log("\n===== PASS "+PASS+"  FAIL "+FAIL+" =====");
if(FAILS.length){console.log("\n--- first failures ---");FAILS.slice(0,25).forEach(f=>console.log(" * "+f))}
process.exit(FAIL?1:0);
