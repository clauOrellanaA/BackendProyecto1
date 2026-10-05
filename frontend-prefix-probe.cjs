const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const root = 'C:/tarea/examen1/proyectoFrontend1';
const calls = [];
class NextResponse extends Response {
  constructor(body, options) { super(body, options); this.cookies = {set() {}}; }
  static json(value, options) { return new NextResponse(JSON.stringify(value),options); }
}
const session = {COOKIE:'session',HOME:{admin:'/admin'},decodeToken:()=>({role:'admin',exp:2000000000})};
let server;
function load(relative) {
  const source = fs.readFileSync(path.join(root,relative),'utf8');
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  vm.runInNewContext(code,{
    exports,process:{env:{BACKEND_URL:'http://localhost:3100'}},Response,
    fetch:async (url,options)=>{calls.push({url,options});return new Response(JSON.stringify({accessToken:'token-de-prueba',ok:true}),{status:200,headers:{'content-type':'application/json'}});},
    require(name) {
      if(name==='next/headers')return {cookies:async()=>({get:()=>({value:'token-de-prueba'})})};
      if(name==='next/navigation')return {redirect:()=>{throw Error('redirect inesperado')}};
      if(name==='next/server')return {NextResponse};
      if(name==='@/lib/server')return server;
      if(name.endsWith('/session'))return session;
      throw Error('Import inesperado: '+name);
    },
  },{filename:relative});
  return exports;
}
(async()=>{
  server=load('src/lib/server.ts');
  const proxy=load('src/app/api/[...path]/route.ts');
  const login=load('src/app/api/auth/login/route.ts');
  const request={method:'GET',nextUrl:{search:'?page=2',protocol:'http:'},cookies:{get:()=>({value:'token-de-prueba'})},text:async()=>'{"email":"prueba@example.com","password":"Secret123!"}'};
  await server.apiGet('/users?page=2');
  await proxy.GET(request,{params:Promise.resolve({path:['users']})});
  await login.POST({...request,method:'POST'});
  const expected=['http://localhost:3100/api/v1/users?page=2','http://localhost:3100/api/v1/users?page=2','http://localhost:3100/api/v1/auth/login'];
  let failures=0;
  calls.forEach((call,i)=>{console.log(['apiGet','proxy GET','login POST'][i],call.url,call.url===expected[i]?'OK':'PREFIJO INCORRECTO');if(call.url!==expected[i])failures++;});
  const assert=require('node:assert/strict');
  assert.equal(calls[1].options.headers.Authorization,'Bearer token-de-prueba');
  assert.equal(calls[2].options.method,'POST');
  assert.equal(calls[2].options.body,await request.text());
  assert.equal(failures,0,`${failures} destinos con prefijo incorrecto`);
})().catch(error=>{console.error(error.message);process.exitCode=1});
