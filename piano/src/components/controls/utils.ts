export function getTempoMarking(bpm: number): string {
  if (bpm < 60) return 'Largo (40–60)';
  if (bpm < 76) return 'Adagio (60–76)';
  if (bpm < 108) return 'Andante (76–108)';
  if (bpm < 120) return 'Moderato (108–120)';
  if (bpm < 156) return 'Allegro (120–156)';
  if (bpm < 176) return 'Vivace (156–176)';
  if (bpm < 200) return 'Presto (176–200)';
  return 'Prestissimo (200+)';
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
