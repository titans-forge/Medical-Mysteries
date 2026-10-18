// Original schematic artwork. Reference illustrations never become case evidence.
const NS = 'http://www.w3.org/2000/svg';
let illustrationId = 0;
const SOURCE = {
  aorta: ['NHLBI · Aortic anatomy', 'https://www.nhlbi.nih.gov/news/2024/aortic-dissections-are-you-risk-heres-what-know'],
  neuro: ['NINDS · Stroke assessment and imaging', 'https://www.ninds.nih.gov/health-information/stroke/assess-and-treat'],
  descending: ['CDC · Botulism clinical features', 'https://www.cdc.gov/botulism/hcp/clinical-overview/'],
  metabolic: ['2024 hyperglycemic crises consensus', 'https://doi.org/10.2337/dci24-0032'],
  pelvic: ['ACOG · Ectopic pregnancy', 'https://www.acog.org/womens-health/faqs/ectopic-pregnancy'],
  mri: ['NINDS · Neurological diagnostic tests', 'https://www.ninds.nih.gov/health-information/disorders/neurological-diagnostic-tests-and-procedures'],
};
const definitions = {
  aortic_cta: {
    title: 'The aorta, in context', kicker: 'ANATOMY REFERENCE', source: SOURCE.aorta,
    description: 'Simplified anterior orientation: the aorta rises from the heart, curves through the arch and descends. A separate cross-section labels the vessel wall and lumen. No dissection or patient finding is drawn.',
    note: 'Orientation only. The drawing does not show a flap, a pressure difference or a scan result. Read the supplied report for this case.',
    svg: `<path d="M245 324 C204 270 216 222 256 231 C281 211 323 227 330 262 C351 298 306 333 282 356Z" fill="url(#$ID-tissue)" stroke="#c59087" stroke-width="2"/>
      <path d="M279 278 L279 166 C279 99 321 75 364 104 C398 127 405 161 405 210 L405 356" fill="none" stroke="#673f43" stroke-width="68" stroke-linecap="round"/>
      <path d="M279 278 L279 166 C279 99 321 75 364 104 C398 127 405 161 405 210 L405 356" fill="none" stroke="url(#$ID-vessel)" stroke-width="57" stroke-linecap="round"/>
      <path d="M279 278 L279 166 C279 99 321 75 364 104 C398 127 405 161 405 210 L405 356" fill="none" stroke="#e8b1a0" stroke-opacity=".42" stroke-width="11" stroke-linecap="round"/>
      <path d="M304 100 L289 60 M330 93 L334 45 M358 107 L379 58" fill="none" stroke="#bd7770" stroke-width="20" stroke-linecap="round"/>
      <path d="M304 100 L289 60 M330 93 L334 45 M358 107 L379 58" fill="none" stroke="#f0b9a6" stroke-width="8" stroke-linecap="round"/>
      <g class="guide-labels"><path d="M242 192 H144 M345 79 L415 52 H500 M437 275 H487 M262 329 H138"/><text x="46" y="186">Ascending aorta</text><text x="505" y="57">Arch branches</text><text x="493" y="280">Descending aorta</text><text x="46" y="334">Heart</text><text x="272" y="396">Anterior orientation · not to scale</text></g>
      <g transform="translate(632 181)"><circle r="58" fill="#8e5557" stroke="#d7a297" stroke-width="3"/><circle r="40" fill="url(#$ID-vessel)" stroke="#efb29e" stroke-width="3"/><g class="guide-labels"><path d="M-18 0 H-79 M46 38 L62 60"/><text x="-143" y="5">Lumen</text><text x="25" y="80">Wall</text><text x="-56" y="-80">Cross-section</text></g></g>`,
  },
  neuro_laterality: {
    title: 'Observe the change', kicker: 'OBSERVATION REFERENCE', source: SOURCE.neuro,
    description: 'A neutral front-facing figure labels the patient’s right and left, with face, arm movement and speech shown as separate observations. No side is marked weak and no brain lesion is assigned.',
    note: 'Face, arm movement and speech are separate observations. This neutral figure does not localize a lesion or establish the cause of a change.',
    svg: `<ellipse cx="389" cy="105" rx="44" ry="57" fill="url(#$ID-tissue)" stroke="#bf9f94" stroke-width="2"/>
      <path d="M353 91 Q389 47 425 91 M359 112 Q367 108 375 112 M402 112 Q410 108 418 112 M383 129 Q389 137 398 129 M378 145 Q390 150 403 145" fill="none" stroke="#936e65" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M370 159 L365 181 Q328 188 317 214 L292 303 Q294 320 310 312 L342 240 L345 347 L374 347 L387 276 L403 347 L433 347 L434 240 L467 312 Q484 320 485 303 L460 214 Q449 188 413 181 L409 159" fill="url(#$ID-body)" stroke="#80a6a5" stroke-width="2"/>
      <path d="M345 347 L340 390 M374 347 L378 390 M403 347 L400 390 M433 347 L439 390" stroke="#80a6a5" stroke-width="3"/>
      <g class="guide-labels"><path d="M349 107 H242 M320 261 H213 M428 140 H540"/><text x="97" y="110">Face</text><text x="61" y="264">Arm movement</text><text x="548" y="145">Speech / language</text><text x="192" y="370">Patient’s right</text><text x="494" y="370">Patient’s left</text></g>
      <g fill="#b9d5d0"><circle cx="566" cy="201" r="3"/><circle cx="581" cy="201" r="3"/><circle cx="596" cy="201" r="3"/></g><path d="M549 178 H613 Q624 178 624 189 V213 Q624 225 613 225 H574 L559 237 V225 H549 Q538 225 538 213 V189 Q538 178 549 178Z" fill="none" stroke="#80a6a5" stroke-width="2"/>`,
  },
  descending_weakness: {
    title: 'Describe the distribution', kicker: 'PATTERN REFERENCE', source: SOURCE.descending,
    description: 'A neutral front-facing figure connects cranial and bulbar function with upper-limb, trunk and respiratory muscle observations. A downward arrow denotes a possible descending pattern, not a patient timeline or a required order.',
    note: 'A descending pattern can begin with cranial nerve findings. The drawing is a general reference, not a prediction of this patient’s progression or timing.',
    svg: `<ellipse cx="332" cy="99" rx="40" ry="50" fill="url(#$ID-tissue)" stroke="#bd9e93" stroke-width="2"/>
      <path d="M312 145 L307 166 Q267 171 257 210 L239 300 L261 306 L286 228 L289 365 H318 L332 289 L347 365 H376 L379 228 L404 306 L426 300 L407 210 Q397 171 357 166 L352 145" fill="url(#$ID-body)" stroke="#80a6a5" stroke-width="2"/>
      <path d="M329 183 V295 M335 183 V295" stroke="#78b8b0" stroke-width="2" opacity=".5"/>
      <path d="M329 205 Q294 186 296 247 Q313 266 329 254 M335 205 Q370 186 368 247 Q351 266 335 254" fill="#5a8b86" fill-opacity=".4" stroke="#80a6a5" stroke-width="1.5"/>
      <path d="M182 81 V325 L172 310 M182 325 L192 310" fill="none" stroke="#d3b278" stroke-width="3"/>
      <g class="guide-labels"><path d="M375 96 H463 M407 213 H463 M378 277 H463"/><text x="482" y="91">Cranial / bulbar</text><text x="482" y="114" class="sub">Eye, speech, swallowing observations</text><text x="482" y="209">Upper limbs</text><text x="482" y="232" class="sub">Describe both sides separately</text><text x="482" y="274">Trunk / breathing muscles</text><text x="482" y="297" class="sub">Use the actual supplied observations</text><text x="135" y="367">Possible descending distribution</text></g>`,
  },
  metabolic_trends: {
    title: 'Read the pattern together', kicker: 'REPORT REFERENCE', source: SOURCE.metabolic,
    description: 'Separate report tiles represent glucose or diabetes history, ketones, acid-base and osmolality. Potassium is shown separately as an electrolyte measurement. There are no plotted values, invented trends or treatment response curves.',
    note: 'These are different components, not interchangeable tests. A missing value stays unknown. This guide plots no treatment response and adds no laboratory result.',
    svg: `<g fill="#192f32" stroke="#4e7473" stroke-width="1.5"><rect x="44" y="63" width="222" height="129" rx="16"/><rect x="289" y="63" width="222" height="129" rx="16"/><rect x="534" y="63" width="222" height="129" rx="16"/><rect x="44" y="230" width="344" height="123" rx="16"/><rect x="411" y="230" width="345" height="123" rx="16"/></g>
      <g fill="none" stroke="#bfaaa0" stroke-width="2.5"><g transform="translate(79 83)"><path d="M0 0 H25 L36 11 V39 H0Z M25 0 V11 H36 M8 19 H27 M8 28 H23"/></g><g transform="translate(324 83)"><path d="M0 0 H25 L36 11 V39 H0Z M25 0 V11 H36 M8 19 H27 M8 28 H23"/></g><g transform="translate(569 83)"><path d="M0 0 H25 L36 11 V39 H0Z M25 0 V11 H36 M8 19 H27 M8 28 H23"/></g><g transform="translate(79 250)"><path d="M0 0 H25 L36 11 V39 H0Z M25 0 V11 H36 M8 19 H27 M8 28 H23"/></g><g transform="translate(446 250)"><path d="M0 0 H25 L36 11 V39 H0Z M25 0 V11 H36 M8 19 H27 M8 28 H23"/></g></g>
      <g class="guide-labels"><text x="68" y="153">Glucose / diabetes</text><text x="68" y="176" class="sub">Include relevant history</text><text x="313" y="153">Ketones</text><text x="313" y="176" class="sub">A separate measured component</text><text x="558" y="153">Acid-base</text><text x="558" y="176" class="sub">pH / bicarbonate, if supplied</text><text x="68" y="317">Osmolality</text><text x="68" y="340" class="sub">Relevant to a hyperosmolar pattern</text><text x="435" y="317">Potassium</text><text x="435" y="340" class="sub">An electrolyte, not a substitute for the pattern</text></g>
      <path d="M155 204 V215 H645 V204 M400 204 V215" fill="none" stroke="#b7c9bd" stroke-width="2"/><text x="400" y="398" text-anchor="middle" fill="#9db8b1" font-size="17">Separate components · compare the supplied record</text>`,
  },
  pelvic_ultrasound: {
    title: 'Pelvic anatomy, in context', kicker: 'ANATOMY REFERENCE', source: SOURCE.pelvic,
    description: 'A simplified frontal pelvic anatomy diagram labels the uterus, fallopian tubes, ovaries and cervix. No ectopic mass, pregnancy location or free fluid is drawn.',
    note: 'Anatomical orientation only. This is not an ultrasound, and it does not depict a mass, pregnancy location or free fluid. Those findings require the actual supplied report.',
    svg: `<path d="M341 147 C320 126 278 122 258 137 C236 151 235 175 212 174 M459 147 C480 126 522 122 542 137 C564 151 565 175 588 174" fill="none" stroke="#8d6260" stroke-width="22" stroke-linecap="round"/>
      <path d="M341 147 C320 126 278 122 258 137 C236 151 235 175 212 174 M459 147 C480 126 522 122 542 137 C564 151 565 175 588 174" fill="none" stroke="#ce9b8a" stroke-width="13" stroke-linecap="round"/>
      <ellipse cx="222" cy="201" rx="33" ry="22" transform="rotate(-20 222 201)" fill="url(#$ID-tissue)" stroke="#c79d8a" stroke-width="2"/><ellipse cx="578" cy="201" rx="33" ry="22" transform="rotate(20 578 201)" fill="url(#$ID-tissue)" stroke="#c79d8a" stroke-width="2"/>
      <path d="M338 145 Q400 109 462 145 C489 198 455 249 421 288 L420 335 H380 L379 288 C345 249 311 198 338 145Z" fill="url(#$ID-tissue)" stroke="#d4a395" stroke-width="3"/>
      <path d="M350 160 Q400 143 450 160 Q430 198 410 238 L407 290 H393 L390 238 Q370 198 350 160Z" fill="#7f5455" stroke="#e0b19f" stroke-width="2"/>
      <g class="guide-labels"><path d="M290 135 L266 85 H157 M211 213 L171 247 H96 M454 217 L484 246 H638 M420 310 H536"/><text x="61" y="79">Fallopian tube</text><text x="60" y="268">Ovary</text><text x="650" y="251">Uterus</text><text x="547" y="315">Cervix</text><text x="282" y="391">Frontal orientation · not to scale</text></g>`,
  },
  brain_mri_grid: {
    title: 'Read the sequence labels', kicker: 'IMAGING REFERENCE', source: SOURCE.mri,
    description: 'Four illustrated MRI sequence cards are labeled T1, FLAIR, SWI and post-contrast. Each contains the same neutral brain outline rather than invented lesions. No images or results from this patient are represented.',
    note: 'Sequence labels identify different image acquisitions. These neutral outlines are not scans: they cannot show lesion location, hemorrhage or enhancement. Use the text report.',
    svg: ['T1', 'FLAIR', 'SWI', 'POST-CONTRAST'].map((label, index) => {
      const x = 48 + index % 2 * 366; const y = 48 + Math.floor(index / 2) * 175;
      return `<g transform="translate(${x} ${y})"><rect width="337" height="151" rx="14" fill="#192e31" stroke="#4f7777" stroke-width="1.5"/><g class="guide-labels"><text x="20" y="31" fill="#dfd7c8" font-size="18" font-weight="600">${label}</text></g><g transform="translate(48 16) scale(.72)"><path d="M171 42 C123 20 96 57 103 91 C88 131 144 147 171 124 C198 147 254 131 239 91 C246 57 219 20 171 42Z" fill="url(#$ID-body)" stroke="#9bb9af" stroke-width="2"/><path d="M171 43 V124 M118 69 Q132 53 154 67 M113 95 Q132 79 157 99 M224 69 Q210 53 188 67 M229 95 Q210 79 185 99" fill="none" stroke="#769c94" stroke-width="1.5"/></g><text x="20" y="135" fill="#a7bbb5" font-size="13">Illustrated outline · no patient image</text></g>`;
    }).join(''),
  },
};
definitions.scene_observation = definitions.neuro_laterality;

export function exhibitDefinition(kind) {
  const value = definitions[kind];
  return value ? { title: value.title, kicker: value.kicker, description: value.description, note: value.note, source: [...value.source] } : null;
}

// An explicit projection of the displayed stage only. Never inspect a case bank,
// visual_spec payload, hidden hotspots, future stages or stored session data.
export function currentExhibitFacts(stage = {}) {
  const facts = [];
  for (const [key, heading] of [['vitals', 'Vital'], ['clues', 'Clue'], ['observations', 'Observation']]) {
    for (const item of Array.isArray(stage[key]) ? stage[key] : []) {
      if (!item || typeof item !== 'object') continue;
      const text = [item.label, item.value, item.unit, item.finding, item.detail]
        .filter((value) => typeof value === 'string' || typeof value === 'number').map(String).filter((value) => value.trim()).join(' · ');
      if (text && !facts.some((fact) => fact.text === text)) facts.push({ heading, text });
    }
  }
  return facts;
}

function node(tag, className = '', text = '') {
  const value = document.createElement(tag); value.className = className; value.textContent = text; return value;
}

export function createGuideSvg(kind, labels = true) {
  const definition = definitions[kind];
  const id = `mm-guide-${++illustrationId}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 800 440'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', `${id}-title ${id}-description`);
  svg.classList.add('reference-illustration');
  svg.dataset.kind = kind;
  // Every interpolated token is a local constant; case text uses textContent below.
  svg.innerHTML = `<title id="${id}-title"></title><desc id="${id}-description"></desc><defs>
    <linearGradient id="${id}-tissue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e0b9a7"/><stop offset=".5" stop-color="#bc8a7e"/><stop offset="1" stop-color="#79595b"/></linearGradient>
    <linearGradient id="${id}-vessel" x1="0" y1="0" x2="1" y2=".6"><stop stop-color="#99575d"/><stop offset=".45" stop-color="#d69885"/><stop offset="1" stop-color="#9b5f60"/></linearGradient>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#537f7b"/><stop offset="1" stop-color="#233f43"/></linearGradient>
    <radialGradient id="${id}-back"><stop stop-color="#1d3739"/><stop offset="1" stop-color="#122528"/></radialGradient>
    </defs><rect width="800" height="440" rx="18" fill="url(#${id}-back)"/>
    <g fill="none" stroke="#7b9e98" opacity=".09"><path d="M40 40 H760 M40 400 H760 M40 40 V400 M760 40 V400"/></g>
    ${(definition?.svg || '').replaceAll('$ID', id)}`;
  svg.querySelector('title').textContent = definition?.title || 'Reference guide';
  svg.querySelector('desc').textContent = definition?.description || 'No reference diagram is supplied for this stage.';
  svg.classList.toggle('hide-guide-labels', !labels);
  return svg;
}

export function openVisualDialog({ title, build, returnFocus, scope = 'Illustrated reference · not a patient scan or case finding' }) {
  const dialog = node('dialog', 'reference-dialog');
  const titleId = `mm-visual-title-${++illustrationId}`;
  dialog.setAttribute('aria-labelledby', titleId);
  const heading = node('h2', '', title); heading.id = titleId;
  const close = node('button', 'quiet-button', 'Close enlarged view'); close.type = 'button';
  close.addEventListener('click', () => dialog.close());
  const header = node('div', 'reference-dialog-header'); header.append(heading, close);
  dialog.append(header, node('p', 'reference-dialog-scope', scope), build()); document.body.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); }, { once: true });
  dialog.showModal(); close.focus();
}

export function renderEducationalExhibit(spec = {}, stage = {}, { referenceOnly = false } = {}) {
  const definition = exhibitDefinition(spec?.kind);
  const root = node('section', 'synthetic-wrap educational-exhibit');
  root.dataset.exhibitKind = spec?.kind || 'none';
  if (!definition) return root;
  root.append(node('div', 'eyebrow', definition.kicker), node('h3', '', definition.title));
  const figure = node('figure', 'reference-figure');
  const svg = createGuideSvg(spec.kind);
  figure.append(svg, node('figcaption', 'control-help', 'Illustrated reference · not a patient scan or case finding'));
  const controls = node('div', 'exhibit-toolbar');
  const labels = node('button', 'quiet-button reference-label-toggle', 'Labels'); labels.type = 'button'; labels.setAttribute('aria-pressed', 'true');
  labels.addEventListener('click', () => {
    const show = labels.getAttribute('aria-pressed') !== 'true';
    labels.setAttribute('aria-pressed', String(show)); svg.classList.toggle('hide-guide-labels', !show);
  });
  const enlarge = node('button', 'quiet-button', 'Enlarge reference'); enlarge.type = 'button';
  enlarge.addEventListener('click', () => openVisualDialog({ title: definition.title, returnFocus: enlarge, build: () => {
    const content = node('div', 'reference-dialog-content');
    const scroll = node('div', 'reference-detail-scroll');
    scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Detailed reference diagram; scroll horizontally on a narrow screen');
    scroll.append(createGuideSvg(spec.kind, labels.getAttribute('aria-pressed') === 'true'));
    const fit = node('button', 'quiet-button', 'Fit entire diagram'); fit.type = 'button';
    fit.addEventListener('click', () => {
      const fitted = scroll.classList.toggle('fit-reference');
      fit.textContent = fitted ? 'Show full-size detail' : 'Fit entire diagram';
    });
    const help = node('p', 'reference-pan-help', 'Scroll or swipe sideways for detail, or fit the entire diagram.');
    content.append(help, fit, scroll, node('p', 'reference-note', definition.note)); return content;
  } }));
  controls.append(enlarge, labels);
  root.append(figure, controls, node('p', 'reference-note', definition.note));
  if (!referenceOnly) {
    const current = node('details', 'reference-facts');
    current.append(node('summary', '', 'Current-stage facts · separate from the illustration'));
    const facts = currentExhibitFacts(stage);
    if (!facts.length) current.append(node('p', '', 'No vitals, clues or examined observations are supplied in this displayed stage.'));
    else {
      const list = node('ul');
      for (const fact of facts) { const row = node('li'); row.append(node('span', 'reference-fact-type', fact.heading), document.createTextNode(fact.text)); list.append(row); }
      current.append(list);
    }
    root.append(current);
  }
  const sources = node('details', 'reference-sources'); sources.append(node('summary', '', 'Reference source'));
  const link = node('a', '', definition.source[0]); link.href = definition.source[1]; link.target = '_blank'; link.rel = 'noreferrer';
  sources.append(link, node('p', 'control-help', 'Source checked 17 October 2026. Original schematic artwork, not a reproduced medical image.'));
  root.append(sources);
  return root;
}
