const { createBoard, canPlace, placeShape, findCompletedRegions, clearCompletedRegions, hasAnyPlacement } = require('../rules/board');
const { SHAPES } = require('../rules/shapes');

const KEY = 'fangcunBasicsStepV1';
const LESSONS = [
  { title:'① 拖动方块，填满一行', detail:'把下方横条拖到虚线处，补齐这一行', move:{slot:1,c:6,r:4} },
  { title:'② 这九格也是一个消除区域', detail:'补齐框出的 3×3 九宫，九格一起消除', move:{slot:1,c:3,r:5} },
  { title:'③ 自己试试，完成一次消除', detail:'没有指定落点：选择一块，把行或九宫填满', move:null }
];

function isNew(state) {
  return state.tutorialVisible && !state.collection.clears
    && !state.challengeProgress.stars.some(Boolean) && !state.challengeProgress.active
    && !Object.values(state.bestScores).some(Boolean) && !Object.keys(state.savedGames).length;
}
function create(step = 0) {
  step=Number.isInteger(step) && step>=0 && step<LESSONS.length?step:0;
  const board=createBoard('easy');
  if(step===1){for(let r=3;r<5;r++)for(let c=3;c<6;c++)board[r][c]=1;}
  else for(const r of step===2?[1,7]:[4])for(let c=0;c<6;c++)board[r][c]=1;
  const shape=id=>SHAPES.find(p=>p.id===id);
  const tray=step===2?[shape('line3H'),shape('line3H'),shape('line3H')]:[null,shape('line3H'),null];
  return {step,board,tray,done:false,needsNext:false};
}
function play(lesson,slot,c,r) {
  if(!lesson || lesson.done || lesson.needsNext)return null;
  const piece=lesson.tray[slot],suggestion=LESSONS[lesson.step].move;
  if(!piece || !canPlace(lesson.board,piece,c,r))return null;
  if(suggestion && (slot!==suggestion.slot || c!==suggestion.c || r!==suggestion.r))return {guided:true};
  placeShape(lesson.board,piece,c,r);lesson.tray[slot]=null;
  const completed=findCompletedRegions(lesson.board);
  const cleared=completed.rows.length+completed.cols.length+completed.palaces.length;
  clearCompletedRegions(lesson.board,completed);
  lesson.needsNext=cleared>0;lesson.done=cleared>0 && lesson.step===2;
  const stuck=!cleared && lesson.tray.every(p=>!p || !hasAnyPlacement(lesson.board,p));
  return {cleared,stuck};
}
module.exports={KEY,LESSONS,isNew,create,play};
