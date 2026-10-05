require('reflect-metadata');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const {ValidationPipe}=require('@nestjs/common');
const base=process.env.AUDIT_BASE_URL??'http://localhost:3100';
(async()=>{
 const doc=await (await fetch(base+'/api/doc-json')).json();const collection=JSON.parse(fs.readFileSync('postman/proyecto1-simple.postman_collection.json','utf8'));
 const requests=[];function walk(items){for(const item of items)if(item.item)walk(item.item);else requests.push(item.request);}walk(collection.item);
 const keys=requests.map(r=>r.method+' '+r.url.raw.replace('{{baseUrl}}','').split('?')[0].replace(/:([^/]+)/g,'{$1}'));
 assert.equal(new Set(keys).size,100);for(const [p,ms]of Object.entries(doc.paths))for(const m of Object.keys(ms))assert.ok(keys.includes(m.toUpperCase()+' '+p));
 assert.ok(requests.every(r=>r.url.path[0]==='api'&&r.url.path[1]==='v1'));
 function refs(value){if(!value||typeof value!=='object')return;if(value.$ref){let dest=doc;for(const part of value.$ref.slice(2).split('/'))dest=dest?.[part];assert.ok(dest,'Referencia inexistente '+value.$ref);}for(const child of Object.values(value))refs(child);}refs(doc);
 assert.equal(doc.components.schemas.LoginDto.properties.password.minLength,8);
 const controllers={};for(const dir of fs.readdirSync('dist')){const file=path.join('dist',dir,dir+'.controller.js');if(fs.existsSync(file))for(const [name,ctrl]of Object.entries(require('./'+file.replace(/\\/g,'/'))))controllers[name]=ctrl;}
 const pipe=new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true});let bodies=0;
 for(const r of requests.filter(r=>r.body?.raw)){
  const key=r.method+' '+r.url.raw.replace('{{baseUrl}}','').split('?')[0].replace(/:([^/]+)/g,'{$1}');const [method,...parts]=key.split(' ');const op=doc.paths[parts.join(' ')][method.toLowerCase()];
  const [controller,fn]=op.operationId.split('_');const types=Reflect.getMetadata('design:paramtypes',controllers[controller]?.prototype,fn)??[];
  const type=types.find(t=>t?.name.endsWith('Dto'));if(!type)continue;
  const body=JSON.parse(r.body.raw.replace(/PEGA_AQUI_[A-Z_]+/g,'000000000000000000000000'));
  try{await pipe.transform(body,{type:'body',metatype:type});bodies++;}catch(e){throw Error(key+' '+JSON.stringify(e.getResponse()));}
 }
 function validate(input,s){if(s.$ref)s=doc.components.schemas[s.$ref.split('/').pop()];if(s.oneOf){assert.ok(s.oneOf.some(branch=>{try{validate(input,branch);return true;}catch{return false;}}));return;}if(s.type==='object'){assert.ok(input&&typeof input==='object'&&!Array.isArray(input));for(const k of s.required??[])assert.ok(k in input,'Campo ausente '+k);for(const [k,v]of Object.entries(s.properties??{}))if(k in input)validate(input[k],v);}else if(s.type==='array'){assert.ok(Array.isArray(input));input.forEach(v=>validate(v,s.items));}else if(s.type==='integer')assert.ok(Number.isInteger(input));else if(s.type)assert.equal(typeof input,s.type);}
 for(const [route,method,body]of [['/api/v1/health','get'],['/api/v1/users','get'],['/api/v1/auth/login','post',{email:'prueba@example.com',password:'1234567'}]]){
  const r=await fetch(base+route,{method:method.toUpperCase(),...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const schema=doc.paths[route][method].responses[r.status]?.content?.['application/json']?.schema;assert.ok(schema);validate(await r.json(),schema);
 }
 console.log('PASS: 100 operaciones unicas con prefijo correcto; referencias OpenAPI resueltas; minLength 8; '+bodies+' ejemplos DTO validos tras sustituir IDs; respuestas reales 200/401/400 compatibles.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
