export function isAfterHours() {
  const hour = new Date().getHours();
  return hour >= 17 || hour < 6;
}

export function getPrice(severity: 'low' | 'medium' | 'high') {
  const afterHours = isAfterHours();
  const pricing = {
    standard: { low: 299, medium: 499, high: 0 },
    afterHours: { low: 598, medium: 998, high: 0 }
  };

  const set = afterHours ? pricing.afterHours : pricing.standard;
  return set[severity];
}
