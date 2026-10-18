import { renderEducationalExhibit, openVisualDialog } from './educational_exhibits.mjs';

const VISUALS = {
  'doc-002-tearing-back-investigation': {
    image: './assets/scene-refresh-2026-10/night-shift-1536.webp',
    imageAlt: 'AI-generated fictional scene: an older adult and two clinicians talking in an emergency assessment bay. Atmosphere only, not patient evidence.',
    kind: 'aortic_cta',
  },
  'pub-003-missed-turn-investigation': {
    image: './assets/scene-refresh-2026-10/missed-turn-1536.webp',
    imageAlt: 'AI-generated fictional scene: a seated older adult at dinner while a family member speaks on a phone. Atmosphere only, not patient evidence.',
    kind: 'neuro_laterality',
  },
  'stu-003-after-weekend-investigation': {
    image: './assets/scene-refresh-2026-10/after-weekend-1536.webp',
    imageAlt: 'AI-generated fictional scene: a young adult talking with a nurse and student in a hospital observation room. Atmosphere only, not patient evidence.',
    kind: 'metabolic_trends',
  },
};

export function investigationVisual(episode, presentation = {}) {
  const visual = episode?.version >= 5 ? VISUALS[episode.familyId || episode.id] : null;
  return visual ? { ...presentation, ...visual } : { ...presentation };
}

function node(tag, className = '', text = '') {
  const value = document.createElement(tag); value.className = className; value.textContent = text; return value;
}

export function investigationScene(presentation, title) {
  const figure = node('figure', 'investigation-scene');
  const image = node('img'); image.src = presentation.image; image.alt = presentation.imageAlt;
  image.width = 1536; image.height = 1024; image.decoding = 'async';
  const enlarge = node('button', 'image-button investigation-scene-button'); enlarge.type = 'button';
  enlarge.setAttribute('aria-label', `Enlarge scene · ${title}`);
  enlarge.addEventListener('click', () => openVisualDialog({ title: `${title} · fictional scene`, scope: 'AI-generated fictional scene · atmosphere only, not case evidence', returnFocus: enlarge, build: () => {
    const content = node('figure', 'reference-dialog-content');
    const detail = node('img', 'reference-scene-detail'); detail.src = presentation.image; detail.alt = presentation.imageAlt;
    content.append(detail, node('figcaption', 'control-help', 'AI-generated fictional scene · atmosphere only, not case evidence')); return content;
  } }));
  enlarge.append(image, node('span', 'scene-enlarge-label', 'Enlarge scene ↗'));
  figure.append(enlarge, node('figcaption', 'control-help', 'AI-generated scene · not case evidence'));
  return figure;
}

export function investigationReference(presentation) {
  if (!presentation.kind) return null;
  const reference = node('details', 'investigation-reference');
  reference.append(node('summary', '', 'Reference desk · anatomy and report guide'));
  reference.append(renderEducationalExhibit({ kind: presentation.kind }, {}, { referenceOnly: true }));
  return reference;
}

export function workboardSnapshot(care) {
  const snapshot = node('div', 'care-evidence-snapshot');
  snapshot.setAttribute('aria-label', 'Report status summary');
  for (const [status, label] of [['pending', 'In progress'], ['available', 'Available'], ['reviewed', 'Reviewed']]) {
    const count = care.tasks.filter((task) => task.status === status).length;
    const value = node('div', `snapshot-count snapshot-${status}`);
    value.append(node('strong', '', String(count)), node('span', '', label)); snapshot.append(value);
  }
  snapshot.append(node('p', 'control-help', 'Available reports enter your evidence only when you review them.'));
  return snapshot;
}
