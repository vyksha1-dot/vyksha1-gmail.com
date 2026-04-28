export function isAfterHours() {
  const hour = new Date().getHours();
  return hour >= 17 || hour < 6;
}

export function getPrice(severityOrWidth: 'low' | 'medium' | 'high' | number, length?: number, depth?: number) {
  const afterHours = isAfterHours();
  const multiplier = afterHours ? 2 : 1;
  
  if (typeof severityOrWidth === 'string') {
    const pricing = {
      low: 99,
      medium: 149,
      high: 899
    };
    return pricing[severityOrWidth] * multiplier;
  }

  // Measurement based pricing: Base $150 + $20 per square inch + extra for depth
  const width = severityOrWidth;
  const area = width * (length || width);
  const depthFactor = (depth || 1) * 50;
  const basePrice = 150 + (area * 2) + depthFactor;
  
  return Math.round(basePrice * multiplier);
}
