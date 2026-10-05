require('reflect-metadata');
const assert = require('node:assert/strict');
const { ValidationPipe } = require('@nestjs/common');
const { UpdatePeriodDto } = require('./dist/periods/dto/period.dto');
const { PeriodsService } = require('./dist/periods/periods.service');
const { PeriodStatus } = require('./dist/periods/schemas/period.schema');
(async () => {
  let saves = 0;
  const period = {
    id: '000000000000000000000001', status: PeriodStatus.Open,
    startDate: new Date('2026-08-01'), endDate: new Date('2026-12-15'),
    set(value) { Object.assign(this, value); },
    async save() { saves++; return this; },
  };
  let otherOpen = false;
  const service = new PeriodsService({ findById: () => ({ exec: async () => period }), exists: async () => otherOpen }, {}, {}, {});
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
  const dto = await pipe.transform({ status: PeriodStatus.Planned }, { type: 'body', metatype: UpdatePeriodDto });
  await assert.rejects(() => service.update(period.id, dto), e => e.getStatus() === 400);
  assert.equal(period.status, PeriodStatus.Open);
  assert.equal(saves, 0);
  console.log('PASS: abierto -> planificado rechazado con 400, sin modificar ni guardar.');
  await service.update(period.id, { code: '2026-2' });
  assert.equal(period.status, PeriodStatus.Open);
  assert.equal(saves, 1);
  period.status = PeriodStatus.Planned;
  otherOpen = true;
  await assert.rejects(() => service.update(period.id, { status: PeriodStatus.Open }), e => e.getStatus() === 409);
  assert.equal(period.status, PeriodStatus.Planned);
  otherOpen = false;
  await service.update(period.id, { status: PeriodStatus.Open });
  assert.equal(period.status, PeriodStatus.Open);
  await assert.rejects(() => service.update(period.id, { status: PeriodStatus.Closed }), e => e.getStatus() === 400);
  period.status = PeriodStatus.Closed;
  await assert.rejects(() => service.update(period.id, { status: PeriodStatus.Open }), e => e.getStatus() === 400);
  console.log('Control: periodo cerrado no se puede reabrir (400).');
  console.log('PASS: edición sin cambio de estado, apertura, exclusividad y cierre directo verificados.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
