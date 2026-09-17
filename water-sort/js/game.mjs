// filepath: games/water-sort/js/game.mjs
import { applyIntent, createState, stepFrame } from "./engine.mjs?v=35ad794d8cf9";
export function createGame(options={}){return {state:createState(options.run||{},options),options};}
export function dispatch(game,intent,options={}){const result=applyIntent(game.state,intent,options);game.state=result.state;return result;}
export function advanceFrame(game,options={}){const result=stepFrame(game.state,options);game.state=result.state;return result;}
export function snapshot(game){const s=game.state;return {level:s.level,mode:s.mode,moves:s.moves,undoCount:s.undoCount,elapsedMs:s.elapsedMs,status:s.status,seed:s.seed};}
