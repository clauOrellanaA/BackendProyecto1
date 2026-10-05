require('dotenv').config({quiet:true});
const fs=require('node:fs');
const mongoose=require('mongoose');
const {EJSON}=require('bson');
const changes=[];
async function main(){
 await mongoose.connect(process.env.MONGODB_URI.replace(':27018',':27017'),{serverSelectionTimeoutMS:5000});
 const dbNames=(await mongoose.connection.db.admin().listDatabases()).databases.map(d=>d.name).filter(n=>!['admin','config','local'].includes(n));
 const tasks={grades:[['6abf0b8bfead57fb41c12df0','value'],['6abf0b8bfead57fb41c12dfc','value']],notifications:[['6abf0b8bfead57fb41c12ec0','createdAt']],students:[['6abf0b8bfead57fb41c12b9c','program']],subjects:[['6abf0b8bfead57fb41c1299d','credits']],users:[['6abf0b8bfead57fb41c12a38','name']]};
 for(const [collection,fields] of Object.entries(tasks))for(const [id,field] of fields){
  let row=null;
  for(const dbName of dbNames){const found=await mongoose.connection.getClient().db(dbName).collection(collection).findOne({_id:new mongoose.Types.ObjectId(id)},{projection:{[field]:1}});if(found){row=found;break;}}
  console.log(collection,id,field,row?EJSON.stringify(row[field]):'NO ENCONTRADO');
  if(row&&row[field]!==undefined)changes.push({collection,id,field,value:EJSON.serialize(row[field])});
 }
 fs.writeFileSync('json-recovery-values.json',JSON.stringify(changes,null,2)+'\n');
 await mongoose.disconnect();
}
main().catch(async e=>{console.error(e.message);await mongoose.disconnect();process.exitCode=1;});
