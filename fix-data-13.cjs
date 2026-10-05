const fs=require('node:fs');const assert=require('node:assert/strict');
const file='database/grades.json';let content=fs.readFileSync(file,'utf8');const rows=JSON.parse(content);
const originals=[];
for(const [id,value]of [['6abf0b8bfead57fb41c12df0',4],['6abf0b8bfead57fb41c12dfc',3]]){
 const row=rows.find(r=>r._id.$oid===id);assert.ok(row);assert.equal(row.value,5.7);originals.push(JSON.parse(JSON.stringify(row)));const before=JSON.stringify(row);row.value=value;assert.ok(content.includes(before));content=content.replace(before,JSON.stringify(row));
}
const backup='artifacts/data-13-original.json';assert.ok(!fs.existsSync(backup));fs.writeFileSync(backup,JSON.stringify(originals,null,2)+'\n');fs.writeFileSync(file,content);
console.log('Notas actualizadas a 4 y 3 según indicación del usuario.');
