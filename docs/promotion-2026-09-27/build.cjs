const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert');
const deps='/Users/huangzihao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {createCanvas,GlobalFonts}=require(deps+'/@napi-rs/canvas');
const sharp=require(deps+'/sharp');
const root=path.resolve(__dirname,'../..');
GlobalFonts.registerFromPath('/System/Library/Fonts/Supplemental/Songti.ttc','GardenSerif');
GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','GardenSans');
const config=require(root+'/js/config'),art=require(root+'/js/views/art'),logic=require(root+'/js/rules/board'),challenges=require(root+'/js/challenge/challenges');
const source=root+'/js/renderer.js',mod=new Module(source,module);mod.filename=source;mod.paths=module.paths;
mod._compile(fs.readFileSync(source,'utf8')+'\nmodule.exports.promo={drawBoard,drawPlacementPreview};',source);
const {drawBoard,drawPlacementPreview}=mod.exports.promo;
const green={...config.COLORS},blue={...green,background:'#E8EFFB',panel:'#FFFFFF',text:'#263E6A',secondaryText:'#4D6081',primaryButton:'#354FBE',block:'#7999D9',emptyCell:'#DEE5F3',boardEdge:'#BECBEA',palaceLine:'#ACBCD7',energyEmptyCell:'#D9E3F6',clearGlow:'#FFF1CA'};
const pattern=['111001000','111001110','000111111','011000010','011100010','000000000','100110000','100110110','111000110'];
function state(mode='easy',level=null){const run=level===null?null:challenges.start(level),board=run?run.board:logic.createBoard(mode);if(!run)board.forEach((row,r)=>row.forEach((v,c)=>{if(v===0)board[r][c]=Number(pattern[r][c]);}));return {mode,board,challenge:run,energyPalaces:[],clearingCells:[],piecesPlaced:1};}
function rr(c,x,y,w,h,r,fill){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function txt(c,s,x,y,size=24,color=green.text,serif=false){c.fillStyle=color;c.font=`${size}px ${serif?'GardenSerif':'GardenSans'}`;c.textAlign='left';c.textBaseline='alphabetic';c.fillText(s,x,y);}
function board(c,s,x,y,w,preview=false){Object.assign(config.COLORS,s.challenge?blue:green);const cols=s.board[0].length,rows=s.board.length,cell=36,k=w/(cols*cell);c.save();c.translate(x,y);c.scale(k,k);const l={boardX:0,boardY:0,boardWidth:cols*cell,boardHeight:rows*cell,cellSize:cell};drawBoard(c,l,s);if(preview){const shape={cells:[[0,0],[1,0],[2,0]]},b=s.board.map(r=>r.slice());assert(logic.canPlace(b,shape,0,2));logic.placeShape(b,shape,0,2);const result=logic.findCompletedRegions(b);assert(result.rows.includes(2)&&result.palaces.some(p=>p[0]===0&&p[1]===0));drawPlacementPreview(c,l,{...s,drag:{shape,target:{col:0,row:2},valid:true,previewClearingCells:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],...Array.from({length:9},(_,i)=>[i,2])]}});}c.restore();}
function piece(c,x,y,cell,cells,color=green.block){for(const [a,b] of cells)rr(c,x+a*cell+2,y+b*cell+2,cell-4,cell-4,cell*.13,color);}
function line(c,x,y,w,color='#D4D3C4'){c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.stroke();}
function base(w,h,fill=green.background){const portrait=w===750&&h===1334;const a=createCanvas(portrait?720:w,portrait?1280:h),c=a.getContext('2d');if(portrait)c.scale(720/w,1280/h);c.fillStyle=fill;c.fillRect(0,0,w,h);return {a,c};}
const files=[];
async function save(name,a,limit=0){if(name.includes('-竖版-'))limit=200000;let quality=92,data;do{data=await sharp(a.toBuffer('image/png')).jpeg({quality,mozjpeg:true}).toBuffer();quality-=5;}while(limit&&data.length>limit&&quality>=40);assert(!limit||data.length<=limit);fs.writeFileSync(path.join(__dirname,name),data);files.push({name,width:a.width,height:a.height,bytes:data.length});}
function footer(c,w,h,n,blueMode=false){line(c,54,h-104,w-108);txt(c,'方寸九宫',54,h-57,24,blueMode?blue.text:green.text,true);txt(c,n,w-128,h-57,15,blueMode?blue.secondaryText:green.secondaryText);}
(async()=>{
let {a,c}=base(650,250);txt(c,'清雅庭院 · 方块消除',30,42,13,green.secondaryText);txt(c,'落子成局',28,89,36,green.text,true);txt(c,'方寸之间',28,135,36,green.text,true);txt(c,'填满行、列或九宫，即可消除',30,172,13);art.garden(c,{x:211,y:147,width:123,height:83});board(c,state(),384,22,203,true);await save('01-通用封面-650x250.jpg',a,80000);
({a,c}=base(750,1334));txt(c,'清雅庭院  /  自由消除',54,97,22,green.secondaryText);txt(c,'放下这一块',50,181,62,green.text,true);txt(c,'点亮一片好心情',50,264,62,green.text,true);txt(c,'填满行、列或九宫，即可消除',54,322,25);board(c,state(),86,411,578,true);piece(c,94,1041,49,[[0,0],[1,0],[2,0]]);piece(c,321,1016,43,[[0,0],[1,0],[0,1],[1,1]]);piece(c,527,1016,43,[[0,0],[0,1],[1,1]]);txt(c,'不限时，按自己的节奏摆放',54,1181,25);footer(c,750,1334,'01 / 03');await save('02-竖版-自在消除-720x1280.jpg',a);
({a,c}=base(750,1334,blue.background));txt(c,'闯关挑战  /  三章三十六关',54,97,22,blue.secondaryText);txt(c,'这一关',50,181,66,blue.text,true);txt(c,'你会先放哪一块？',50,264,60,blue.text,true);txt(c,'有限步数，想好每一次落子',54,322,25,blue.text);const run=state('easy',17);board(c,run,86,411,578);const lev=challenges.LEVELS[17];run.challenge.tray.forEach((p,i)=>piece(c,104+i*211,1020,32,p.cells,blue.block));txt(c,`第 18 关 · ${lev.title}  /  ${challenges.goal(lev)}`,87,1135,23,blue.secondaryText);txt(c,'可连续撤回，换个顺序再试试',54,1181,25,blue.text);footer(c,750,1334,'02 / 03',true);await save('03-竖版-限步闯关-720x1280.jpg',a);
({a,c}=base(750,1334));txt(c,'清雅庭院  /  五种布局',54,97,22,green.secondaryText);txt(c,'换一座庭院',50,181,62,green.text,true);txt(c,'换一种思路',50,264,62,green.text,true);txt(c,'从完整方庭，到错落星位与曲院',54,322,25);const maps=[['easy',80,410],['medium',425,410],['hard',80,761],['courtyard',425,761]];for(const [id,x,y]of maps){board(c,state(id),x,y,243);txt(c,config.MODES[id].title,x,y+291,27,green.text,true);}rr(c,53,1128,644,77,17,green.panel);txt(c,'还有 6×9 长庭，等你挑战',83,1177,25);footer(c,750,1334,'03 / 03');await save('04-竖版-五种布局-720x1280.jpg',a);
({a,c}=base(1280,720));rr(c,657,0,623,720,0,blue.background);txt(c,'清雅庭院',52,85,25);txt(c,'自在消除',49,160,59,green.text,true);txt(c,'不限时，慢慢摆',54,205,23,green.secondaryText);board(c,state(),97,265,362,true);art.garden(c,{x:464,y:457,width:168,height:142});txt(c,'闯关挑战',710,85,25,blue.text);txt(c,'限步闯关',707,160,59,blue.text,true);txt(c,'三章三十六关，等你来挑战',712,205,23,blue.secondaryText);board(c,state('easy',17),754,265,362);txt(c,'方寸九宫 · 两种模式，两种乐趣',425,686,24);await save('05-横版-双模式-1280x720-待核尺寸.jpg',a);
({a,c}=base(600,480));txt(c,'一起走进清雅庭院',28,64,35,green.text,true);txt(c,'来庭院里，一起消一局',30,103,18,green.secondaryText);board(c,state(),30,143,284,true);art.garden(c,{x:348,y:206,width:234,height:175});txt(c,'自由消除',374,407,27,green.text,true);txt(c,'不限时 · 挑战高分',358,443,17,green.secondaryText);await save('06-分享-一起消一局-600x480-待核尺寸.jpg',a);
({a,c}=base(600,480,blue.background));txt(c,'下一步，换你来想',28,64,37,blue.text,true);txt(c,'三章闯关，试试你的落子顺序',30,103,18,blue.secondaryText);board(c,state('easy',17),30,143,284);art.path(c,{x:350,y:169,width:226,height:168},18);txt(c,'闯关挑战',371,407,27,blue.text,true);txt(c,'有限步数 · 连续撤回',346,443,17,blue.secondaryText);await save('07-分享-下一步换你-600x480-待核尺寸.jpg',a);
({a,c}=base(1280,720));
txt(c,'清雅庭院  /  五种布局',54,79,23,green.secondaryText);
txt(c,'换一座庭院，换一种思路',50,167,60,green.text,true);
txt(c,'从完整方庭，到纵向长庭与四角留白的曲院',54,222,24,green.secondaryText);
['easy','medium','hard','long','courtyard'].forEach((id,i)=>{
  const center=164+i*238,w=id==='long'?130:195;
  board(c,state(id),center-w/2,315,w);
  c.textAlign='center';c.fillStyle=green.text;c.font='30px GardenSerif';c.fillText(config.MODES[id].title,center,568);
});
line(c,54,622,1172);txt(c,'自由摆放 · 不限时 · 按布局记录最高分',54,670,24);
txt(c,'方寸九宫',1095,670,24,green.text,true);
await save('08-横版-五种布局-1280x720-待核尺寸.jpg',a);
({a,c}=base(1280,720,blue.background));
txt(c,'闯关挑战  /  三章三十六关',54,85,23,blue.secondaryText);
txt(c,'每一步',50,189,70,blue.text,true);
txt(c,'都值得想一想',50,283,65,blue.text,true);
txt(c,'有限步数，寻找你的消除顺序',54,343,25,blue.secondaryText);
rr(c,54,401,516,101,18,'#F8FAFF');
txt(c,`第 18 关 · ${lev.title}`,80,440,25,blue.text);
txt(c,challenges.goal(lev),80,477,23,blue.secondaryText);
txt(c,'看清目标，再放下一块',54,568,26,blue.text);
txt(c,'可连续撤回，换个思路再挑战',54,615,23,blue.secondaryText);
board(c,state('easy',17),710,79,480);
run.challenge.tray.forEach((p,i)=>piece(c,753+i*176,590,30,p.cells,blue.block));
txt(c,'方寸九宫',54,680,24,blue.text,true);
await save('09-横版-限步闯关-1280x720-待核尺寸.jpg',a);
fs.writeFileSync(path.join(__dirname,'尺寸与文件大小.json'),JSON.stringify(files,null,2));
console.log(files);
})().catch(e=>{console.error(e);process.exit(1)});
