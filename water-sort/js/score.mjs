// filepath: games/water-sort/js/score.mjs
export const MAX_SCORE=800;
export function scoreFor({level=1,par=1,moves=0,elapsedMs=0}={}){const base=Math.min(360,180+Math.max(0,level-1)*8);const step=Math.max(0,Math.min(300,Math.round(300*Math.min(1,par/Math.max(par,moves||par)))));const generous=Math.max(1,par*8000);const time=Math.max(0,Math.min(140,Math.round(140*Math.max(0,1-(Math.max(0,elapsedMs)-generous)/(generous*1.2)))));return Math.max(0,Math.min(MAX_SCORE,base+step+time));}
export function formatTime(ms=0){const total=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;}
