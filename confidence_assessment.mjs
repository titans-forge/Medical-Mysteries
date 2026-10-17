// Presentation only. Scores and counts come from the game engine; this module
// does not invent calibration grades or use score thresholds to rank learners.
const inRange = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const countValue = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const metricValue = (value, low, high) => inRange(value, low, high) ? value : null;
const objectValue = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const noun = (count, singular, plural = `${singular}s`) => count === 1 ? singular : plural;
const points = (value) => Number(value.toFixed(1)).toString();

/**
 * Accepts engine-shaped calibration fields and optional stage_autopsy rows.
 * All metric inputs must be finite numbers in their documented ranges. The
 * aggregate sample_count is authoritative when valid. Stage counts are a
 * visibly identified fallback, never a replacement for a supplied count.
 * Stage first_try means the first response matched the authored answer.
 */
export function assessConfidenceRecord(input = {}) {
  const source = objectValue(input);
  const calibration = objectValue(source.calibration);
  const hasStages = Array.isArray(source.stages);
  const stages = hasStages ? source.stages.filter((stage) => stage && typeof stage === 'object' && !Array.isArray(stage)) : [];
  const recordedStages = stages.filter((stage) => inRange(stage.confidence, 0, 100));
  const reportedCount = countValue(calibration.sample_count);
  const sampleCount = reportedCount ?? (hasStages && stages.length > 0 ? recordedStages.length : null);
  const countSource = reportedCount !== null ? 'calibration' : sampleCount !== null ? 'stages' : 'unavailable';
  // A score without any recorded responses has no interpretable basis.
  const brierScore = sampleCount === 0 ? null : metricValue(calibration.brier_score, 0, 1);
  const bias = sampleCount === 0 ? null : metricValue(calibration.calibration_bias, -1, 1);
  const meanConfidenceError = sampleCount === 0 ? null : metricValue(calibration.mean_confidence_error, 0, 100);
  const missingCount = hasStages ? stages.length - recordedStages.length : null;
  const inconsistentCount = reportedCount !== null && stages.length > 0 && reportedCount !== recordedStages.length;
  const direction = bias === null ? 'unavailable' : bias > 0 ? 'above' : bias < 0 ? 'below' : 'equal';

  const countLabel = sampleCount === null ? 'Recorded first-response count unavailable'
    : `${sampleCount} recorded first ${noun(sampleCount, 'response')}`;
  const summaryParts = [countLabel];
  if (brierScore !== null) summaryParts.push(`Brier ${brierScore.toFixed(3)}`);
  else summaryParts.push('Brier unavailable');
  if (sampleCount === 1) summaryParts.push('Small sample; descriptive only');
  else if (sampleCount > 1) summaryParts.push('Limited sample; descriptive only');
  else if (sampleCount === null) summaryParts.push('Sample size unavailable');

  const lines = [];
  if (sampleCount === null) lines.push('The number of first responses with recorded confidence is unavailable.');
  else if (sampleCount === 0) lines.push('No first-response confidence values were recorded.');
  else lines.push(`Confidence was recorded for ${sampleCount} first ${noun(sampleCount, 'response')}.`);
  if (countSource === 'stages') lines.push('This count comes from the supplied stage record because the engine sample count is unavailable.');
  if (missingCount > 0) lines.push(`${missingCount} of ${stages.length} supplied ${noun(stages.length, 'stage')} ${noun(missingCount, 'has', 'have')} no usable confidence value; those values are not treated as zero.`);
  if (inconsistentCount) lines.push(`The engine reports ${reportedCount} recorded first ${noun(reportedCount, 'response')}, while ${recordedStages.length} supplied ${noun(recordedStages.length, 'stage')} ${noun(recordedStages.length, 'has', 'have')} a usable confidence value. These counts differ, so the available evidence is incomplete or inconsistent.`);
  if (brierScore !== null) {
    lines.push(`Brier score: ${brierScore.toFixed(3)} (0–1). Lower scores mean confidence was closer to the recorded first-response outcomes. The score is the mean squared difference between confidence as a probability and whether the response matched the authored answer; differences can come from confidence above or below the observed outcome.`);
  } else lines.push('Brier score is unavailable for this record.');
  if (bias !== null) {
    if (direction === 'equal') lines.push('Average confidence equaled the proportion of first responses matching the authored answer in this record; differences in opposite directions can cancel.');
    else lines.push(`Average confidence was ${points(Math.abs(bias) * 100)} percentage points ${direction} the proportion of first responses matching the authored answer in this record; this is an average direction, not a learner rating.`);
  } else lines.push('Average confidence direction is unavailable.');
  if (meanConfidenceError !== null) lines.push(`Mean absolute confidence difference: ${points(meanConfidenceError)} percentage points.`);

  const caveat = sampleCount === 0 ? 'Without recorded confidence values, no confidence pattern can be described.'
    : sampleCount === 1 ? 'Small sample: one recorded response cannot establish a stable confidence pattern.'
      : sampleCount === null ? 'The sample size is unavailable, so the scope of these metrics cannot be assessed.'
        : 'Limited sample: these values describe only the recorded game responses and do not establish a stable or general confidence pattern.';
  lines.push(caveat);

  const stageDetails = stages.map((stage, index) => {
    const confidence = metricValue(stage.confidence, 0, 100);
    const error = metricValue(stage.confidence_error, 0, 100);
    const outcome = typeof stage.first_try === 'boolean' ? stage.first_try : null;
    const stageNumber = countValue(stage.stage_number) > 0 ? stage.stage_number : index + 1;
    const label = `I${stageNumber}`;
    const stageDirection = confidence === null || outcome === null ? 'unavailable'
      : confidence === (outcome ? 100 : 0) ? 'equal' : outcome ? 'below' : 'above';
    const parts = confidence === null ? [`${label}: confidence not recorded or invalid`]
      : [`${label}: ${points(confidence)}% confidence`];
    if (confidence !== null && outcome !== null) parts.push(outcome ? 'first response matched the authored answer' : 'first response did not match the authored answer');
    if (error !== null && confidence !== null) parts.push(`absolute confidence difference ${points(error)} percentage points`);
    return { stageNumber, confidence, error: confidence === null ? null : error, outcome, direction: stageDirection, summary: parts.join(' · ') };
  });

  return { title: 'Confidence record', summary: summaryParts.join(' · '), detail: lines.join(' '), lines,
    sampleCount, countSource, recordedStageCount: hasStages ? recordedStages.length : null,
    missingCount, brierScore, bias, meanConfidenceError, direction, inconsistentCount, caveat, stageDetails };
}

/** Convenience adapter for the engine's completion response. */
export function assessResultConfidence(result = {}) {
  const value = objectValue(result);
  const calibration = value.clinical_autopsy?.calibration ?? value.reasoning_autopsy?.calibration;
  return assessConfidenceRecord({ calibration, ...(Array.isArray(value.stage_autopsy) ? { stages: value.stage_autopsy } : {}) });
}
