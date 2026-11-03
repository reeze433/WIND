const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const handlebars=require('handlebars');
const root=__dirname,system=path.join(root,'system'),lang=JSON.parse(fs.readFileSync(path.join(system,'lang/ru.json'),'utf8'));
const resolve=key=>Object.hasOwn(lang,key)?lang[key]:key.split('.').reduce((value,part)=>value?.[part],lang);
const files=fs.readdirSync(path.join(system,'scripts')).filter(name=>name.endsWith('.mjs'));
const missing=new Set();
for(const name of files){const text=fs.readFileSync(path.join(system,'scripts',name),'utf8');for(const match of text.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g))if(!resolve('VIT.'+match[1]))missing.add('VIT.'+match[1]);}
for(const name of fs.readdirSync(path.join(system,'templates')).filter(name=>name.endsWith('.hbs'))){const text=fs.readFileSync(path.join(system,'templates',name),'utf8');handlebars.precompile(text);for(const match of text.matchAll(/localize\s+['"](VIT\.[^'"]+)['"]/g))if(!resolve(match[1]))missing.add(match[1]);}
assert.deepEqual([...missing],[],'Unresolved localization');
for(const name of ['system.json','lang/ru.json'])JSON.parse(fs.readFileSync(path.join(system,name),'utf8'));
console.log(`${files.length} modules; 4 templates; JSON and literal localization references OK`);
