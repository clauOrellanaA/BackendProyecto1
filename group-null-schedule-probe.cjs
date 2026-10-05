require('reflect-metadata');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { ValidationPipe } = require('@nestjs/common');
const { UpdateGroupDto } = require('./dist/groups/dto/group.dto');
const { GroupSchema } = require('./dist/groups/schemas/group.schema');
const { GroupsService } = require('./dist/groups/groups.service');
(async () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
  await assert.rejects(() => pipe.transform({ schedule: null }, { type: 'body', metatype: UpdateGroupDto }), e => e.getStatus() === 400);
  const dto = await pipe.transform({}, { type: 'body', metatype: UpdateGroupDto });
  const Model = mongoose.model('NullScheduleProbe', GroupSchema);
  const id = '000000000000000000000001';
  const group = new Model({ subject: id, teacher: id, period: id, number: 1, capacity: 30, enrolled: 0,
    schedule: [{ day: 'lunes', startTime: '07:00', endTime: '09:00', classroom: id }] });
  let saves = 0;
  group.save = async () => { const error = group.validateSync(); if (error) throw error; saves++; return group; };
  const service = new GroupsService({ findById: () => ({ exec: async () => group }) }, {}, {}, {}, {}, {});
  service.findOne = async () => group;
  const result = await service.update(id, dto);
  assert.equal(result.schedule.length, 1);
  assert.equal(result.schedule[0].day, 'lunes');
  assert.equal(saves, 1);
  console.log('PASS: schedule:null rechazado con 400; omitir schedule conserva el horario.');
  const valid = await pipe.transform({ schedule: [{ day: 'martes', startTime: '10:00', endTime: '11:00', classroom: id }] }, { type: 'body', metatype: UpdateGroupDto });
  assert.equal(valid.schedule[0].day, 'martes');
  await assert.rejects(() => pipe.transform({ schedule: [] }, { type: 'body', metatype: UpdateGroupDto }), e => e.getStatus() === 400);
  console.log('Control: schedule:[] rechazado con 400 por ArrayMinSize(1). Sin conexión a MongoDB.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
