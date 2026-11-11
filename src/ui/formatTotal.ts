/** 95 s becomes "1:35". */
export const formatTotal = (ms: number): string => {
  const sec = Math.round(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}
