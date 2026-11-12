/** How a level is named wherever results are shown: "Level 3", or "Custom". Never the description. */
export const levelLabel = (level: number | string): string =>
  level === 'custom' ? 'Custom' : `Level ${level}`
