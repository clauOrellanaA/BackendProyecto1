require('reflect-metadata');
const assert = require('node:assert/strict');
const { ValidationPipe } = require('@nestjs/common');
const { EvaluationsService } = require('./dist/evaluations/evaluations.service');
const { UpdateEvaluationDto } = require('./dist/evaluations/dto/evaluation.dto');
(async () => {
  let saves = 0;
  let periodQueries = 0;
  let status = 'cerrado';
  const evaluation = { _id: 'e', group: 'g', name: 'Parcial', weight: 25,
    set(dto) { Object.assign(this, dto); }, async save() { saves++; return this; } };
  const service = new EvaluationsService({
    findById: () => ({ exec: async () => evaluation }),
    find: () => ({ select: () => ({ exec: async () => [] }) }),
    create: async () => { throw Error('create no debe ejecutarse'); },
  }, { exists: async () => false },
  { assertCanManage: async () => ({ period: 'periodo-cerrado' }) },
  { findOne: async () => { periodQueries++; return { status }; } });
  const user = { id: 'admin', role: 'admin' };
  await assert.rejects(() => service.create({ group: 'g', name: 'Parcial', weight: 25 }, user), e => e.getStatus() === 400);
  console.log('Control: crear evaluación en periodo cerrado devuelve 400.');
  periodQueries = 0;
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
  const dto = await pipe.transform({ weight: 50 }, { type: 'body', metatype: UpdateEvaluationDto });
  await assert.rejects(() => service.update('e', dto, user), e => e.getStatus() === 400);
  await assert.rejects(() => service.update('e', { name: 'Otro parcial' }, user), e => e.getStatus() === 400);
  assert.equal(evaluation.weight, 25);
  assert.equal(evaluation.name, 'Parcial');
  assert.equal(saves, 0);
  assert.equal(periodQueries, 2);
  console.log('PASS: periodo cerrado rechaza cambios de peso y nombre, sin guardar.');
  status = 'abierto';
  const result = await service.update('e', dto, user);
  assert.equal(result.weight, 50);
  assert.equal(saves, 1);
  assert.equal(periodQueries, 3);
  console.log('PASS: periodo abierto permite actualizar peso y guardar.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
