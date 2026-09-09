import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {summarize, referenceState} from '../../gwadastats/data.js';
import {COPY} from '../../gwadastats/content.js';

const snapshot = JSON.parse(await readFile(new URL('../../gwadastats/data.json', import.meta.url), 'utf8'));
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const includesText = (html, value) => html.includes(value) || html.includes(escapeHTML(value));

assert(Number.isInteger(snapshot.year) && snapshot.year >= 2000, 'Valid common reference year');
assert(validDate(snapshot.reviewedAt), 'Valid review date');
assert(snapshot.reviewedAt <= new Date().toISOString().slice(0, 10), 'Review date cannot be in the future');
for (const category of ['homicides', 'roads']) {
  const item = snapshot[category];
  assert(item && Number.isSafeInteger(item.count) && item.count >= 0, `${category}: valid count`);
  for (const field of ['asOf', 'publishedAt', 'updatedAt']) {
    assert(validDate(item[field]), `${category}: valid ${field}`);
    assert(item[field] <= snapshot.reviewedAt, `${category}: ${field} is no later than the actual review`);
  }
  assert.equal(Number(item.asOf.slice(0, 4)), snapshot.year, `${category}: same reference year`);
  assert(item.asOf <= item.updatedAt, `${category}: cutoff is no later than the report revision`);
  assert(item.publishedAt <= item.updatedAt, `${category}: revision follows publication`);
  if (item.checkedAt !== undefined) {
    assert(validDate(item.checkedAt), `${category}: valid successful check date`);
    assert(item.updatedAt <= item.checkedAt, `${category}: check follows the source revision`);
    assert(item.checkedAt <= snapshot.reviewedAt, `${category}: check is no later than the latest successful category check`);
  }
  assert.equal(typeof item.publisher, 'string', `${category}: publisher text`);
  assert(item.publisher.trim(), `${category}: publisher is named`);
  const url = new URL(item.source);
  assert.equal(url.protocol, 'https:', `${category}: public HTTPS source`);
  assert(url.hostname && !url.username && !url.password, `${category}: source without credentials`);
}

const summary = summarize(snapshot);
assert.deepEqual(summary, {
  total: snapshot.homicides.count + snapshot.roads.count,
  year: snapshot.year,
  homicides: snapshot.homicides.count,
  roads: snapshot.roads.count,
});
assert(Number.isSafeInteger(summary.total), 'Safe combined total');
for (const category of ['homicides', 'roads']) {
  const mutateCheck = checkedAt => ({...snapshot, [category]:{...snapshot[category], checkedAt}});
  const beforeRevision = new Date(Date.parse(snapshot[category].updatedAt + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
  const afterReview = new Date(Date.parse(snapshot.reviewedAt + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  for (const checkedAt of [null, 'bad', `${snapshot.year}-02-30`, beforeRevision, afterReview]) {
    assert.throws(() => summarize(mutateCheck(checkedAt)), /Invalid category check date/, `${category}: reject invalid check ${checkedAt}`);
  }
  assert.deepEqual(summarize(mutateCheck(undefined)), summary, `${category}: legacy record without checkedAt remains readable`);
}
const rolloverYear = snapshot.year + 1;
assert.equal(referenceState(new Date(`${rolloverYear}-01-01T03:59:59Z`), snapshot.year), 'current');
assert.equal(referenceState(new Date(`${rolloverYear}-01-01T04:00:00Z`), snapshot.year), 'archive');

for (const locale of ['fr', 'en']) {
  const modal = COPY[locale].modal(summary, snapshot);
  assert(!/\b(?:undefined|NaN|Invalid Date)\b/.test(modal), `${locale}: all fields render`);
  assert(modal.includes(`${summary.homicides} homicides + ${summary.roads}`), `${locale}: component counts render`);
  assert(modal.includes(`= ${summary.total}`), `${locale}: derived total renders`);
  for (const category of ['homicides', 'roads']) {
    assert(includesText(modal, snapshot[category].source), `${locale}: ${category} source link`);
    assert(includesText(modal, snapshot[category].publisher), `${locale}: ${category} attribution`);
    const date = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      day:'numeric', month:'long', year:'numeric', timeZone:'America/Guadeloupe',
    }).format(new Date(snapshot[category].asOf + 'T12:00:00Z'));
    assert(modal.includes(date), `${locale}: ${category} source cutoff`);
  }
  const credit = modal.match(/<p class="credit">([\s\S]*?)<\/p>/)?.[1];
  assert(credit, `${locale}: source-check credit exists`);
  for (const category of ['homicides', 'roads']) {
    const check = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      day:'numeric', month:'long', year:'numeric', timeZone:'America/Guadeloupe',
    }).format(new Date((snapshot[category].checkedAt ?? snapshot.reviewedAt) + 'T12:00:00Z'));
    assert(credit.includes(check), `${locale}: ${category} successful check date renders`);
  }
  assert(!modal.includes('<details'), `${locale}: environmental context stays visible`);
}

// A successful road check must not make a stale homicide check look current.
const independentChecks = {...snapshot, reviewedAt:`${snapshot.year}-12-31`};
for (const [category, day] of [['homicides','30'], ['roads','31']]) {
  independentChecks[category] = {...snapshot[category], asOf:`${snapshot.year}-01-01`, publishedAt:`${snapshot.year}-01-01`, updatedAt:`${snapshot.year}-01-01`, checkedAt:`${snapshot.year}-12-${day}`};
}
for (const locale of ['fr','en']) {
  const credit = COPY[locale].modal(summarize(independentChecks),independentChecks).match(/<p class="credit">([\s\S]*?)<\/p>/)[1];
  for (const category of ['homicides','roads']) {
    const check = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {day:'numeric',month:'long',year:'numeric',timeZone:'America/Guadeloupe'}).format(new Date(independentChecks[category].checkedAt + 'T12:00:00Z'));
    assert(credit.includes(check), `${locale}: independent ${category} check is preserved in the credit`);
  }
}
console.log(`PASS: record structure, independent category checks, source dates, FR/EN rendering and year rollover. ${summary.year}: ${summary.homicides} + ${summary.roads} = ${summary.total}; latest successful check ${snapshot.reviewedAt}.`);
