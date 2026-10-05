// Corrige solo valores cuyo equivalente es inequívoco. No conecta a MongoDB.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const edits=[
 ['grades','6abf0b8bfead57fb41c12e1b',row=>{assert.equal(row.value,'4,2');row.value=4.2;}],
 ['groups','6abf0b8bfead57fb41c12c3a',row=>{assert.equal(row.schedule[0].day,'Miércoles');row.schedule[0].day='miercoles';}],
 ['notifications','6abf0b8bfead57fb41c12eb7',row=>{assert.equal(row.type,'aviso_urgente');row.type='aviso';}],
 ['periods','6abf0b8bfead57fb41c12a35',row=>{assert.equal(row.status,'Abierto');row.status='abierto';}],
 ['users','6abf0b8bfead57fb41c12a90',row=>{assert.equal(row.role,'Docente');row.role='docente';}],
];
const staged=new Map();
for(const [collection,id,change] of edits){
 const file='database/'+collection+'.json';
 const original=staged.get(file)??fs.readFileSync(file,'utf8');
 const rows=JSON.parse(original);
 const row=rows.find(row=>row._id.$oid===id);assert.ok(row);
 const before=JSON.stringify(row);change(row);const after=JSON.stringify(row);
 assert.ok(original.includes(before),'El JSON debe contener el documento exacto sin reformatear');
 staged.set(file,original.replace(before,after));
 console.log(collection,id,'normalizado');
}
for(const [file,content] of staged) fs.writeFileSync(file,content);
