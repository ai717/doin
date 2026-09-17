// filepath: games/water-sort/js/main.mjs
import { createGame, dispatch, advanceFrame } from "./game.mjs?v=35ad794d8cf9";
import { generateLevel, dailySeed, hashSeed } from "./engine.mjs?v=35ad794d8cf9";
import { createRenderer } from "./render.mjs?v=35ad794d8cf9";
import { createUI } from "./ui.mjs?v=35ad794d8cf9";
import { createAudio } from "./audio.mjs?v=35ad794d8cf9";
import { detectLocale, saveLocale } from "./i18n.mjs?v=35ad794d8cf9";
import * as storage from "./storage.mjs?v=35ad794d8cf9";
import { scoreFor, formatTime } from "./score.mjs?v=35ad794d8cf9";

const audio=createAudio(), renderer=createRenderer(document.getElementById("tube-grid")), ui=createUI();let locale=detectLocale();ui.setLocale(locale);let data=storage.load();let currentLevel=1;let mode="level";let game=createGame({mode,seed:hashSeed("water-sort:1"),run:{level:1}});let clock=0;
function today(){return new Date().toISOString().slice(0,10)}
function begin(level=currentLevel,nextMode=mode){if(nextMode==="level"&&!storage.isLevelUnlocked(data,level))return false;currentLevel=level;mode=nextMode;const run=nextMode==="daily"?{level:35,dailyDate:today(),...generateLevel(35,dailySeed(today()))}:{level};game=createGame({mode:nextMode,seed:run.seed??hashSeed(`water-sort:${level}`),run});ui.close("result");ui.close("levels");clock=0;renderer.draw(game.state);ui.update(game.state,mode==="daily"?data.daily.bestScore:(data.levels[String(level)]?.bestScore||0));}
function sync(event=null){const best=mode==="daily"?data.daily.bestScore:(data.levels[String(currentLevel)]?.bestScore||0);ui.update(game.state,best);renderer.draw(game.state,event);}
function saveResult(){const s=game.state;const result=storage.record(data,{level:currentLevel,score:scoreFor(s),moves:s.moves,mode,date:today()});data=storage.save(result.data);ui.showResult(s,result.isNewBest);}
function act(intent){audio.unlock();const result=dispatch(game,intent,{now:Date.now()});if(result.event?.type==="select")audio.select();if(result.event?.type==="pour"){audio.pour();if(result.event.won){audio.win();saveResult();}}if(result.event?.type==="undo")audio.undo();if(result.event?.type==="invalid")audio.click();sync(result.event);}
function chooseTube(index){if(game.state.status==="won")return;act({type:"select",index});}
ui.refs.grid.addEventListener("click",e=>{const tube=e.target.closest(".tube");if(tube)chooseTube(Number(tube.dataset.index));});ui.refs.grid.addEventListener("contextmenu",e=>{if(e.target.closest(".tube")){e.preventDefault();act({type:"undo"});}});
document.getElementById("undo-btn").addEventListener("click",()=>act({type:"undo"}));document.getElementById("restart-btn").addEventListener("click",()=>begin(currentLevel,mode));document.getElementById("hint-btn").addEventListener("click",()=>act({type:"hint"}));document.getElementById("help-btn").addEventListener("click",()=>ui.open("help"));document.getElementById("levels-btn").addEventListener("click",()=>{ui.renderLevels(currentLevel,(n)=>begin(n,"level"),storage.highestUnlocked(data));ui.open("levels")});document.getElementById("daily-btn").addEventListener("click",()=>begin(35,"daily"));document.getElementById("next-btn").addEventListener("click",()=>begin(Math.min(50,currentLevel+1),"level"));document.getElementById("result-restart").addEventListener("click",()=>begin(currentLevel,mode));document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>ui.close(b.dataset.close)));document.getElementById("sound-btn").addEventListener("click",()=>{const muted=!audio.isMuted();audio.setMuted(muted);data=storage.setSound(!muted);document.getElementById("sound-btn").textContent=muted?"◗":"◖"});document.getElementById("lang-btn").addEventListener("click",()=>{locale=locale==="zh"?"en":"zh";saveLocale(locale);ui.setLocale(locale);sync()});
window.addEventListener("keydown",e=>{if(e.code==="KeyZ"){e.preventDefault();act({type:"undo"});return}if(e.code==="Escape"){ui.close("help");ui.close("levels");ui.close("result");return}if(e.code==="KeyH"){act({type:"hint"});return}let index=game.state.focus??0;if(e.code==="ArrowLeft"||e.code==="ArrowRight"){e.preventDefault();index=(index+(e.code==="ArrowRight"?1:-1)+game.state.tubes.length)%game.state.tubes.length;act({type:"focus",index});return}if(e.code==="Enter"){e.preventDefault();act({type:"select",index});}});
function frame(now){if(game.state.status==="playing"){const result=advanceFrame(game,{now:Date.now()});if(result.state.elapsedMs!==clock){clock=result.state.elapsedMs;ui.update(game.state,mode==="daily"?data.daily.bestScore:(data.levels[String(currentLevel)]?.bestScore||0));}}requestAnimationFrame(frame)}
begin(1,"level");requestAnimationFrame(frame);
if(new URLSearchParams(location.search).has("e2e")){window.__waterSort={get state(){return game.state},act,begin,solve:()=>game.state}};


