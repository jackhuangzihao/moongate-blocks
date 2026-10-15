const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const base=path.join(root,'docs/prototypes/gravity');
const { bundleModules }=require('./helpers/preview-bundle');
const files=['js/gravity/gravity-engine.js','js/rules/board.js','js/rules/shapes.js','js/config.js'];
const sources=Object.fromEntries(files.map(file=>['./'+file.slice(0,-3),fs.readFileSync(path.join(root,file),'utf8')]));
const bundle=bundleModules(sources);
const html=fs.readFileSync(path.join(base,'preview.html'),'utf8').replace('/* BUNDLE */',()=>bundle).replace('/* CONTROLLER */',()=>fs.readFileSync(path.join(base,'controller.js'),'utf8'));
fs.writeFileSync(path.join(root,'docs/prototypes/gravity/lab.html'),html);console.log('Built archived gravity laboratory');
