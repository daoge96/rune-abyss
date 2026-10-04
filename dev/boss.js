"use strict";
const {mkHarness}=require("./harness.js");
const h=mkHarness("index.html");
const RL=h.RL;
function fight(tag,setup){
  RL.setSeed(4242);
  RL.startRun("warrior",4242);
  RL.enterLevel(15);
  const G=RL.G,p=G.player;
  const L=G.level;
  L.ents=L.ents.filter(e=>e.k!=="boss");
  const spot=RL.freeFloor(L,3);
  p.x=spot.x;p.y=spot.y;
  setup(p,G);
  const boss=RL.mkMon("boss",p.x+1,p.y);
  if(!RL.walkAt(L,boss.x,boss.y)){boss.x=p.x;boss.y=p.y+1}
  L.ents.push(boss);
  boss.aware=1;
  let turns=0;
  while(p.alive&&boss.alive&&turns++<600){
    const d=Math.abs(boss.x-p.x)+Math.abs(boss.y-p.y);
    if(p.hp<p.maxhp*0.5){
      const heal=p.inv.find(x=>x.kind==="potion");
      if(heal){RL.useItem(heal);RL.G.target=null;RL.G.mode="play";RL.endTurn();continue}
    }
    if(d<=1){RL.attack(p,boss,{});RL.endTurn();continue}
    const st=RL.nextStepTo(L,p.x,p.y,boss.x,boss.y);
    if(st){RL.movePlayer(st.x-p.x,st.y-p.y);RL.endTurn();continue}
    RL.endTurn();
  }
  console.log(tag+": player "+(p.alive?"SURVIVED hp="+p.hp+"/"+p.maxhp:"died")+" boss "+(boss.alive?"alive hp="+boss.hp:"dead")+" turns="+turns);
  return {alive:p.alive,bossDead:!boss.alive};
}
const strong={};
strong.a=fight("geared lvl14 greatsword+3 plate 20 pots",(p,G)=>{
  p.lvl=14;p.next=99999;p.maxhp=120;p.hp=120;p.str=16;p.dex=12;p.con=14;
  const w=RL.mkItem("weapon","greatsword");w.plus=3;
  const a=RL.mkItem("armor","plate");a.plus=2;
  p.eq.weapon=w;p.eq.armor=a;
  for(let i=0;i<20;i++)RL.addToInv(RL.mkItem("potion","healbig"));
});
strong.b=fight("medium lvl10 longsword+1 chain 6 pots",(p,G)=>{
  p.lvl=10;p.next=99999;p.maxhp=85;p.hp=85;p.str=13;p.dex=10;p.con=11;
  const w=RL.mkItem("weapon","longsword");w.plus=1;
  const a=RL.mkItem("armor","chain");
  p.eq.weapon=w;p.eq.armor=a;
  for(let i=0;i<6;i++)RL.addToInv(RL.mkItem("potion","heal"));
});
strong.c=fight("weak lvl8 shortsword leather 3 pots",(p,G)=>{
  p.lvl=8;p.next=99999;p.maxhp=70;p.hp=70;p.str=11;p.dex=9;p.con=10;
  p.eq.weapon=RL.mkItem("weapon","shortsword");
  p.eq.armor=RL.mkItem("armor","leather");
  for(let i=0;i<3;i++)RL.addToInv(RL.mkItem("potion","heal"));
});
console.log(JSON.stringify(strong));
