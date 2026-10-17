import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITES = [
  ['Harbor', 900],
  ['Mill', 800],
  ['Orchard', 750],
  ['Ridge', 700],
  ['Station', 850],
  ['Wharf', 820],
];
const ROOMS = ['Maple', 'Cedar', 'Birch', 'Alder'];
const FIRST = ['An', 'Bo', 'Cai', 'Dee', 'Eli', 'Fay', 'Gia', 'Ho', 'Ivy', 'Jin', 'Kai', 'Lee', 'Mo', 'Nia', 'Owen', 'Pia', 'Quin', 'Ren', 'Sol', 'Tai', 'Uma', 'Vin', 'Wynn', 'Xen', 'Yara', 'Zed'];
const SECOND = ['Ash', 'Brook', 'Cole', 'Dale', 'Elm', 'Frost', 'Glen', 'Hart', 'Isle', 'Jay', 'Kirk', 'Lane'];
const HEADER = 'learner_id,learner,site,room,programme,fee_type,status,fee_month,amount';

function months() {
  const values = [];
  for (let month = 1; month <= 12; month += 1) values.push(`2024-${String(month).padStart(2, '0')}-01`);
  for (let month = 1; month <= 6; month += 1) values.push(`2025-${String(month).padStart(2, '0')}-01`);
  return values;
}

export function buildCsv() {
  const lines = [HEADER];
  const monthList = months();
  let learnerIndex = 0;
  for (const [site, base] of SITES) {
    for (const room of ROOMS) {
      for (let slot = 0; slot < 12; slot += 1) {
        const learnerId = `L${String(learnerIndex + 1).padStart(4, '0')}`;
        const learner = `${FIRST[learnerIndex % 26]} ${SECOND[Math.floor(learnerIndex / 26)]}`;
        const programme = slot % 2 === 0 ? 'Weekday care' : 'After school';
        const tuition = base + (programme === 'After school' ? -200 : 0);
        const meals = programme === 'Weekday care' ? 120 : 40;
        monthList.forEach((feeMonth, monthIndex) => {
          const status = (learnerIndex + monthIndex) % 17 === 0 ? 'Open' : 'Paid';
          const fees = [
            ['Tuition', tuition],
            ['Meals', meals],
            ['Materials', 35],
          ];
          for (const [feeType, amount] of fees) {
            lines.push([learnerId, learner, site, room, programme, feeType, status, feeMonth, amount].join(','));
          }
        });
        learnerIndex += 1;
      }
    }
  }
  return `${lines.join('\n')}\n`;
}

const ranAsScript = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (ranAsScript) {
  const target = resolve('public/demo/fee_lines.csv');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, buildCsv());
}
