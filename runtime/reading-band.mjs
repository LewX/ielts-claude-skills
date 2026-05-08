const gtBands = [
  { min: 39, band: 9.0 },
  { min: 37, band: 8.5 },
  { min: 35, band: 8.0 },
  { min: 32, band: 7.5 },
  { min: 30, band: 7.0 },
  { min: 27, band: 6.5 },
  { min: 23, band: 6.0 },
  { min: 19, band: 5.5 },
  { min: 15, band: 5.0 },
];

export function estimateGtBandFromShortSet({ correct, total }) {
  const scaledCorrect = Math.round((correct / total) * 40);
  const match = gtBands.find((row) => scaledCorrect >= row.min) ?? { band: 4.5 };

  return {
    scaledCorrect,
    band: match.band,
    label: `Estimated Band ${match.band}`,
  };
}
