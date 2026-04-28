// Chamber-flavored deliberation status messages — rotated client-side
// while the LLM works.

const COMMITTEE_PREFIX = [
  "The matter is crossing chambers.",
  "A committee is forming.",
  "Witnesses are being called.",
];

const PER_CHAMBER = {
  senate: [
    "The roll is being called.",
    "Lincoln rises to speak.",
    "Churchill paces the floor.",
    "Aurelius writes in his journal.",
    "Burke considers the institution.",
    "The Senate is weighing the cost.",
  ],
  boardroom: [
    "The boardroom doors close.",
    "Buffett opens the ledger.",
    "Munger inverts the question.",
    "Jobs studies the artifact.",
    "Drucker maps the system.",
    "The Boardroom is conferring.",
  ],
  courtroom: [
    "The hearth is lit.",
    "Berry walks the field.",
    "Brown names the unspoken.",
    "Frankl listens for meaning.",
    "The Court Room is in private session.",
  ],
  council: [
    "The candles are lit.",
    "Aquinas consults the Summa.",
    "Lewis writes in the margins.",
    "Bonhoeffer prays.",
    "Mother Teresa is silent.",
    "The Council is at prayer.",
  ],
  forge: [
    "The iron is heating.",
    "Witnesses are convening.",
    "Hammers are raised.",
    "The seam is closing.",
    "The Integrator is at work.",
    "The verdict is taking shape.",
  ],
};

export function getChamberMessages(chamberId, isCommittee = false) {
  const base = PER_CHAMBER[chamberId] || PER_CHAMBER.forge;
  if (isCommittee && chamberId !== "forge") {
    return [...COMMITTEE_PREFIX, ...base];
  }
  return base;
}

export const CONVENING_MESSAGES = [
  "Convening.",
  "Reading the question.",
  "Considering the matter at hand.",
];
