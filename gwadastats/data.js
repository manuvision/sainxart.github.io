function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T12:00:00Z')) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}

export function summarize(snapshot) {
  if (!Number.isInteger(snapshot?.year) || snapshot.year < 2000 || snapshot.year > 9999) throw new Error('Invalid reference year');
  if (!isDate(snapshot.reviewedAt)) throw new Error('Invalid review date');
  for (const key of ['homicides', 'roads']) {
    const item = snapshot[key];
    if (!Number.isSafeInteger(item?.count) || item.count < 0) throw new Error('Invalid death count');
    if (!isDate(item.asOf) || Number(item.asOf.slice(0, 4)) !== snapshot.year || item.asOf > snapshot.reviewedAt) {
      throw new Error('Invalid source cutoff');
    }
    if (!isDate(item.publishedAt) || !isDate(item.updatedAt) || item.publishedAt > item.updatedAt ||
        item.updatedAt > snapshot.reviewedAt || item.asOf > item.updatedAt) throw new Error('Invalid publication dates');
    if (typeof item.publisher !== 'string' || !item.publisher.trim()) throw new Error('Missing publisher');
    const url = new URL(item.source);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Missing public source');
  }
  const total = snapshot.homicides.count + snapshot.roads.count;
  if (!Number.isSafeInteger(total)) throw new Error('Invalid death total');
  return {total, year: snapshot.year, homicides: snapshot.homicides.count, roads: snapshot.roads.count};
}

export function referenceState(now = new Date(), year) {
  const localYear = Number(new Intl.DateTimeFormat('en', {timeZone: 'America/Guadeloupe', year: 'numeric'}).format(now));
  return localYear === year ? 'current' : 'archive';
}
