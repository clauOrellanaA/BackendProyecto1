require('dotenv').config({ quiet: true });
require('reflect-metadata');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
async function main() {
  if (process.argv[2] === 'preflight') {
    await mongoose.connect(process.env.MONGODB_URI.replace(':27018', ':27017'), {serverSelectionTimeoutMS:5000});
    console.log('Administradores existentes:', await mongoose.connection.collection('users').countDocuments({role:'admin'}));
    await mongoose.disconnect(); return;
  }
  const base = 'http://localhost:3100/api/v1';
  const {Test:Testing}=require('@nestjs/testing');
  const {Module,ValidationPipe:Pipe,NotFoundException}=require('@nestjs/common');
  const {UsersModule}=require('./dist/users/users.module');
  const {UsersService:US}=require('./dist/users/users.service');
  const {UsersController:UC}=require('./dist/users/users.controller');
  const {AuthModule}=require('./dist/auth/auth.module');
  const {GroupsController}=require('./dist/groups/groups.controller');
  const {GroupsService}=require('./dist/groups/groups.service');
  const {EvaluationsController}=require('./dist/evaluations/evaluations.controller');
  const {EvaluationsService}=require('./dist/evaluations/evaluations.service');
  const {GradesController}=require('./dist/grades/grades.controller');
  const {GradesService:GS}=require('./dist/grades/grades.service');
  const {ConfigModule}=require('@nestjs/config');
  const hash=await require('bcrypt').hash('Secret123!',4);
  const users=['admin','docente','estudiante'].map((role,i)=>({id:String(i+1).padStart(24,'0'),role,active:true,email:['admin@universidad.edu','laura.lopez89@universidad.edu','juliana.herrera147@universidad.edu'][i],passwordHash:hash}));
  const userStub={findByEmailWithPassword:async email=>users.find(u=>u.email===email),findById:async id=>users.find(u=>u.id===id),findOne:async id=>users.find(u=>u.id===id),findAll:async()=>({data:users.map(({passwordHash,...u})=>u),meta:{total:3}}),create:async dto=>({id:'prueba',...dto})};
  class StubUsersModule {};
  Module({controllers:[UC],providers:[{provide:US,useValue:userStub}],exports:[US]})(StubUsersModule);
  process.env.JWT_SECRET='backend-probe-temporary-secret-2026';
  const testModule=await Testing.createTestingModule({imports:[ConfigModule.forRoot({isGlobal:true}),AuthModule],controllers:[GroupsController,EvaluationsController,GradesController],providers:[{provide:GroupsService,useValue:{findAll:async()=>({data:[],meta:{total:0}}),findMine:async()=>({data:[],meta:{total:0}}),findOne:async()=>{throw new NotFoundException('Grupo no encontrado')}}},{provide:EvaluationsService,useValue:{findAll:async()=>({data:[],meta:{total:0}}),create:async dto=>({id:'prueba',...dto})}},{provide:GS,useValue:{upsert:async()=>{throw new NotFoundException('Matricula no encontrada')}}}]}).overrideModule(UsersModule).useModule(StubUsersModule).compile();
  const harness=testModule.createNestApplication({logger:false});harness.setGlobalPrefix('api/v1');harness.useGlobalPipes(new Pipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));harness.useGlobalFilters(new (require('./dist/common/filters/all-exceptions.filter').AllExceptionsFilter)());await harness.listen(3100);
  console.log('HTTP aislado: controladores, DTOs, AuthModule y guards reales; servicios de recursos y usuarios simulados');
  async function req(path, token, method='GET', body) {
    const r = await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await r.json(); return {status:r.status,data};
  }
  if (process.argv[2] === 'login') {
    const assert = require('node:assert/strict');
    let failures = 0;
    const cases = [
      [users[0], 'Clave123', 200],
      [users[1], 'Secret123!', 200],
      [users[2], 'Secret123!X', 200],
      [users[0], 'LongSecret123!', 200],
      [users[0], 'Wrong123', 401, true],
      [users[0], 'Short12', 400],
      [users[0], '', 400],
      [users[0], undefined, 400],
      [users[0], 12345678, 400],
    ];
    try {
      for (const [user, password, expected, wrong] of cases) {
        if(expected===200) user.passwordHash=await require('bcrypt').hash(password,4);
        const result=await req('/auth/login',null,'POST',{email:user.email,password});
        console.log('login',user.role,'tipo',typeof password,'longitud',typeof password==='string'?password.length:'N/A',wrong?'incorrecta':'','actual',result.status,'esperado',expected);
        try {
          assert.equal(result.status,expected);
          if(expected===200) assert.equal(typeof result.data.accessToken,'string');
        } catch { failures++; }
      }
      assert.equal(failures,0,`${failures} verificaciones de login fallaron`);
      console.log('Login: 9 verificaciones correctas');
    } finally { await harness.close(); }
    return;
  }
  if (process.argv[2] === 'roles') {
    const assert = require('node:assert/strict');
    const jwt = require('jsonwebtoken');
    const roleTokens = Object.fromEntries(users.map(u => [u.role, jwt.sign({sub:u.id,email:u.email,role:u.role},process.env.JWT_SECRET,{expiresIn:600})]));
    userStub.updateOwnName = async (id, name) => ({id,name});
    let failures = 0;
    const cases = [
      ['/users',null,401],
      ['/users','invalid-token',401],
      ['/users',roleTokens.estudiante,403],
      ['/users',roleTokens.docente,403],
      ['/users',roleTokens.admin,200],
      ['/auth/me',roleTokens.estudiante,200],
      ['/auth/me',roleTokens.docente,200],
      ['/auth/me',roleTokens.admin,200],
      ['/auth/login',null,400,'POST',{}],
      ...Object.values(roleTokens).map(token => ['/users/me',token,200,'PATCH',{name:'Nombre de prueba'}]),
    ];
    try {
      for (const [path, token, expected, method='GET', body] of cases) {
        const result = await req(path,token,method,body);
        console.log(method,path,'actual',result.status,'esperado',expected);
        try {
          assert.equal(result.status,expected);
          if(expected===403) assert.equal(result.data.message,'No tienes permisos para esta accion');
        } catch { failures++; }
      }
      assert.equal(failures,0,`${failures} verificaciones de autorizacion fallaron`);
      console.log('Autorizacion: 12 verificaciones correctas');
    } finally { await harness.close(); }
    return;
  }
  const tokens={};
  for (const [role,email] of Object.entries({admin:'admin@universidad.edu',docente:'laura.lopez89@universidad.edu',estudiante:'juliana.herrera147@universidad.edu'})) {
    const r=await req('/auth/login',null,'POST',{email,password:'Secret123!'});
    tokens[role]=r.data.accessToken;
    console.log('login',role,r.status,r.data.accessToken?'token omitido':JSON.stringify(r.data));
    if(tokens[role]) { const p=JSON.parse(Buffer.from(tokens[role].split('.')[1],'base64url')); console.log('JWT segundos',role,p.exp-p.iat); }
  }
  users[0].passwordHash=await require('bcrypt').hash('LongSecret123!',4);
  const validLogin=await req('/auth/login',null,'POST',{email:users[0].email,password:'LongSecret123!'});
  const tokenPayload=require('jsonwebtoken').decode(validLogin.data.accessToken);
  console.log('login clave 13 caracteres',validLogin.status,'JWT segundos configurados',process.env.JWT_EXPIRES_IN_SECONDS,'JWT segundos reales',tokenPayload?.exp-tokenPayload?.iat);
  await new Promise(resolve=>setTimeout(resolve,4000));
  console.log('token original despues de 4 segundos',(await req('/auth/me',validLogin.data.accessToken)).status);
  // El servidor emite tokens de pocos segundos: crear tokens locales con la misma
  // clave y usuarios ya autenticados permite aislar las demas pruebas de ese fallo.
  const jwt=require('jsonwebtoken');
  for(const u of users) if(!tokens[u.role]) tokens[u.role]=jwt.sign({sub:u.id,email:u.email,role:u.role},process.env.JWT_SECRET,{expiresIn:600});
  for(const role of Object.keys(tokens)) if(tokens[role]) {
    const p=jwt.decode(tokens[role]);tokens[role]=jwt.sign({sub:p.sub,email:p.email,role:p.role},process.env.JWT_SECRET,{expiresIn:600});
  }
  for(const [path,role] of [['/users',null],['/users','estudiante'],['/groups/mine','docente'],['/users/me','estudiante'],['/users/me','admin'],['/evaluations','admin'],['/evaluationslalala','admin'],['/groups?page=0','admin'],['/groups?active=abc','admin'],['/groups/000000000000000000000000','admin']]) {
    const r=await req(path,tokens[role]); console.log(path,role,r.status,JSON.stringify(r.status>=400?r.data:{total:r.data.meta?.total,keys:Object.keys(r.data)}));
    if(['/groups/mine','/users/me','/evaluations'].includes(path)) assert.equal(r.status,200);
    if(path==='/evaluationslalala') assert.equal(r.status,404);
  }
  for(const value of [4.5,4.6,5,5.1]) {
    const r=await req('/grades',tokens.admin,'PUT',{enrollment:'000000000000000000000000',evaluation:'000000000000000000000000',value});console.log('grade',value,r.status,JSON.stringify(r.data));
    assert.equal(r.status,value<=5?404:400);
  }
  const ev=await req('/evaluations',tokens.admin,'POST',{group:'000000000000000000000000',name:'Parcial',weight:25});console.log('POST evaluacion servicio exitoso',ev.status,JSON.stringify(ev.data));
  assert.equal(ev.status,201);
  await harness.close();
  // Solo dobles en memoria: ninguna de las pruebas siguientes escribe en MongoDB.
  const {UsersService}=require('./dist/users/users.service');
  const bcrypt=require('bcrypt'); let saved=0;
  const user={passwordHash:await bcrypt.hash('Old12345',4),save:async()=>{saved++;return user;}};
  const service=new UsersService({findById:()=>({select:()=>({exec:async()=>user})})},{},{},{});
  await service.changePassword('id','Old12345','New12345');
  console.log('changePassword llamadas save',saved,'nuevo hash en memoria',await bcrypt.compare('New12345',user.passwordHash));
  assert.equal(saved,1);
  const {GradesService}=require('./dist/grades/grades.service');
  const {EnrollmentStatus}=require('./dist/enrollments/schemas/enrollment.schema');
  const enrollment={id:'e',_id:'e',group:'g',student:'s',subject:'s',status:EnrollmentStatus.Active,save:async()=>enrollment};
  const chain=value=>({exec:async()=>value});
  const grades=new GradesService({find:()=>chain([{evaluation:'v',value:3}])},{findById:()=>chain(enrollment)},{find:()=>chain([{_id:'v',weight:100,name:'Parcial'}])},{assertCanManage:async()=>{}},{findOne:async()=>({user:'u'})},{findOne:async()=>({name:'Materia'})},{notify:async()=>{}});
  const finalized=await grades.finalize('e',{role:'admin'});
  console.log('finalize nota 3.0',JSON.stringify(finalized));
  assert.equal(finalized.status,EnrollmentStatus.Passed);
  // HTTP real en Nest con servicio sustituido para comprobar el codigo de alta sin persistir.
  const {Test}=require('@nestjs/testing');
  const {UsersController}=require('./dist/users/users.controller');
  const module=await Test.createTestingModule({controllers:[UsersController],providers:[{provide:UsersService,useValue:{create:async dto=>({id:'prueba',...dto})}}]}).compile();
  const app=module.createNestApplication();
  const {ValidationPipe}=require('@nestjs/common');app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();
  const r=await require('supertest')(app.getHttpServer()).post('/users').send({name:'Prueba',email:'prueba@example.com',password:'Secret123!',role:'estudiante'});
  console.log('POST users servicio simulado exitoso',r.status,JSON.stringify(r.body));await app.close();
  assert.equal(r.status,201);
}
main().catch(e=>{console.error(e);process.exitCode=1});
