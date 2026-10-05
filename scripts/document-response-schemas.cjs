// Completa los contratos que el plugin Swagger no infiere (interfaces/genericos).
const fs=require('node:fs');const ts=require('typescript');
const doc=JSON.parse(fs.readFileSync('swagger-audit.json','utf8'));
const wanted=new Map();for(const ms of Object.values(doc.paths))for(const op of Object.values(ms))for(const [status,r]of Object.entries(op.responses??{}))if(!r.content)wanted.set(op.operationId,Number(status));
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile).config;
const parsed=ts.parseJsonConfigFileContent(config,ts.sys,'.');const program=ts.createProgram(parsed.fileNames,parsed.options);const checker=program.getTypeChecker();
for(const file of program.getSourceFiles().filter(f=>f.fileName.endsWith('.controller.ts'))){
 const source=fs.readFileSync(file.fileName,'utf8');
 for(const match of source.matchAll(/schema: responseSchemas\.(\w+)/g))for(const ms of Object.values(doc.paths))for(const op of Object.values(ms))if(op.operationId===match[1])wanted.set(match[1],Number(Object.keys(op.responses).find(s=>Number(s)>=200&&Number(s)<300)));
}
function schema(type,depth=0,seen=new Set()){
 const name=type.symbol?.name;
 if(name==='Date')return {type:'string',format:'date-time'};
 if(name==='ObjectId')return {type:'string',pattern:'^[a-fA-F0-9]{24}$'};
 if(type.flags&ts.TypeFlags.StringLike)return {type:'string',...(type.isStringLiteral()?{enum:[type.value]}:{})};
 if(type.flags&ts.TypeFlags.NumberLike)return {type:'number'};
 if(type.flags&ts.TypeFlags.BooleanLike)return {type:'boolean'};
 if(type.isUnion()){const types=type.types.filter(t=>!(t.flags&(ts.TypeFlags.Undefined|ts.TypeFlags.Null)));if(types.length===1)return schema(types[0],depth,seen);if(types.every(t=>t.flags&ts.TypeFlags.BooleanLike))return {type:'boolean'};return {oneOf:types.map(t=>schema(t,depth,seen)),...(type.types.some(t=>t.flags&ts.TypeFlags.Null)?{nullable:true}:{})};}
 if(checker.isArrayType(type)||checker.isTupleType(type))return {type:'array',items:schema(checker.getTypeArguments(type)[0],depth+1,seen)};
 if(depth>5||seen.has(type))return {type:'object',additionalProperties:true};
 if(type.flags&(ts.TypeFlags.Any|ts.TypeFlags.Unknown))return {};
 const next=new Set(seen);next.add(type);const properties={};const required=[];
 for(const prop of checker.getPropertiesOfType(type)){
  if(prop.name==='passwordHash'||prop.name.startsWith('$'))continue;
  const declaration=prop.valueDeclaration??prop.declarations?.[0];if(!declaration)continue;
  const pt=checker.getTypeOfSymbolAtLocation(prop,declaration);if(pt.getCallSignatures().length)continue;
  properties[prop.name]=schema(pt,depth+1,next);if(!(prop.flags&ts.SymbolFlags.Optional))required.push(prop.name);
 }
 return {type:'object',...(Object.keys(properties).length?{properties,required}:{additionalProperties:true})};
}
const schemas={};
for(const file of program.getSourceFiles().filter(f=>f.fileName.endsWith('.controller.ts'))){
 let source=fs.readFileSync(file.fileName,'utf8');const edits=[];
 for(const cls of file.statements.filter(ts.isClassDeclaration))for(const method of cls.members.filter(ts.isMethodDeclaration)){
  const id=cls.name.text+'_'+method.name.getText(file);if(!wanted.has(id))continue;
  const signature=checker.getSignatureFromDeclaration(method);const result=checker.getAwaitedType(checker.getReturnTypeOfSignature(signature));schemas[id]=schema(result);
  if(!source.includes('schema: responseSchemas.'+id))edits.push({at:method.getStart(file),text:`@ApiResponse({ status: ${wanted.get(id)}, schema: responseSchemas.${id} })\n  `});
 }
 if(!edits.length)continue;
 for(const edit of edits.sort((a,b)=>b.at-a.at))source=source.slice(0,edit.at)+edit.text+source.slice(edit.at);
 source='import { ApiResponse } from "@nestjs/swagger";\nimport { responseSchemas } from "../common/docs/response-schemas";\n'+source;fs.writeFileSync(file.fileName,source);
}
fs.mkdirSync('src/common/docs',{recursive:true});fs.writeFileSync('src/common/docs/response-schemas.ts',"import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';\n\n// Generado desde los tipos de retorno; las ramas dinamicas conservan propiedades abiertas.\nexport const responseSchemas: Record<string, SchemaObject> = "+JSON.stringify(schemas,null,2)+';\n');
console.log('Contratos generados:',Object.keys(schemas).length);
