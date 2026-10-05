// Usage: node scripts/sync-postman.cjs swagger-audit.json
const fs=require('node:fs');
const doc=JSON.parse(fs.readFileSync(process.argv[2]??'swagger-audit.json','utf8'));
const file='postman/proyecto1-simple.postman_collection.json';
const collection=JSON.parse(fs.readFileSync(file,'utf8'));
const existing=new Map();
function walk(items){for(const item of items)if(item.item)walk(item.item);else{const r=item.request;r.url.raw=r.url.raw.replace(/\/api\/(?!v1\/)/,'/api/v1/');if(r.url.path[0]==='api'&&r.url.path[1]!=='v1')r.url.path.splice(1,0,'v1');const key=r.method+' '+r.url.raw.replace('{{baseUrl}}','').split('?')[0].replace(/:([^/]+)/g,'{$1}');existing.set(key,item);}}
walk(collection.item);
function resolve(schema){return schema?.$ref?doc.components.schemas[schema.$ref.split('/').pop()]:schema??{};}
function example(input,field='',depth=0){const s=resolve(input);if(depth>5)return {};
 if(s.example!==undefined)return s.example;if(s.default!==undefined)return s.default;if(s.enum)return s.enum[0];
 if(s.oneOf)return example(s.oneOf[0],field,depth+1);
 if(s.type==='array')return Array.from({length:s.minItems??1},()=>example(s.items,field,depth+1));
 if(s.properties)return Object.fromEntries(Object.entries(s.properties).filter(([key])=>(s.required??[]).includes(key)).map(([key,value])=>[key,example(value,key,depth+1)]));
 if(s.type==='boolean')return true;if(s.type==='integer'||s.type==='number')return s.minimum??1;
 if(s.format==='date-time'||/Date$/.test(field))return '2026-10-05T00:00:00.000Z';
 if(/email/i.test(field))return 'prueba@universidad.edu';if(/password/i.test(field))return 'Secret123!';
 if(/^(id|group|groupId|enrollment|evaluation|user|users|student|teacher|program|subject|period|classroom|faculty|dean|prerequisites|relatedId)$/.test(field))return 'PEGA_AQUI_EL_ID_'+field.toUpperCase();
 return 'Ejemplo';
}
const folders=new Map();
for(const [path,methods]of Object.entries(doc.paths))for(const [method,op]of Object.entries(methods)){
 if(!['get','post','patch','put','delete'].includes(method))continue;
 const key=method.toUpperCase()+' '+path;let item=existing.get(key);
 if(!item){const segments=path.slice(1).replace(/\{([^}]+)\}/g,':$1').split('/');const query=(op.parameters??[]).filter(p=>p.in==='query').map(p=>({key:p.name,value:String(example(p.schema,p.name)),disabled:!p.required}));
  const raw='{{baseUrl}}/'+segments.join('/')+(query.some(q=>!q.disabled)?'?'+query.filter(q=>!q.disabled).map(q=>q.key+'='+q.value).join('&'):'');
  item={name:op.summary??op.operationId,request:{method:method.toUpperCase(),header:[],url:{raw,host:['{{baseUrl}}'],path:segments,...(query.length?{query}:{}),...(segments.some(s=>s.startsWith(':'))?{variable:segments.filter(s=>s.startsWith(':')).map(s=>({key:s.slice(1),value:'',description:'ID real del recurso'}))}:{})}}};
  const body=op.requestBody?.content?.['application/json']?.schema;if(body){item.request.header.push({key:'Content-Type',value:'application/json'});item.request.body={mode:'raw',raw:JSON.stringify(example(body),null,2),options:{raw:{language:'json'}}};}
 }
 item.request.description=op.summary??op.operationId;
 const bodySchema=resolve(op.requestBody?.content?.['application/json']?.schema);
 if(item.request.body?.raw&&bodySchema.properties){
  const body=JSON.parse(item.request.body.raw);
  for(const field of Object.keys(body))if(!bodySchema.properties[field])delete body[field];
  for(const field of bodySchema.required??[])if(!(field in body))body[field]=example(bodySchema.properties[field],field);
  item.request.body.raw=JSON.stringify(body,null,2);
 }
 if(!op.security?.length)item.request.auth={type:'noauth'};
 if(path==='/api/v1/auth/login')item.event=[{listen:'test',script:{type:'text/javascript',exec:['if (pm.response.code === 200) {','  const token = pm.response.json().accessToken;','  if (token) pm.collectionVariables.set("accessToken", token);','}']}}];
 const tag=op.tags?.[0]??'otros';if(!folders.has(tag))folders.set(tag,[]);folders.get(tag).push(item);
}
collection.item=[...folders].map(([name,item])=>({name,item}));
collection.auth={type:'bearer',bearer:[{key:'token',value:'{{accessToken}}',type:'string'}]};
if(!collection.variable.some(v=>v.key==='accessToken'))collection.variable.push({key:'accessToken',value:''});
collection.info.description='Todos los endpoints de la API /api/v1. Configura baseUrl con el origen del backend. Login guarda accessToken; las demas rutas heredan Bearer. Reemplaza PEGA_AQUI_... y las Path Variables con IDs reales; activa los query opcionales que necesites. Las operaciones de escritura modifican datos si se ejecutan.';
fs.writeFileSync(file,JSON.stringify(collection,null,2)+'\n');console.log('Postman:',[...folders.values()].reduce((n,a)=>n+a.length,0),'operaciones');
