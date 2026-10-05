require('reflect-metadata');
const fs=require('node:fs');
const {ValidationPipe}=require('@nestjs/common');
const {LoginDto}=require('./dist/auth/dto/login.dto');
const {CreateUserDto}=require('./dist/users/dto/create-user.dto');
const base=process.env.AUDIT_BASE_URL??'http://localhost:3100';
(async()=>{
 const response=await fetch(base+'/api/doc-json');if(!response.ok)throw Error('Swagger no disponible: '+response.status);
 const doc=await response.json();
 const collection=JSON.parse(fs.readFileSync('postman/proyecto1-simple.postman_collection.json','utf8'));
 const requests=[];function walk(items){for(const item of items)if(item.item)walk(item.item);else requests.push(item.request);}walk(collection.item);
 const operations=[];
 for(const [path,methods]of Object.entries(doc.paths))for(const [method,operation]of Object.entries(methods))if(['get','post','put','patch','delete'].includes(method))operations.push({method:method.toUpperCase(),path,operation});
 const normalized=requests.map(request=>request.method+' '+request.url.raw.replace('{{baseUrl}}','').split('?')[0].replace(/^\/api\/(?!v1\/)/,'/api/v1/').replace(/:([^/]+)/g,'{$1}'));
 const missing=operations.filter(op=>!normalized.includes(op.method+' '+op.path));
 const undocumentedResponses=operations.filter(op=>Object.values(op.operation.responses??{}).some(r=>!r.content));
 console.log('Postman requests:',requests.length,'Swagger operations:',operations.length,'missing after prefix normalization:',missing.length);
 console.log('Missing:',missing.map(op=>op.method+' '+op.path).join('\n'));
 const statuses={};
 for(const op of operations.filter(op=>op.method==='GET')) {
  const path=op.path.replace(/\{[^}]+\}/g,'000000000000000000000000');
  const r=await fetch(base+path);statuses[r.status]=(statuses[r.status]??0)+1;
  if(r.status===404)console.log('Advertised GET missing at runtime:',op.path);
 }
 console.log('All advertised GET paths, without token:',JSON.stringify(statuses));
 console.log('Swagger operations without response content:',undocumentedResponses.length);
 for(const route of ['/api/health','/api/v1/health','/api/users','/api/v1/users','/api/docs','/api/doc']) {
  const r=await fetch(base+route);console.log('HTTP GET',route,r.status);if(route==='/api/v1/health')console.log('health body',await r.text());
 }
 const r=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'prueba@example.com',password:'1234567'})});
 console.log('login 7 characters',r.status,await r.text());
 console.log('Swagger LoginDto.password',JSON.stringify(doc.components.schemas.LoginDto.properties.password));
 const pipe=new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true});
 for(const [type,input]of [[LoginDto,{email:'prueba@example.com',password:'1234567'}],[CreateUserDto,{name:'Prueba',email:'prueba@example.com',password:'abcdefgh'}]]) {
  try{await pipe.transform(input,{type:'body',metatype:type});console.log(type.name,'valid');}catch(e){console.log(type.name,'real validation',JSON.stringify(e.getResponse()));}
 }
 console.log('Swagger CreateUserDto.password',JSON.stringify(doc.components.schemas.CreateUserDto.properties.password));
 console.log('Swagger users GET responses',JSON.stringify(doc.paths['/api/v1/users'].get.responses));
 console.log('Swagger health GET responses',JSON.stringify(doc.paths['/api/v1/health'].get.responses));
 fs.writeFileSync('swagger-audit.json',JSON.stringify(doc,null,2)+'\n');
})().catch(e=>{console.error(e.message);process.exitCode=1});
