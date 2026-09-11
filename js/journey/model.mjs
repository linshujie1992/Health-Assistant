// No personal dates, glucose targets, appointments or example records are defaults.
// Records stay on this device. No patient data is sent to a server.
export function emptyJourney(episodeId) {
  if (typeof episodeId !== 'string' || !episodeId.trim()) throw new Error('缺少孕程编号');
  return {
    schemaVersion: 2,
    revision: 0,
    episodeId,
    profile: {
      mode: 'unknown', dueDate: null, dueDateConfirmed: false,
      birthDate: null, birthDateConfirmed: false,
      region: null, diabetesType: null,
      doctorInstructions: [],
      dueDateBasis: 'doctor', gestationReference: null, careNote: '',
      lastPeriodStart:null, lastPeriodEnd:null, cycleLength:null, cycleRegular:'unknown',
      birthDateMother:null, heightCm:null, prePregnancyWeightKg:null, pregnancyCount:null, birthCount:null,
      fetuses:'unknown', bloodType:'', conditions:'', allergies:'', medicationList:'', pregnancyHistory:'', hospital:'',
    },
    records: [], events: [], suggestions: [], dateHistory: [], reviews: [],
    children: [], customFoods:[], legacy: null, preferences: { glucoseUnit: 'mmol/L' },
  };
}

// Pure migration: does not touch localStorage or delete/overwrite the v1 key.
// Old GL, calorie calculations and plans remain an archive, never glucose readings
// or appointments. A real migration must back up the original bytes before commit.
export function prepareLegacyMigration(legacy, episodeId) {
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy) || legacy.version !== 1 ||
      !legacy.days || typeof legacy.days !== 'object' || Array.isArray(legacy.days)) {
    throw new Error('无法识别旧数据，原数据应保留并人工核对');
  }
  const next = emptyJourney(episodeId);
  next.legacy = structuredClone(legacy);
  // v1 fields are kept losslessly here. Record conversion belongs to a separately
  // previewed mapping; avoid inventing time, context, units or repeated readings.
  return next;
}
