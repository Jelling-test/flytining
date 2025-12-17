const tuya = require('zigbee-herdsman-converters/lib/tuya');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const e = exposes.presets;
const ea = exposes.access;

const definition = {
  fingerprint: [
    { modelID: 'TS0601', manufacturerName: '_TZE204_tzreobvu' },
    { modelID: 'TS0601', manufacturerName: '_TZE284_mrffaamu' },
    { modelID: 'TS0601', manufacturerName: '_TZE284_8gxmcvpu' },
    { modelID: 'TS0601', manufacturerName: '_TZE204_mrffaamu' },
    { modelID: 'TS0601', manufacturerName: '_TZE284_vwefsu2k' },
  ],
  model: 'TOQCB2-JZT-3P',
  vendor: 'Tongou',
  description: 'Smart circuit breaker 3P 63A',
  extend: [
    tuya.modernExtend.tuyaBase({ dp: true }),
  ],
  exposes: [
    tuya.exposes.switch(),
    e.energy(),
    e.power(),
    e.voltage(),
    e.current(),
    e.temperature(),
    tuya.exposes.voltageWithPhase('a'),
    tuya.exposes.voltageWithPhase('b'),
    tuya.exposes.voltageWithPhase('c'),
    tuya.exposes.powerWithPhase('a'),
    tuya.exposes.powerWithPhase('b'),
    tuya.exposes.powerWithPhase('c'),
    tuya.exposes.currentWithPhase('a'),
    tuya.exposes.currentWithPhase('b'),
    tuya.exposes.currentWithPhase('c'),
    e.numeric('current_threshold', ea.STATE_SET)
      .withValueMin(1).withValueMax(63).withValueStep(1).withUnit('A')
      .withDescription('Ampere-grænse'),
  ],
  meta: {
    tuyaDatapoints: [
      [1, 'energy', tuya.valueConverter.divideBy100],
      [6, null, tuya.valueConverter.phaseVariant2WithPhase('a')],
      [7, null, tuya.valueConverter.phaseVariant2WithPhase('b')],
      [8, null, tuya.valueConverter.phaseVariant2WithPhase('c')],
      [16, 'state', tuya.valueConverter.onOff],
      [114, 'current_threshold', tuya.valueConverter.raw],
      [131, 'temperature', tuya.valueConverter.divideBy10],
    ],
  },
};

module.exports = definition;
