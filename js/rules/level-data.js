// Decode reviewed board data once at module load, never during rendering.
function decode(definition) {
  const {board,...level}=definition,filled=[],blocked=[];
  if(!Array.isArray(board)||board.length!==9||board.some(row=>typeof row!=='string'||!/^[012]{9}$/.test(row))) {
    throw new Error(`Invalid authored board: ${level.title}`);
  }
  board.forEach((row,r)=>[...row].forEach((cell,c)=>{
    if(cell==='1')filled.push([c,r]);
    if(cell==='2')blocked.push([c,r]);
  }));
  return {...level,filled,blocked,holes:[]};
}
module.exports={decode};
