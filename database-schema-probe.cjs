// Solo lectura: JSON Extended de MongoDB y schemas fuente, sin conexion a BD.
require('reflect-metadata');
require('ts-node').register();
const fs=require('node:fs');
const path=require('node:path');
const mongoose=require('mongoose');
const {EJSON}=require('bson');
const root=__dirname;
const collections={};
const byModel={};
for(const file of fs.readdirSync(path.join(root,'database')).filter(f=>f.endsWith('.json'))) {
  const collection=file.slice(0,-5);
  const dir=path.join(root,'src',collection,'schemas');
  const schemaFile=fs.readdirSync(dir).find(f=>f.endsWith('.schema.ts'));
  const exports=require(path.join(dir,schemaFile));
  const [schemaName,schema]=Object.entries(exports).find(([name,s])=>name.endsWith('Schema') && s instanceof mongoose.Schema && !name.startsWith('Schedule'));
  const name=schemaName.slice(0,-6);
  const rows=EJSON.parse(fs.readFileSync(path.join(root,'database',file),'utf8'),{relaxed:true});
  const model=mongoose.model(name,schema);
  collections[collection]={rows,schema,model};byModel[name]=collection;
}
const issues={};
function issue(category,example) { const group=issues[category]??={count:0,examples:[]};group.count++;if(group.examples.length<3)group.examples.push(example); }
const ids=Object.fromEntries(Object.entries(collections).map(([c,{rows}])=>[c,new Set(rows.map(r=>String(r._id)))]));
for(const [collection,{rows,schema,model}] of Object.entries(collections)) {
  let invalid=0;
  for(const [index,row] of rows.entries()) {
    const doc=new model(row);
    const error=doc.validateSync();
    if(error) {invalid++;for(const [field,e] of Object.entries(error.errors)) issue(`validation:${collection}:${field}:${e.kind}`,{index,id:String(row._id),field,kind:e.kind,message:e.message});}
    function refs(s,value,prefix='') {
      s.eachPath((field,type)=>{
        const v=value?.[field];if(v===undefined||v===null)return;
        const ref=type.options.ref??type.caster?.options?.ref;
        if(ref) for(const target of Array.isArray(v)?v:[v]) {
          const targetCollection=byModel[ref];
          if(targetCollection&&!ids[targetCollection].has(String(target))) issue(`reference:${collection}:${prefix+field}->${targetCollection}`,{index,id:String(row._id),field:prefix+field,target:String(target)});
        }
        if(type.schema) for(const [i,sub] of (Array.isArray(v)?v:[v]).entries())refs(type.schema,sub,prefix+field+'.'+i+'.');
      });
    }
    refs(schema,row);
    for(const field of Object.keys(row)) if(!schema.path(field)&&!schema.virtualpath(field)) issue(`unknown:${collection}:${field}`,{index,id:String(row._id)});
  }
  const indexes=[[{_id:1},{unique:true}],...schema.indexes().filter(([,options])=>options.unique)];
  for(const [fields,options] of indexes) {
    const seen=new Map();
    for(const [index,row] of rows.entries()) {
      const doc=new model(row);
      const values=Object.keys(fields).map(field=>doc.get(field)??null);
      if(options.sparse&&values.every(v=>v===null))continue;
      const key=JSON.stringify(values);
      if(seen.has(key))issue(`unique:${collection}:${Object.keys(fields).join('+')}`,{index,id:String(row._id),firstIndex:seen.get(key),firstId:String(rows[seen.get(key)]._id),key:JSON.parse(key)});else seen.set(key,index);
    }
  }
  console.log(collection,JSON.stringify({documents:rows.length,invalid}));
}
console.log(JSON.stringify(issues,null,2));
