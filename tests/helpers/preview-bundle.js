const fs = require('fs'), path = require('path');

function readModules(root) {
  const sources = {};
  function visit(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = directory + '/' + entry.name;
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith('.js')) sources['./' + file.slice(0, -3)] = fs.readFileSync(path.join(root, file), 'utf8');
    }
  }
  visit('js');
  return sources;
}

// Offline previews need the same caller-relative resolution and shared cache as CommonJS.
function bundleModules(sources) {
  return `const sources=${JSON.stringify(sources).replace(/</g, '\\u003c')};
const cache={};
function require(name,parent='.'){
  if(!name.startsWith('.'))throw Error('Unsupported preview module: '+name);
  const parts=parent.split('/').slice(0,-1);
  for(const part of name.replace(/\\.js$/,'').split('/')){
    if(part==='..')parts.pop();
    else if(part&&part!=='.')parts.push(part);
  }
  const id='./'+parts.filter(part=>part!=='.').join('/');
  if(cache[id])return cache[id].exports;
  if(!Object.prototype.hasOwnProperty.call(sources,id))throw Error('Missing preview module: '+id+' from '+parent);
  const module={exports:{}};cache[id]=module;
  try{new Function('require','module','exports','wx',sources[id])(
    child=>require(child,id),module,module.exports,typeof wx==='undefined'?undefined:wx
  );}catch(error){delete cache[id];throw error;}
  return module.exports;
}`;
}

module.exports = { readModules, bundleModules };
