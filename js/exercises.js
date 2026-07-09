// 常见运动能耗参考（MET 代谢当量），数值参考《Compendium of Physical Activities》
// 消耗热量(kcal) = MET × 3.5 × 体重(kg) / 200 × 时长(分钟)

export const EXERCISES = [
  { n: '散步（慢走）', met: 3.0 },
  { n: '快走', met: 4.3 },
  { n: '慢跑', met: 8.0 },
  { n: '跑步（10km/h）', met: 9.8 },
  { n: '跑步（12km/h）', met: 11.5 },
  { n: '骑自行车（休闲）', met: 4.0 },
  { n: '骑自行车（通勤）', met: 6.8 },
  { n: '动感单车', met: 8.5 },
  { n: '游泳（休闲）', met: 6.0 },
  { n: '游泳（快速）', met: 9.8 },
  { n: '跳绳', met: 11.8 },
  { n: '瑜伽', met: 2.5 },
  { n: '普拉提', met: 3.0 },
  { n: '力量训练', met: 4.5 },
  { n: '羽毛球', met: 5.5 },
  { n: '乒乓球', met: 4.0 },
  { n: '网球', met: 7.3 },
  { n: '篮球', met: 6.5 },
  { n: '足球', met: 7.0 },
  { n: '爬楼梯', met: 8.0 },
  { n: '登山/徒步', met: 6.5 },
  { n: '健身操', met: 7.3 },
  { n: 'HIIT（高强度间歇）', met: 8.0 },
  { n: '椭圆机', met: 5.0 },
  { n: '划船机', met: 7.0 },
  { n: '跳舞/广场舞', met: 4.5 },
  { n: '家务清洁', met: 3.3 },
  { n: '遛狗', met: 3.0 },
  { n: '拉伸放松', met: 2.3 },
];

export function exerciseKcal(met, weightKg, minutes) {
  return Math.round((met * 3.5 * weightKg) / 200 * minutes);
}

export function searchExercises(query) {
  const q = query.trim().toLowerCase();
  if (!q) return EXERCISES;
  return EXERCISES.filter(e => e.n.toLowerCase().includes(q));
}
