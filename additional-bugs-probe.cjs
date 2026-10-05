require('reflect-metadata');
const assert=require('node:assert/strict');
const {ValidationPipe}=require('@nestjs/common');
const {NotificationsQueryDto}=require('./dist/notifications/dto/notification.dto');
const {JwtStrategy}=require('./dist/auth/strategies/jwt.strategy');
const {GradesService}=require('./dist/grades/grades.service');
(async()=>{
 const pipe=new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true});
 for(const read of ['true','false','abc','1','']){
  if(['true','false'].includes(read)){const q=await pipe.transform({read},{type:'query',metatype:NotificationsQueryDto});assert.equal(q.read,read==='true');console.log('notifications read',read,'válido');}
  else {await assert.rejects(()=>pipe.transform({read},{type:'query',metatype:NotificationsQueryDto}),e=>e.getStatus()===400);console.log('notifications read',JSON.stringify(read),'rechazado 400');}
 }
 const user={active:true,email:'prueba@example.com',role:'estudiante',passwordChangedAt:new Date('2026-10-05T12:00:00.900Z')};
 const strategy=new JwtStrategy({getOrThrow:()=> 'clave-de-prueba-de-32-caracteres'},{findById:async()=>user});
 const iat=Math.floor(new Date('2026-10-05T12:00:00.100Z').getTime()/1000);
 await assert.rejects(()=>strategy.validate({sub:'id',email:user.email,role:user.role,iat}),e=>e.getStatus()===401);
 console.log('JWT emitido 800 ms antes del cambio de clave: RECHAZADO 401');
 const {AuthService}=require('./dist/auth/auth.service');const {JwtService}=require('@nestjs/jwt');
 user.id='id';
 const jwt=new JwtService({secret:'clave-de-prueba-de-32-caracteres',signOptions:{expiresIn:3600}});
 const auth=new AuthService({changePassword:async()=>user},jwt);
 const fresh=await auth.changePassword('id',{});const payload=await jwt.verifyAsync(fresh.accessToken);
 assert.equal((await strategy.validate(payload)).id,'id');
 user.passwordChangedAt=new Date(user.passwordChangedAt.getTime()+1);
 await assert.rejects(()=>strategy.validate(payload),e=>e.getStatus()===401);
 console.log('Token nuevo válido; cambio siguiente de 1 ms invalida token anterior');
 await assert.rejects(()=>strategy.validate({sub:'id',email:user.email,role:user.role,iat:iat-1}),e=>e.getStatus()===401);
 console.log('Control JWT del segundo anterior: RECHAZADO 401');
 const service=new GradesService({}, {find:()=>({distinct:async()=>['matricula-propia']})},{},{},{findByUserId:async()=>({id:'estudiante-propio'})},{},{});
 let observed;
 service.list=async filter=>{observed=filter;return {data:[{evaluation:'otra-evaluacion'}]};};
 const grades=await service.findMine('usuario',{evaluation:'000000000000000000000001',page:1,limit:20});
 assert.equal(observed.evaluation,'000000000000000000000001');assert.deepEqual(observed.enrollment,{$in:['matricula-propia']});console.log('GET grades/mine filtros propios y evaluation conservados:',JSON.stringify(observed));
})().catch(e=>{console.error(e.message);process.exitCode=1});
