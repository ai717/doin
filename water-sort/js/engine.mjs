// filepath: games/water-sort/js/engine.mjs
export const CAPACITY = 4;
export const STATUS = Object.freeze({ ready: "ready", playing: "playing", won: "won" });
export const COLORS = Object.freeze(["red","orange","yellow","green","cyan","blue","violet","pink","brown","slate","lime","indigo"]);
export const COLOR_HEX = Object.freeze({ red:"#e45b57", orange:"#ef9253", yellow:"#edc85b", green:"#74b878", cyan:"#55c6c0", blue:"#5796d1", violet:"#9273c7", pink:"#d985ac", brown:"#a9795c", slate:"#7d92a3", lime:"#a8bf57", indigo:"#6370bd" });

export function mulberry32(seed) { let a = (Number(seed) >>> 0) || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hashSeed(value) { let h = 2166136261; for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function dailySeed(date = new Date()) { const d = typeof date === "string" ? date : date.toISOString().slice(0,10); return hashSeed(`water-sort:${d}`); }
export function cloneTubes(tubes) { return tubes.map((tube) => [...tube]); }
export function topColor(tube) { return tube.length ? tube[tube.length - 1] : null; }
export function topRun(tube) { if (!tube.length) return 0; const color = topColor(tube); let n = 0; for (let i=tube.length-1;i>=0 && tube[i]===color;i--) n++; return n; }
export function isPure(tube) { return tube.length === 0 || (tube.length === CAPACITY && tube.every((c) => c === tube[0])); }
export function isWon(tubes) { return tubes.every(isPure); }
export function legalMove(tubes, from, to) { if (!Array.isArray(tubes) || from === to || !tubes[from] || !tubes[to]) return false; const a=tubes[from], b=tubes[to]; if (!a.length || b.length >= CAPACITY) return false; return !b.length || topColor(a) === topColor(b); }
export function pour(tubes, from, to) { if (!legalMove(tubes, from, to)) return null; const next=cloneTubes(tubes); const amount=Math.min(topRun(next[from]), CAPACITY-next[to].length); const moved=next[from].splice(next[from].length-amount, amount); next[to].push(...moved); return { tubes:next, amount, color:moved[0] }; }
export function legalMoves(tubes) { const moves=[]; for(let from=0;from<tubes.length;from++) for(let to=0;to<tubes.length;to++) if(legalMove(tubes,from,to)) moves.push({from,to}); return moves; }
export function replaySolution(tubes, solution) {
  if (!Array.isArray(solution)) return null;
  let current = cloneTubes(tubes);
  for (const move of solution) {
    if (!Number.isInteger(move?.from) || !Number.isInteger(move?.to)) return null;
    const result = pour(current, move.from, move.to);
    if (!result) return null;
    current = result.tubes;
  }
  return current;
}
export function isValidSolution(tubes, solution) {
  const result = replaySolution(tubes, solution);
  return result !== null && isWon(result);
}

function shuffle(list, rng) { for(let i=list.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[list[i],list[j]]=[list[j],list[i]];} return list; }
function rawRandomLayout(colorCount, emptyCount, rng) { const tokens=[]; for(let c=0;c<colorCount;c++) for(let i=0;i<CAPACITY;i++) tokens.push(COLORS[c]); shuffle(tokens,rng); const tubes=[]; for(let i=0;i<colorCount+emptyCount;i++) tubes.push(tokens.splice(0,CAPACITY)); return tubes; }
function reverseLayout(colorCount, emptyCount, rng, scramble) {
  const tubes=[];
  for(let c=0;c<colorCount;c++) tubes.push(Array(CAPACITY).fill(COLORS[c]));
  for(let i=0;i<emptyCount;i++) tubes.push([]);
  const solution=[];
  const seen=new Set([key(tubes)]);
  let previous=null;
  for(let step=0;step<scramble;step++){
    const choices=[];
    for(let from=0;from<tubes.length;from++){
      const color=topColor(tubes[from]);
      const run=topRun(tubes[from]);
      if(!color || !run) continue;
      for(let to=0;to<tubes.length;to++){
        if(from===to || tubes[to].length>=CAPACITY || topColor(tubes[to])===color) continue;
        const max=Math.min(run,CAPACITY-tubes[to].length);
        const reversibleMax=run===tubes[from].length?max:Math.min(max,run-1);
        for(let amount=1;amount<=reversibleMax;amount++){
          if(previous && previous.from===to && previous.to===from && previous.amount===amount) continue;
          choices.push({from,to,amount});
        }
      }
    }
    shuffle(choices,rng);
    let chosen=null;
    for(const choice of choices){
      const source=tubes[choice.from];
      const moved=source.splice(source.length-choice.amount,choice.amount);
      tubes[choice.to].push(...moved);
      const stateKey=key(tubes);
      tubes[choice.to].splice(tubes[choice.to].length-choice.amount,choice.amount);
      source.push(...moved);
      if(!seen.has(stateKey)){chosen=choice;break;}
    }
    if(!chosen) break;
    const moved=tubes[chosen.from].splice(tubes[chosen.from].length-chosen.amount,chosen.amount);
    tubes[chosen.to].push(...moved);
    seen.add(key(tubes));
    solution.push({from:chosen.to,to:chosen.from});
    previous=chosen;
  }
  return {tubes,solution:solution.reverse()};
}

export function difficultyFor(level) { const n=Math.max(1,Math.min(50,Math.trunc(level)||1)); const chapter=Math.ceil(n/10); const colors=n===1?2:n<=3?3:n<=6?4:n<=10?5:n<=15?6:n<=20?7:n<=25?8:n<=30?9:n<=35?10:n<=40?11:12; const empties=n<=6?1:2; const tier=n<=3?1:n<=10?2:n<=20?3:n<=35?4:5; return { level:n, chapter, chapterKey:`chapter${chapter}`, colors, empties, tier, difficultyKey:`difficulty${tier}`, scramble:22+n*4 }; }

function key(tubes) { return tubes.map((t)=>t.join(",")).join("|"); }
export function solve(tubes, { maxNodes=70000 }={}) { const start=key(tubes); if(isWon(tubes)) return []; const queue=[{tubes:cloneTubes(tubes), path:[]}]; const seen=new Set([start]); let head=0; while(head<queue.length && seen.size<=maxNodes){const cur=queue[head++]; for(const move of legalMoves(cur.tubes)){const next=pour(cur.tubes,move.from,move.to).tubes; const k=key(next); if(seen.has(k)) continue; const path=cur.path.concat(move); if(isWon(next)) return path; seen.add(k); queue.push({tubes:next,path});}} return null; }

export function generateLevel(level=1, seed=hashSeed(level)) {
  const info=difficultyFor(level);
  const rng=mulberry32(seed);
  let best=null;
  let bestMoves=-1;
  const tries=info.colors<=6?6:4;
  for(let i=0;i<tries;i++){
    const built=reverseLayout(info.colors,info.empties,rng,info.scramble);
    if(isWon(built.tubes) || !built.solution.length) continue;
    const optimal=info.colors<=6?solve(built.tubes,{maxNodes:50000}):null;
    const path=optimal || built.solution;
    // Every generated board must carry an executable proof, not just a plausible move list.
    // This protects against future changes to the reverse shuffler silently creating a dead level.
    if(!isValidSolution(built.tubes,path)) continue;
    if(path.length>bestMoves){
      best={tubes:built.tubes,par:path.length,solution:path};
      bestMoves=path.length;
    }
    if(best && bestMoves>=info.scramble) break;
  }
  if(!best){
    // reverseLayout is itself constructive, so this should be unreachable. Keep a bounded
    // retry rather than returning an unverified level if generation rules change later.
    for(let attempt=0;attempt<12 && !best;attempt++){
      const built=reverseLayout(info.colors,info.empties,rng,Math.max(8,info.scramble));
      if(!isValidSolution(built.tubes,built.solution)) continue;
      best={tubes:built.tubes,par:built.solution.length,solution:built.solution};
    }
  }
  if(!best) throw new Error(`Unable to generate a solvable water-sort level ${info.level}`);
  return { ...info, seed, tubes:cloneTubes(best.tubes), par:best.par, solution:best.solution.map((move)=>({...move})) };
}

export function createState(run={}, { rng=Math.random, mode="endless", seed=null }={}) { const level=Math.max(1,Math.min(50,Math.trunc(run.level||1))); const levelData=run.tubes?{...difficultyFor(level),...run,tubes:cloneTubes(run.tubes)}:generateLevel(level, seed ?? hashSeed(`${mode}:${level}`)); return { status:STATUS.ready, mode, seed:levelData.seed, level, chapter:levelData.chapter, chapterKey:levelData.chapterKey, tubes:cloneTubes(levelData.tubes), initialTubes:cloneTubes(levelData.tubes), par:levelData.par, moves:0, undoCount:0, history:[], selected:null, focus:0, hint:null, elapsedMs:0, startedAt:null, finishedAt:null, dailyDate:run.dailyDate||null, rngState:null, lastAction:null, toast:null }; }

function resetState(state) { return {...state,status:STATUS.ready,tubes:cloneTubes(state.initialTubes),moves:0,undoCount:0,history:[],selected:null,focus:0,hint:null,elapsedMs:0,startedAt:null,finishedAt:null,lastAction:"restart",toast:null}; }
function finish(next) { if(isWon(next.tubes)){next.status=STATUS.won; next.finishedAt=Date.now(); next.selected=null; next.hint=null;} return next; }
export function applyIntent(state, intent={}, { now=Date.now() }={}) { if(!state || !intent || state.status===STATUS.won && !["restart","newLevel"].includes(intent.type)) return {state,event:null}; let next={...state,tubes:cloneTubes(state.tubes),history:[...state.history]}; const type=intent.type;
  if(type==="start" && next.status===STATUS.ready){next.status=STATUS.playing;next.startedAt=now;return {state:next,event:{type:"start"}};}
  if(type==="restart") return {state:resetState(next),event:{type:"restart"}};
  if(type==="focus" && Number.isInteger(intent.index)){next.focus=((intent.index%next.tubes.length)+next.tubes.length)%next.tubes.length;next.hint=null;return {state:next,event:{type:"focus",index:next.focus}};}
  if(type==="select" && Number.isInteger(intent.index)){next.focus=((intent.index%next.tubes.length)+next.tubes.length)%next.tubes.length;const index=next.focus;if(next.status===STATUS.ready){next.status=STATUS.playing;next.startedAt=now;} if(next.selected===index){next.selected=null;next.hint=null;return {state:next,event:{type:"cancel"}};} if(next.selected===null){if(!next.tubes[index]?.length){return {state:{...next,toast:"empty-source"},event:{type:"invalid",index}};} next.selected=index;next.hint=null;return {state:next,event:{type:"select",index}};} const from=next.selected,to=index; const moved=pour(next.tubes,from,to); if(!moved){next.hint=null;return {state:{...next,toast:"invalid-pour"},event:{type:"invalid",index:to}};} next.history.push(cloneTubes(next.tubes)); next.tubes=moved.tubes; next.moves++;next.selected=null;next.hint=null;next.lastAction="pour"; const won=finish(next); return {state:won,event:{type:"pour",from,to,amount:moved.amount,color:moved.color,won:won.status===STATUS.won}};}
  if(type==="undo"){if(!next.history.length)return {state:next,event:{type:"noop"}};next.tubes=next.history.pop();next.moves=Math.max(0,next.moves-1);next.undoCount++;next.selected=null;next.hint=null;next.status=STATUS.playing;return {state:next,event:{type:"undo"}};}
  if(type==="hint"){const moves=legalMoves(next.tubes); if(!moves.length)return {state:{...next,toast:"stuck"},event:{type:"stuck"}}; next.hint=moves[0];next.selected=null;return {state:next,event:{type:"hint",move:moves[0]}};}
  return {state:next,event:null};
}
export function stepFrame(state, { now=Date.now(), dt=0 }={}) { if(state.status!==STATUS.playing || !state.startedAt) return {state,event:null}; const elapsed=Math.max(0,now-state.startedAt); return {state:{...state,elapsedMs:elapsed},event:null}; }

