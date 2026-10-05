const fs=require('node:fs');
const assert=require('node:assert/strict');
const messages={
 5:'Rutas mine/me declaradas antes de :id. Reproducción HTTP: /groups/mine y /users/me devuelven 200 para sus usuarios autorizados.',
 6:'Recurso registrado como evaluations. GET /evaluations devuelve 200 y la ruta anterior devuelve 404.',
 7:'Altas exitosas de usuarios y evaluaciones devuelven 201; ambos casos comprobados por HTTP con servicios simulados.',
 8:'changePassword retorna user.save(). Prueba del servicio con documento simulado registra una llamada a save y hash nuevo válido.',
 9:'UpsertGradeDto permite hasta 5. HTTP: 4.5, 4.6 y 5 alcanzan el servicio (404 por matrícula inexistente de prueba); 5.1 conserva 400.',
 10:'Comparación de aprobación usa >= PASSING_GRADE. Prueba del servicio: finalGrade 3 produce status aprobada.',
 14:'Valor del documento identificado convertido de cadena 4,2 a número 4.2; validación Number correcta.',
 15:'Día normalizado a miercoles; GroupSchema valida el documento.',
 16:'Tipo normalizado a aviso, categoría existente de aviso general; el texto del aviso permanece intacto. NotificationSchema valida type.',
 18:'Estado normalizado a abierto; PeriodSchema valida el documento.',
 23:'Rol normalizado a docente; UserSchema valida el documento.',
};
let text=fs.readFileSync('BUGS.md','utf8');
for(const [number,message] of Object.entries(messages)){
 const section=new RegExp('(#{2,3} ERROR '+number+' —[^]*?)(?=\\n#{2,3} |$)');
 assert.ok(section.test(text),'Seccion faltante '+number);
 text=text.replace(section,block=>{
  assert.ok(block.includes('- Estado: PENDIENTE.'),'Estado inesperado '+number);
  const command=Number(number)<=10?'npm.cmd run build; node backend-bug-probe.cjs':'node database-schema-probe.cjs';
  return block.replace('- Estado: PENDIENTE.','- Estado: CORREGIDO.\n- Verificación (2026-10-05): '+message+' Comando: `'+command+'`.');
 });
}
for(const number of [11,12,13,17,19,20,21,22]){
 const section=new RegExp('(#{2,3} ERROR '+number+' —[^]*?)(?=\\n#{2,3} |$)');
 text=text.replace(section,block=>block.replace('- Estado: PENDIENTE.','- Estado: PENDIENTE.\n- Seguimiento (2026-10-05): requiere valor correcto o decisión sobre el dato. La consulta autorizada de MongoDB local en modo solo lectura no encontró los IDs solicitados para recuperación; se pidió información al usuario. Se conserva el JSON original de este caso.'));
}
text+='\n## Verificación posterior a las correcciones (2026-10-05)\n\nSe conservaron las correcciones existentes de ERROR 1–4. Se corrigieron ERROR 5–10, 14–16, 18 y 23. Build y reproducciones del backend con aserciones pasan (servicios de recursos simulados, sin escrituras en MongoDB); evidencia: `backend-after-fixes.txt`. El contraste de schemas confirma que desaparecieron los cinco hallazgos normalizados; quedan 5 documentos inválidos, 2 colisiones de índices y 2 referencias sin destino. Evidencia: `database-schema-after-fixes.txt`. Los ocho errores de datos restantes esperan los valores o decisiones solicitados. La base de datos real no fue modificada.\n';
fs.writeFileSync('BUGS.md',text);
