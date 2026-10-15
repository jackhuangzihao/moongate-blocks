// Monday to Sunday. Authored layouts and fixed decks, independent of chapter boards.
// Board digits: 0 empty, 1 block. Flowers and gates are separate overlays.
// Keep the seven positions stable: date mapping and old shares use their appended IDs.
module.exports = [
  // The targets lie on different lines; one column clear cannot collect both.
  {
    title: '借径听风', kind: 'stones', target: 2,
    difficulty: '适中', theme: '行列接力', par: 6, limit: 9,
    board: [
      '000010000',
      '000010000',
      '000010000',
      '000000000',
      '100010000',
      '000000000',
      '000010000',
      '000000000',
      '000010000',
    ],
    stones: [[0,4],[4,8]],
    plan: [
      ["line2H",1,4],
      ["line2H",5,4],
      ["line2H",7,4],
      ["dot",3,4],
      ["line3V",4,3],
      ["dot",4,7],
    ]
  },
  // Clearing the column leaves a block in the rectangle slot. The row must clear next.
  {
    title: '留白成窗', kind: 'area', target: 9,
    difficulty: '适中', theme: '为大块留位', par: 7, limit: 10,
    board: [
      '000010000',
      '000000000',
      '000000000',
      '000010000',
      '111111001',
      '000110000',
      '000000000',
      '000000000',
      '000010000',
    ],
    area: [[3,3],[4,3],[5,3],[3,4],[4,4],[5,4],[3,5],[4,5],[5,5]],
    plan: [
      ["line2V",4,1],
      ["dot",4,6],
      ["dot",4,7],
      ["dot",4,4],
      ["line2H",6,4],
      ["rect6V",4,3],
      ["line2V",3,3],
    ]
  },
  // The first bed needs both clears, while the far bed needs the column clear.
  {
    title: '两岸花信', kind: 'flowers', target: 2,
    difficulty: '进阶', theme: '两岸浇灌', par: 6, limit: 9,
    board: [
      '000000100',
      '000000100',
      '000000000',
      '001001100',
      '000000000',
      '000000100',
      '000000000',
      '000000000',
      '000000100',
    ],
    flowers: [[5,4,2],[7,7,1]],
    plan: [
      ["line2H",0,3],
      ["corner3B",3,3],
      ["line2H",7,3],
      ["line3V",6,2],
      ["dot",6,6],
      ["dot",6,7],
    ]
  },
  // Prepare the outer row before the final plus completes its palace and row together.
  {
    title: '交映成景', kind: 'cross', target: 1,
    difficulty: '进阶', theme: '同步消除', par: 7, limit: 10,
    board: [
      '000101000',
      '001111100',
      '000101000',
      '000000000',
      '000000000',
      '000000000',
      '000000000',
      '000010000',
      '000010000',
    ],
    plan: [
      ["line2H",0,1],
      ["line2H",7,1],
      ["line3V",4,4],
      ["line4V",4,0],
      ["line3H",0,1],
      ["line3H",6,1],
      ["plus5",3,0],
    ]
  },
  // A opens the column; its key B opens the final marked palace.
  {
    title: '双扉借景', kind: 'stones', target: 1,
    difficulty: '进阶', theme: '双门次序', par: 9, limit: 12,
    board: [
      '000000010',
      '010010010',
      '000000000',
      '000000000',
      '000000010',
      '000000000',
      '000000010',
      '000000000',
      '001000010',
    ],
    stones: [[2,8]],
    keys: [[7,1,"A"],[7,6,"B"]],
    gates: [{"id":"A","cells":[[7,2],[7,3]]},{"id":"B","cells":[[0,6],[1,6],[2,6],[0,7],[1,7],[2,7],[0,8],[1,8]]}],
    plan: [
      ["dot",0,1],
      ["line2H",2,1],
      ["line2H",5,1],
      ["dot",8,1],
      ["line3V",7,1],
      ["dot",7,5],
      ["dot",7,7],
      ["rect6V",0,6],
      ["line2V",2,6],
    ]
  },
  // The key and the flower work area are frozen. A first clear only removes ice.
  {
    title: '霜下花开', kind: 'flowers', target: 1,
    difficulty: '较难', theme: '破冰取钥', par: 8, limit: 11,
    board: [
      '000000000',
      '000000000',
      '001110000',
      '000000000',
      '000000000',
      '000000000',
      '000000010',
      '000000110',
      '000000000',
    ],
    ice: [[2,2],[3,2],[4,2],[7,6],[6,7],[7,7]],
    flowers: [[5,7,2]],
    keys: [[3,2,"A"]],
    gates: [{"id":"A","cells":[[6,6],[8,6],[8,7],[6,8],[7,8],[8,8]]}],
    plan: [
      ["line2H",0,2],
      ["line4H",5,2],
      ["line2H",0,2],
      ["line4H",5,2],
      ["corner5D",6,6],
      ["dot",6,6],
      ["corner5D",6,6],
      ["dot",6,6],
    ]
  },
  // The opened column waters the first bed and frees space for the six-cell rectangle.
  {
    title: '周末归庭', kind: 'flowers', target: 2,
    difficulty: '较难', theme: '机关与花圃', par: 9, limit: 12,
    board: [
      '101000000',
      '000000000',
      '010000000',
      '000000000',
      '000000000',
      '001000000',
      '000010110',
      '001000000',
      '001000000',
    ],
    flowers: [[3,7,2],[5,7,1]],
    keys: [[2,0,"A"]],
    gates: [{"id":"A","cells":[[2,3],[2,4],[0,6],[1,6],[2,6]]}],
    plan: [
      ["zig4V",0,0],
      ["line2V",2,1],
      ["line3V",2,0],
      ["line2V",2,3],
      ["dot",2,6],
      ["rect6H",0,5],
      ["line2V",3,5],
      ["dot",5,6],
      ["dot",8,6],
    ]
  }
];
