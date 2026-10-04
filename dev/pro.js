"use strict";
const {mkHarness}=require("./harness.js");
const h=mkHarness("index.html");
const RL=h.RL;
const RUNS=parseInt(process.argv[2]||"12",10);
const stats=[];
function best(list,score){let b=null,bs=0;for(const it of list){const s=score(it);if(s>bs){bs=s;b=it}}return b}
function eqUpgrade(){
  const p=RL.G.player;
  for(const it of p.inv.slice()){
    if(it.kind==="weapon"){
      const cur=p.eq.weapon;
      const t=RL.IT[it.kind+":"+it.id],c=cur?RL.IT[cur.kind+":"+cur.id]:null;
      const nd=avg(t.dmg)+(it.plus||0)*1.5+(it.brand?3:0),cd=c?avg(c.dmg)+((cur.plus||0)*1.5)+(cur.brand?3:0):0;
      if(nd>cd+1){RL.equipItem(it)}
    }else if(it.kind==="armor"){
      const cur=p.eq.armor;
      const t=RL.IT[it.kind+":"+it.id],c=cur?RL.IT[cur.kind+":"+cur.id]:null;
      const nd=t.dr+(it.plus||0),cd=c?c.dr+(cur.plus||0):0;
      if(nd>cd+0.5&&!cur||(!cur)||nd>cd+0.5){if(!cur||(cur.cursed&&false)||!cur.cursed)RL.equipItem(it)}
    }else if(it.kind==="ring"||it.kind==="amulet"){
      if(!p.eq.ring1||!p.eq.ring2||!p.eq.amulet){RL.equipItem(it)}
    }
  }
}
function avg(d){const m=/(\d+)d(\d+)/.exec(d);return m?+m[1]*(+m[2]+1)/2:3}
function drinkHeal(){
  const p=RL.G.player;
  let bestIt=null,bv=0;
  for(const it of p.inv){
    if(it.kind!=="potion")continue;
    const t=RL.IT[it.kind+":"+it.id];
    if(t.eff==="heal"&&RL.itKnown(it)&&t.pow>bv){bv=t.pow;bestIt=it}
  }
  if(bestIt){RL.useItem(bestIt);RL.G.target=null;RL.G.mode="play";RL.endTurn();return true}
  for(const it of p.inv){
    if(it.kind==="potion"&&!RL.itKnown(it)){RL.useItem(it);RL.G.target=null;RL.G.mode="play";RL.endTurn();return true}
  }
  return false;
}
function zapTough(mon){
  const p=RL.G.player;
  for(const it of p.inv){
    if(it.kind==="wand"&&it.chg>0&&RL.itKnown(it)){
      const t=RL.IT[it.kind+":"+it.id];
      if(t.eff==="zap_fire"||t.eff==="zap_bolt"||t.eff==="zap_death"||t.eff==="zap_frost"){
        RL.useItem(it);
        if(RL.G.target){RL.G.target.x=mon.x;RL.G.target.y=mon.y;RL.G.target.thr=0;RL.resolveUse(it,mon.x,mon.y);RL.G.target=null;RL.G.mode="play";RL.endTurn();return true}
      }
    }
  }
  return false;
}
for(let run=0;run<RUNS;run++){
  const seed=90000+run*7717;
  RL.setSeed(seed);
  RL.startRun(["warrior","rogue","mage","ranger"][run%4],seed);
  const G=RL.G;
  let turns=0,stuck=0;
  while(G.player.alive&&G.mode!=="win"&&turns++<40000){
    const p=G.player,L=G.level;
    if(G.mode==="perk"){h.key(String(1+Math.floor(Math.random()*3)));continue}
    if(G.mode!=="play"){h.key("Escape");continue}
    if(p.hp<p.maxhp*0.42){
      if(drinkHeal())continue;
    }
    eqUpgrade();
    if(p.hunger<430){
      let fed=false;
      for(const it of p.inv){if(it.kind==="food"){RL.useItem(it);if(RL.G.target)RL.G.target=null;RL.G.mode="play";RL.endTurn();fed=true;break}}
      if(fed)continue;
    }
    const adj=RL.entAt(L,p.x+1,p.y)||RL.entAt(L,p.x-1,p.y)||RL.entAt(L,p.x,p.y+1)||RL.entAt(L,p.x,p.y-1);
    const it=RL.itemAt(L,p.x,p.y);
    if(it&&it.shop&&p.gold>=it.price*0.9){RL.pickup();continue}
    if(it&&!it.shop){RL.pickup();continue}
    const mon=RL.visibleMonster();
    if(mon&&!adj&&p.hp>p.maxhp*0.6&&Math.random()<0.15){if(zapTough(mon))continue}
    if(adj){
      if(p.hp<p.maxhp*0.2&&Math.random()<0.2&&drinkHeal())continue;
      RL.attack(p,adj,{});RL.endTurn();continue;
    }
    if(p.hp<p.maxhp*0.75&&!mon){RL.endTurn();continue}
    if(RL.tAt(L,p.x,p.y)===RL.T.DOWN&&(p.hp>p.maxhp*0.6||!RL.nearestUnseen(L,p.x,p.y))){
      G.player.x=L.down.x;G.player.y=L.down.y;
      RL.descend();
      if(G.mode==="win")break;
      continue;
    }
    const target=RL.nearestUnseen(L,p.x,p.y);
    if(target){
      const st=RL.nextStepTo(L,p.x,p.y,target.x,target.y);
      if(st){
        const m=RL.entAt(L,st.x,st.y);
        if(m){RL.attack(p,m,{});RL.endTurn();continue}
        const c=RL.movePlayer(st.x-p.x,st.y-p.y);
        if(c>0)RL.endTurn();else if(c===0){if(RL.searchAround())RL.endTurn();else stuck++}
        continue;
      }
    }
    const down=L.down;
    const st2=RL.nextStepTo(L,p.x,p.y,down.x,down.y);
    if(st2){const c=RL.movePlayer(st2.x-p.x,st2.y-p.y);if(c>0)RL.endTurn();else stuck++;continue}
    RL.endTurn();
  }
  console.log("  liveG="+(RL.G===G)+" liveMode="+(RL.G&&RL.G.mode)+" staleMode="+G.mode+" hp="+G.player.hp+"/"+G.player.maxhp+" alive="+G.player.alive);
  console.log("  msgs: "+G.msgs.slice(-6).map(m=>m.t).join(" | "));
  console.log("  DBG mode="+G.mode+" alive="+G.player.alive+" loopTurns="+turns+" hp="+G.player.hp+"/"+G.player.maxhp+" cause="+G.deathCause+" msgs="+G.msgs.slice(-3).map(m=>m.t).join("|"));
  stats.push({run,cls:G.player.cls,depth:G.depth,lvl:G.player.lvl,kills:G.player.kills,turns:G.stats.turns,win:G.mode==="win",alive:G.player.alive,seed,stuck});
  console.log("run "+run+" cls="+G.player.cls+" depth="+G.depth+" lvl="+G.player.lvl+" kills="+G.player.kills+" turns="+G.stats.turns+(G.mode==="win"?"  WON":"  died:"+(G.deathCause||"-")));
}
const depths=stats.map(s=>s.depth);
console.log("depths:",depths.join(","));
console.log("avg depth",(depths.reduce((a,b)=>a+b,0)/depths.length).toFixed(2),"max",Math.max(...depths),"wins",stats.filter(s=>s.win).length);
