// Nutrition arithmetic only. Does not predict glucose or prescribe intake.
export const NUTRIENTS = ['kcal', 'carbs', 'sugar', 'protein', 'availableCarbs', 'gi'];
export function validateFood(food) {
  if (!food || typeof food.name !== 'string' || !food.name.trim() || food.name.length > 300) throw new Error('请填写食物名称');
  if (!food.per || typeof food.per !== 'object') throw new Error('食物营养资料无效');
  for (const key of NUTRIENTS) {
    const v = food.per[key];
    if (v != null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > (key === 'gi' ? 200 : key === 'kcal' ? 1000 : 100))) throw new Error('请核对每 100 g 的营养数值与单位');
  }
  if (food.per.sugar != null && food.per.carbs != null && food.per.sugar > food.per.carbs) throw new Error('糖是碳水的一部分，请核对糖与碳水数值');
  if (food.per.availableCarbs != null && food.per.carbs != null && food.per.availableCarbs > food.per.carbs) throw new Error('可利用碳水不能超过总碳水，请核对口径');
  if (typeof (food.source ?? '') !== 'string' || (food.source ?? '').length > 2000) throw new Error('来源文字无效');
  return food;
}
export function portion(item) {
  validateFood(item);
  if (typeof item.grams !== 'number' || !Number.isFinite(item.grams) || item.grams <= 0 || item.grams > 10000) throw new Error('请填写实际食用克数');
  const ratio = item.grams / 100, result = {};
  for (const key of NUTRIENTS.filter(k => k !== 'gi')) result[key] = item.per[key] == null ? null : item.per[key] * ratio;
  result.gi = item.per.gi ?? null;
  result.gl = result.availableCarbs != null && result.gi != null ? result.availableCarbs * result.gi / 100 : null;
  return result;
}
export function mealTotals(items) {
  const values = items.map(portion), result = {};
  for (const key of ['kcal','carbs','sugar','protein','gl']) {
    const known = values.filter(x => x[key] != null);
    result[key] = { value: known.length ? known.reduce((sum,x) => sum + x[key], 0) : null, missing: values.length - known.length };
  }
  const available = values.reduce((sum,x) => sum + (x.availableCarbs ?? 0), 0);
  const incomplete = values.some(x => x.availableCarbs == null || (x.availableCarbs > 0 && x.gi == null));
  result.gi = !incomplete && available > 0 ? values.reduce((sum,x) => sum + (x.gl ?? 0), 0) * 100 / available : null;
  return result;
}
export function referenceFood(f) {
  return { id: `reference:${f.n}`, name:f.n, category:f.c, aliases:f.a||[], units:f.u||[],
    per:{kcal:f.k??null,carbs:f.t??null,sugar:null,protein:f.p??null,availableCarbs:f.t??null,gi:f.gi??null},
    source:'原项目食物参考库；声称来源为食物成分表/USDA，但缺少逐项文献；品种与做法有差异。', carbBasis:'estimate', verified:false };
}
