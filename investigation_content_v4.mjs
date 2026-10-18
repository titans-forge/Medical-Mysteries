// Exact shipped 0.7 definitions, captured before the 0.8 coordination revision.
const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const V4_INVESTIGATION_CONTENT = freeze([
  {
    "episode": {
      "id": "doc-002-tearing-back-investigation",
      "version": 4,
      "careWorkflow": {
        "episodeId": "doc-002-tearing-back-investigation",
        "version": 1,
        "role": {
          "label": "Doctor coordinating the ED team",
          "boundary": "Coordinate concern, task owners and review; treatment and patient outcomes are outside this exercise."
        },
        "timingNote": "Fictional update rounds release reports and narrative events. They are not minutes, recommended waits or a prescribed clinical sequence.",
        "priority": {
          "prompt": "Who needs the opening concern before its cause is settled?",
          "choices": [
            {
              "id": "share-opening-concern",
              "label": "Share sudden chest discomfort with the ed senior clinician and confirm who accepts review.",
              "appropriate": true,
              "feedback": "Communicate the concern and uncertainty early; a diagnostic label is not required to name a review owner.",
              "requires": []
            },
            {
              "id": "finish-record-before-contact",
              "label": "Collect the remaining reports first, then ask the ed senior clinician to accept the complete explanation.",
              "appropriate": false,
              "feedback": "A fuller record may refine the explanation. It does not replace early shared awareness and responsibility for the presenting concern.",
              "requires": []
            }
          ]
        },
        "tasks": {
          "symptom-timeline": {
            "owner": "ED history-taking clinician",
            "label": "Follow up: symptom timeline",
            "rounds": 1
          },
          "focused-examination": {
            "owner": "ED examining clinician",
            "label": "Follow up: focused examination",
            "rounds": 1
          },
          "ecg": {
            "owner": "ECG reporting clinician",
            "label": "Follow up: ecg report",
            "rounds": 1
          },
          "chest-radiograph": {
            "owner": "Radiology reporting clinician",
            "label": "Follow up: chest radiograph",
            "rounds": 2
          },
          "aortic-cta": {
            "owner": "ED senior clinician",
            "label": "Follow up: aortic cta report",
            "rounds": 2
          },
          "specialist-handoff": {
            "owner": "ED senior clinician",
            "label": "Follow up: specialist handoff",
            "rounds": 1
          }
        },
        "reassessment": {
          "minimumReviewed": 1,
          "update": "Fictional team checkpoint: identify what you reviewed, what remains pending and who accepts the next review. This checkpoint supplies no additional examination or laboratory finding.",
          "prompt": "What does the next review need from you?",
          "choices": [
            {
              "id": "review-after-worklist",
              "label": "Wait for the worklist to finish, then ask the ed senior clinician to review one final summary.",
              "appropriate": false,
              "feedback": "The concern needs an owner while work continues. A final summary cannot replace an accepted next review now.",
              "requires": []
            },
            {
              "id": "review-known-and-pending",
              "label": "Separate reviewed from pending information and confirm that the ed senior clinician owns the next review.",
              "appropriate": true,
              "feedback": "Report availability and clinical ownership are different. Bring the actual evidence and remaining question to the named receiver.",
              "requires": []
            }
          ],
          "variants": [
            {
              "id": "ecg-interpretation",
              "requires": [
                "ecg"
              ],
              "prompt": "What does the small, nonspecific ECG change add?",
              "choices": [
                {
                  "id": "reassess-ecg-limited",
                  "label": "Include it as a limited finding; the ECG alone settles neither a coronary cause nor the aortic question.",
                  "appropriate": true,
                  "feedback": "Keep this report within its scope, even if other reviewed evidence supports a stronger conclusion.",
                  "requires": []
                },
                {
                  "id": "reassess-ecg-coronary",
                  "label": "Prioritize a confirmed coronary explanation; use the remaining reports mainly to define its extent.",
                  "appropriate": false,
                  "feedback": "The supplied ECG is nonspecific and does not establish a coronary cause or remove the aortic concern.",
                  "requires": []
                }
              ]
            }
          ]
        },
        "handoff": {
          "receiver": {
            "prompt": "Who accepts this concern?",
            "choices": [
              {
                "id": "worklist-receiver",
                "label": "The shared results worklist, with the next reader deciding who receives the concern.",
                "appropriate": false,
                "feedback": "A worklist records tasks; it does not show who accepted responsibility.",
                "requires": []
              },
              {
                "id": "named-clinical-receiver",
                "label": "The ED senior coordinating this assessment.",
                "appropriate": true,
                "feedback": "Name the clinical receiver and verify acceptance of the concern.",
                "requires": []
              }
            ]
          },
          "situation": {
            "prompt": "Which known fact will you carry forward?",
            "choices": [
              {
                "id": "opening-concern",
                "label": "A 61-year-old arrived with sudden severe chest discomfort and an incomplete handoff.",
                "appropriate": true,
                "feedback": "This is an opening fact, available for an early handoff. Add the actual reviewed and pending information to the shared record.",
                "requires": []
              },
              {
                "id": "reviewed-cta",
                "label": "The reviewed CTA describes an ascending-aortic intimal flap extending into the arch.",
                "appropriate": true,
                "feedback": "Carry the actual report wording, rather than replacing it with a broader diagnosis or exclusion claim.",
                "requires": [
                  "aortic-cta"
                ]
              },
              {
                "id": "opening-establishes-cause",
                "label": "The initial chest discomfort establishes a coronary cause; hand over the other reports as secondary details.",
                "appropriate": false,
                "feedback": "The opening observation does not establish that cause. Keep what happened separate from the explanation.",
                "requires": []
              }
            ]
          },
          "uncertainty": {
            "prompt": "Which limit belongs with that statement?",
            "choices": [
              {
                "id": "confirmation-before-handoff",
                "label": "Hold the handoff until a single cause is confirmed, so the receiver gets no unresolved question.",
                "appropriate": false,
                "feedback": "An unresolved question belongs in an early handoff. It should have a named clinical receiver, not be silently withheld.",
                "requires": []
              },
              {
                "id": "cta-scope",
                "label": "The CTA supports the aortic finding here; it does not settle every subsequent care decision.",
                "appropriate": true,
                "feedback": "The handoff should preserve the specific report finding and its scope.",
                "requires": [
                  "aortic-cta"
                ]
              },
              {
                "id": "opening-scope",
                "label": "The opening symptoms alone do not establish a cause; stronger claims must cite reviewed findings.",
                "appropriate": true,
                "feedback": "This limits the opening account without pretending later reports are still unknown.",
                "requires": []
              }
            ]
          },
          "nextOwner": {
            "prompt": "Who follows up the remaining concern?",
            "choices": [
              {
                "id": "named-next-review",
                "label": "Confirm the ed senior clinician owns the next review and how new reports or symptom changes reach them.",
                "appropriate": true,
                "feedback": "Identify an accountable receiver and an update route. This assigns communication responsibility, not treatment.",
                "requires": []
              },
              {
                "id": "task-implies-transfer",
                "label": "Use the completed request as the transfer of responsibility; the receiving worklist can assign the next review.",
                "appropriate": false,
                "feedback": "A sent request is not evidence that another person accepted the concern or the next review.",
                "requires": []
              }
            ]
          }
        },
        "readback": {
          "prompt": "Which reply can you verify to close the loop?",
          "choices": [
            {
              "id": "worklist-acknowledgment",
              "label": "“I can see the request in the worklist. The next person reading the results can arrange further review.”",
              "appropriate": false,
              "feedback": "The concern and accountable next reviewer have not been repeated or accepted. Ask the receiver to clarify them.",
              "requires": []
            },
            {
              "id": "specific-readback",
              "label": "“I heard the sudden chest discomfort concern. I accept the next review; repeat what is reviewed and what needs follow-up.”",
              "appropriate": true,
              "feedback": "Check the repeated concern, known findings and owner against your message; correct a mismatch before closing the loop.",
              "requires": []
            }
          ]
        },
        "sources": [
          {
            "title": "WHO Emergency Care Toolkit: Interagency Integrated Triage Tool",
            "url": "https://www.who.int/teams/integrated-health-services/clinical-services-and-systems/emergency-and-critical-care/emergency-care-toolkit",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Prioritizing clinical concern separately from establishing a diagnosis. These role-specific exercises do not implement or validate a triage scale."
          },
          {
            "title": "NICE CG50: recognising and responding to deterioration",
            "url": "https://www.nice.org.uk/guidance/CG50/chapter/recommendations",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Clinical concern, response ownership and reassessment. No physiological thresholds, observation intervals or treatment instructions are introduced."
          },
          {
            "title": "AHRQ TeamSTEPPS: Handoff",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Communicating known information, uncertainty, responsibility and contingencies, with acknowledgment by the receiver. The scripted handoffs are fictional examples."
          },
          {
            "title": "AHRQ TeamSTEPPS: Check-Back (or Repeat-Back)",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/checkback.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Receiver repetition followed by sender verification, including family communication. An acknowledgment does not establish a diagnosis or complete pending tasks."
          }
        ],
        "reviewProvenance": {
          "status": "unreviewed",
          "ownerReportedPriorClinicianReview": true,
          "priorReviewScope": "unverified",
          "priorReviewVersion": "unverified",
          "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
        },
        "workboardPrompt": "Choose work to follow up; reports may arrive together.",
        "patientUpdates": [
          {
            "id": "pain-change",
            "afterRound": 1,
            "requiresReviewed": [],
            "text": "Authored fictional change after arrival: the patient tells the bedside nurse that the chest pain feels worse than at the opening handoff. No new vital signs or examination findings are supplied.",
            "prompt": "How should this reported change reach the team?",
            "choices": [
              {
                "id": "communicate-change",
                "label": "Tell the ED senior the patient reports worse pain, distinguish it from reviewed reports, and confirm who accepts reassessment.",
                "appropriate": true,
                "feedback": "Communicate the actual reported change and confirm a clinical owner. It neither establishes the cause nor predicts the outcome.",
                "requires": []
              },
              {
                "id": "defer-change-to-summary",
                "label": "Record the worse-pain report for the final handoff and wait for the outstanding report batch before flagging the change.",
                "appropriate": false,
                "feedback": "The new concern needs to reach the responsible clinician with its full detail. A pending report or one improved feature does not replace that communication.",
                "requires": []
              }
            ]
          }
        ]
      },
      "title": "The Night Shift",
      "subtitle": "Follow the concern. Review the record. Hand it over.",
      "opening": "A 61-year-old arrives with sudden severe chest discomfort. The team is already arranging urgent assessment. The initial handoff is incomplete.",
      "disclaimer": "Educational fiction pending human review. Reports, changes and update rounds are authored; they are not clinical advice or patient outcomes.",
      "hypotheses": [
        {
          "id": "acute-aortic-syndrome",
          "label": "Acute aortic syndrome"
        },
        {
          "id": "acute-coronary-syndrome",
          "label": "Acute coronary syndrome"
        },
        {
          "id": "pulmonary-embolism",
          "label": "Pulmonary embolism"
        },
        {
          "id": "cause-unresolved",
          "label": "Cause not established by this record"
        }
      ],
      "sources": [
        {
          "title": "2022 ACC/AHA Guideline for the Diagnosis and Management of Aortic Disease",
          "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10784847/"
        },
        {
          "title": "2022 ACC/AHA Aortic Disease Guideline: CT image quality",
          "url": "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001106",
          "scope": "Motion affects root and ascending-aortic image quality and diagnostic confidence. A segment explicitly reported as nondiagnostic cannot support exclusion or confirmation. No care protocol is authored.",
          "checkedDate": "2026-10-16"
        }
      ],
      "actions": [
        {
          "id": "symptom-timeline",
          "label": "Symptom timeline",
          "category": "history",
          "minutes": 4,
          "requires": [],
          "finding": "Authored fictional history: abrupt chest pain was maximal at onset and moved through to the back.",
          "interpretation": "The onset and radiation are high-risk features, but they do not identify one diagnosis by themselves.",
          "sourceIds": [
            0
          ]
        },
        {
          "id": "focused-examination",
          "label": "Focused examination",
          "category": "examination",
          "minutes": 6,
          "requires": [],
          "finding": "Authored fictional measurement: arm pressures are 178/105 on the right and 142/88 on the left; the difference is reproducible.",
          "interpretation": "The fictional inter-arm difference increases concern for an aortic process and keeps premature coronary anchoring unsafe.",
          "sourceIds": [
            0
          ]
        },
        {
          "id": "ecg",
          "label": "ECG report",
          "category": "cardiac",
          "minutes": 5,
          "requires": [],
          "finding": "Authored fictional tracing: a small, nonspecific ST change is present in aVL without a complete diagnostic pattern.",
          "interpretation": "This finding keeps acute coronary syndrome in the differential but is not decisive and cannot erase the aortic warning signs.",
          "sourceIds": [
            0
          ]
        },
        {
          "id": "chest-radiograph",
          "label": "Chest radiograph",
          "category": "imaging",
          "minutes": 5,
          "requires": [],
          "finding": "Authored fictional radiograph: the mediastinal contour is described as subtly widened, with no single definitive answer.",
          "interpretation": "A plain chest radiograph cannot exclude acute aortic syndrome; this fictional image is an ambiguity-preserving clue, not a diagnosis.",
          "sourceIds": [
            0
          ]
        },
        {
          "id": "aortic-cta",
          "label": "Aortic CTA report",
          "category": "imaging",
          "minutes": 12,
          "requires": [],
          "finding": "Authored fictional CTA report: an intimal flap is seen in the ascending aorta and extends into the arch.",
          "interpretation": "In this fictional episode, the CTA is the decisive clue favoring acute aortic syndrome over the competing hypotheses.",
          "sourceIds": [
            0
          ]
        },
        {
          "id": "specialist-handoff",
          "label": "Specialist handoff",
          "category": "coordination",
          "minutes": 8,
          "requires": [
            "aortic-cta"
          ],
          "finding": "The fictional handoff carries the symptom report and CTA finding; it does not imply that other observations were performed.",
          "interpretation": "A structured handoff preserves uncertainty and the decisive clue for human review; it does not model treatment or outcome.",
          "sourceIds": [
            0
          ]
        }
      ],
      "reasoning": {
        "openingFacts": [
          {
            "id": "opening:chest-discomfort",
            "label": "Sudden severe chest discomfort in the opening handoff",
            "strength": "concern",
            "supports": [
              "acute-aortic-syndrome",
              "acute-coronary-syndrome",
              "pulmonary-embolism",
              "cause-unresolved"
            ]
          }
        ],
        "supportRules": {
          "symptom-timeline": {
            "strength": "suggestive",
            "supports": [
              "acute-aortic-syndrome"
            ]
          },
          "focused-examination": {
            "strength": "suggestive",
            "supports": [
              "acute-aortic-syndrome"
            ]
          },
          "ecg": {
            "strength": "limited",
            "supports": [
              "acute-coronary-syndrome"
            ]
          },
          "chest-radiograph": {
            "strength": "suggestive",
            "supports": [
              "acute-aortic-syndrome"
            ]
          },
          "aortic-cta": {
            "strength": "decisive",
            "supports": [
              "acute-aortic-syndrome"
            ]
          },
          "specialist-handoff": {
            "strength": "coordination",
            "supports": []
          }
        },
        "uncertaintyOptions": [
          {
            "id": "symptoms-not-confirmation",
            "label": "The opening symptom does not identify one cause.",
            "requires": [],
            "scope": "provisional"
          },
          {
            "id": "limited-ecg",
            "label": "The nonspecific ECG finding does not settle the cause.",
            "requires": [
              "ecg"
            ],
            "scope": "any"
          },
          {
            "id": "report-scope",
            "label": "The CTA supports an aortic finding; it does not settle every aspect of care.",
            "requires": [
              "aortic-cta"
            ],
            "scope": "supported"
          },
          {
            "id": "all-excluded",
            "label": "Every competing explanation has now been excluded.",
            "requires": [],
            "scope": "unsupported"
          }
        ],
        "supportLabel": "Evidence for your explanation",
        "limitationLabel": "A comparison or limit",
        "prompt": "Connect your explanation to reviewed evidence, then state a limit."
      },
      "familyId": "doc-002-tearing-back-investigation",
      "familyTitle": "The Night Shift",
      "recordLabel": "Arrival A",
      "workboardPrompt": "Choose work to follow up; reports may arrive together.",
      "reviewStatus": "pending_human_review",
      "authoredFiction": true,
      "reviewProvenance": {
        "status": "unreviewed",
        "ownerReportedPriorClinicianReview": true,
        "priorReviewScope": "unverified",
        "priorReviewVersion": "unverified",
        "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
      },
      "resolution": {
        "hypothesisId": "acute-aortic-syndrome",
        "conclusionKind": "diagnostic",
        "evidenceActionIds": [
          "aortic-cta"
        ],
        "supportedSummary": "The reviewed CTA describes the aortic finding that supports acute aortic syndrome in this fictional record.",
        "mismatchSummary": "The selected explanation does not account for the aortic finding described in the reviewed CTA.",
        "provisionalSummary": "The CTA was not reviewed. This remains a working explanation, not a confirmed cause.",
        "decisiveClue": "The fictional CTA describes an ascending-aortic intimal flap extending into the arch.",
        "missingClue": "The CTA report was not reviewed on this route.",
        "nextLearning": "Keep concerning symptoms separate from a report that establishes a finding.",
        "limitations": [
          "Authored fictional records pending human medical review; source references support educational framing, not these patient measurements or events.",
          "Update rounds are narrative release events, not clinical minutes, recommended waits or an investigation sequence. Emergency assessment continues independently.",
          "No treatment, dose, eligibility, prognosis or patient outcome is modeled. A recorded explanation does not establish clinical competence.",
          "Earlier owner-reported clinician review has unverified scope and version; it does not cover these new records or workflow events."
        ]
      },
      "transferQuestion": {
        "version": 1,
        "synthetic": true,
        "reviewStatus": "pending_human_review",
        "sourceCheckedDate": "2026-10-16",
        "delivery": "after-another-arrival",
        "id": "aortic-image-quality-contrast-v4",
        "prompt": "A different fictional CTA calls the motion-obscured ascending segment nondiagnostic, with no definite flap reported. Which conclusion fits?",
        "choices": [
          {
            "id": "negative",
            "label": "No reported flap makes this a reliable negative aortic scan.",
            "feedback": "A symptom change does not repair the stated image limitation. Nondiagnostic is not a reliable exclusion."
          },
          {
            "id": "unresolved",
            "label": "The aortic question remains unresolved; name the clinician responsible for clarifying the inadequate study.",
            "feedback": "Preserve the report limitation and clinical ownership without confirming or excluding aortic disease."
          },
          {
            "id": "confirmed",
            "label": "The symptom account confirms an aortic cause despite the inadequate study.",
            "feedback": "Concerning symptoms do not turn this inadequate report into confirmation."
          }
        ],
        "answerId": "unresolved",
        "source": {
          "title": "2022 ACC/AHA Aortic Disease Guideline: CT image quality",
          "url": "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001106",
          "scope": "Motion affects root and ascending-aortic image quality and diagnostic confidence. A segment explicitly reported as nondiagnostic cannot support exclusion or confirmation. No care protocol is authored.",
          "checkedDate": "2026-10-16"
        }
      }
    },
    "transfer": {
      "version": 1,
      "synthetic": true,
      "reviewStatus": "pending_human_review",
      "sourceCheckedDate": "2026-10-16",
      "delivery": "after-another-arrival",
      "id": "aortic-image-quality-contrast-v4",
      "prompt": "A different fictional CTA calls the motion-obscured ascending segment nondiagnostic, with no definite flap reported. Which conclusion fits?",
      "choices": [
        {
          "id": "negative",
          "label": "No reported flap makes this a reliable negative aortic scan.",
          "feedback": "A symptom change does not repair the stated image limitation. Nondiagnostic is not a reliable exclusion."
        },
        {
          "id": "unresolved",
          "label": "The aortic question remains unresolved; name the clinician responsible for clarifying the inadequate study.",
          "feedback": "Preserve the report limitation and clinical ownership without confirming or excluding aortic disease."
        },
        {
          "id": "confirmed",
          "label": "The symptom account confirms an aortic cause despite the inadequate study.",
          "feedback": "Concerning symptoms do not turn this inadequate report into confirmation."
        }
      ],
      "answerId": "unresolved",
      "source": {
        "title": "2022 ACC/AHA Aortic Disease Guideline: CT image quality",
        "url": "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001106",
        "scope": "Motion affects root and ascending-aortic image quality and diagnostic confidence. A segment explicitly reported as nondiagnostic cannot support exclusion or confirmation. No care protocol is authored.",
        "checkedDate": "2026-10-16"
      }
    }
  },
  {
    "episode": {
      "id": "doc-002-tearing-back-investigation-record-b",
      "version": 4,
      "careWorkflow": {
        "episodeId": "doc-002-tearing-back-investigation-record-b",
        "version": 1,
        "role": {
          "label": "Doctor coordinating the ED team",
          "boundary": "Coordinate concern, task owners and review; treatment and patient outcomes are outside this exercise."
        },
        "timingNote": "Fictional update rounds release reports and narrative events. They are not minutes, recommended waits or a prescribed clinical sequence.",
        "priority": {
          "prompt": "Who needs the opening concern before its cause is settled?",
          "choices": [
            {
              "id": "finish-record-before-contact",
              "label": "Collect the remaining reports first, then ask the ed senior clinician to accept the complete explanation.",
              "appropriate": false,
              "feedback": "A fuller record may refine the explanation. It does not replace early shared awareness and responsibility for the presenting concern.",
              "requires": []
            },
            {
              "id": "share-opening-concern",
              "label": "Share sudden chest discomfort with the ed senior clinician and confirm who accepts review.",
              "appropriate": true,
              "feedback": "Communicate the concern and uncertainty early; a diagnostic label is not required to name a review owner.",
              "requires": []
            }
          ]
        },
        "tasks": {
          "symptom-timeline": {
            "owner": "ED history-taking clinician",
            "label": "Follow up: symptom timeline",
            "rounds": 1
          },
          "focused-examination": {
            "owner": "ED examining clinician",
            "label": "Follow up: focused examination",
            "rounds": 1
          },
          "ecg": {
            "owner": "ECG reporting clinician",
            "label": "Follow up: ecg report",
            "rounds": 1
          },
          "chest-radiograph": {
            "owner": "Radiology reporting clinician",
            "label": "Follow up: chest radiograph",
            "rounds": 2
          },
          "aortic-cta": {
            "owner": "ED senior clinician",
            "label": "Follow up: aortic cta report",
            "rounds": 2
          },
          "specialist-handoff": {
            "owner": "ED senior clinician",
            "label": "Follow up: specialist handoff",
            "rounds": 1
          }
        },
        "reassessment": {
          "minimumReviewed": 1,
          "update": "Fictional team checkpoint: identify what you reviewed, what remains pending and who accepts the next review. This checkpoint supplies no additional examination or laboratory finding.",
          "prompt": "What does the next review need from you?",
          "choices": [
            {
              "id": "review-known-and-pending",
              "label": "Separate reviewed from pending information and confirm that the ed senior clinician owns the next review.",
              "appropriate": true,
              "feedback": "Report availability and clinical ownership are different. Bring the actual evidence and remaining question to the named receiver.",
              "requires": []
            },
            {
              "id": "review-after-worklist",
              "label": "Wait for the worklist to finish, then ask the ed senior clinician to review one final summary.",
              "appropriate": false,
              "feedback": "The concern needs an owner while work continues. A final summary cannot replace an accepted next review now.",
              "requires": []
            }
          ],
          "variants": [
            {
              "id": "ecg-interpretation",
              "requires": [
                "ecg"
              ],
              "prompt": "What does the small, nonspecific ECG change add?",
              "choices": [
                {
                  "id": "reassess-ecg-coronary",
                  "label": "Prioritize a confirmed coronary explanation; use the remaining reports mainly to define its extent.",
                  "appropriate": false,
                  "feedback": "The supplied ECG is nonspecific and does not establish a coronary cause or remove the aortic concern.",
                  "requires": []
                },
                {
                  "id": "reassess-ecg-limited",
                  "label": "Include it as a limited finding; the ECG alone settles neither a coronary cause nor the aortic question.",
                  "appropriate": true,
                  "feedback": "Keep this report within its scope, even if other reviewed evidence supports a stronger conclusion.",
                  "requires": []
                }
              ]
            }
          ]
        },
        "handoff": {
          "receiver": {
            "prompt": "Who accepts this concern?",
            "choices": [
              {
                "id": "named-clinical-receiver",
                "label": "The ED senior coordinating this assessment.",
                "appropriate": true,
                "feedback": "Name the clinical receiver and verify acceptance of the concern.",
                "requires": []
              },
              {
                "id": "worklist-receiver",
                "label": "The shared results worklist, with the next reader deciding who receives the concern.",
                "appropriate": false,
                "feedback": "A worklist records tasks; it does not show who accepted responsibility.",
                "requires": []
              }
            ]
          },
          "situation": {
            "prompt": "Which known fact will you carry forward?",
            "choices": [
              {
                "id": "opening-establishes-cause",
                "label": "The initial chest discomfort establishes a coronary cause; hand over the other reports as secondary details.",
                "appropriate": false,
                "feedback": "The opening observation does not establish that cause. Keep what happened separate from the explanation.",
                "requires": []
              },
              {
                "id": "reviewed-cta",
                "label": "The reviewed CTA calls the motion-obscured ascending segment nondiagnostic; no definite flap is reported.",
                "appropriate": true,
                "feedback": "Carry the actual report wording, rather than replacing it with a broader diagnosis or exclusion claim.",
                "requires": [
                  "aortic-cta"
                ]
              },
              {
                "id": "opening-concern",
                "label": "A 61-year-old arrived with sudden severe chest discomfort and an incomplete handoff.",
                "appropriate": true,
                "feedback": "This is an opening fact, available for an early handoff. Add the actual reviewed and pending information to the shared record.",
                "requires": []
              }
            ]
          },
          "uncertainty": {
            "prompt": "Which limit belongs with that statement?",
            "choices": [
              {
                "id": "opening-scope",
                "label": "The opening symptoms alone do not establish a cause; stronger claims must cite reviewed findings.",
                "appropriate": true,
                "feedback": "This limits the opening account without pretending later reports are still unknown.",
                "requires": []
              },
              {
                "id": "cta-scope",
                "label": "The nondiagnostic ascending segment neither confirms nor excludes aortic disease.",
                "appropriate": true,
                "feedback": "The handoff should preserve the specific report finding and its scope.",
                "requires": [
                  "aortic-cta"
                ]
              },
              {
                "id": "confirmation-before-handoff",
                "label": "Hold the handoff until a single cause is confirmed, so the receiver gets no unresolved question.",
                "appropriate": false,
                "feedback": "An unresolved question belongs in an early handoff. It should have a named clinical receiver, not be silently withheld.",
                "requires": []
              }
            ]
          },
          "nextOwner": {
            "prompt": "Who follows up the remaining concern?",
            "choices": [
              {
                "id": "task-implies-transfer",
                "label": "Use the completed request as the transfer of responsibility; the receiving worklist can assign the next review.",
                "appropriate": false,
                "feedback": "A sent request is not evidence that another person accepted the concern or the next review.",
                "requires": []
              },
              {
                "id": "named-next-review",
                "label": "Confirm the ed senior clinician owns the next review and how new reports or symptom changes reach them.",
                "appropriate": true,
                "feedback": "Identify an accountable receiver and an update route. This assigns communication responsibility, not treatment.",
                "requires": []
              }
            ]
          }
        },
        "readback": {
          "prompt": "Which reply can you verify to close the loop?",
          "choices": [
            {
              "id": "specific-readback",
              "label": "“I heard the sudden chest discomfort concern. I accept the next review; repeat what is reviewed and what needs follow-up.”",
              "appropriate": true,
              "feedback": "Check the repeated concern, known findings and owner against your message; correct a mismatch before closing the loop.",
              "requires": []
            },
            {
              "id": "worklist-acknowledgment",
              "label": "“I can see the request in the worklist. The next person reading the results can arrange further review.”",
              "appropriate": false,
              "feedback": "The concern and accountable next reviewer have not been repeated or accepted. Ask the receiver to clarify them.",
              "requires": []
            }
          ]
        },
        "sources": [
          {
            "title": "WHO Emergency Care Toolkit: Interagency Integrated Triage Tool",
            "url": "https://www.who.int/teams/integrated-health-services/clinical-services-and-systems/emergency-and-critical-care/emergency-care-toolkit",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Prioritizing clinical concern separately from establishing a diagnosis. These role-specific exercises do not implement or validate a triage scale."
          },
          {
            "title": "NICE CG50: recognising and responding to deterioration",
            "url": "https://www.nice.org.uk/guidance/CG50/chapter/recommendations",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Clinical concern, response ownership and reassessment. No physiological thresholds, observation intervals or treatment instructions are introduced."
          },
          {
            "title": "AHRQ TeamSTEPPS: Handoff",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Communicating known information, uncertainty, responsibility and contingencies, with acknowledgment by the receiver. The scripted handoffs are fictional examples."
          },
          {
            "title": "AHRQ TeamSTEPPS: Check-Back (or Repeat-Back)",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/checkback.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Receiver repetition followed by sender verification, including family communication. An acknowledgment does not establish a diagnosis or complete pending tasks."
          }
        ],
        "reviewProvenance": {
          "status": "unreviewed",
          "ownerReportedPriorClinicianReview": true,
          "priorReviewScope": "unverified",
          "priorReviewVersion": "unverified",
          "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
        },
        "workboardPrompt": "Choose work to follow up; reports may arrive together.",
        "patientUpdates": [
          {
            "id": "pain-change",
            "afterRound": 1,
            "requiresReviewed": [],
            "text": "Authored fictional change after arrival: the patient tells the bedside nurse that the chest pain feels worse than at the opening handoff. No new vital signs or examination findings are supplied.",
            "prompt": "How should this reported change reach the team?",
            "choices": [
              {
                "id": "defer-change-to-summary",
                "label": "Record the worse-pain report for the final handoff and wait for the outstanding report batch before flagging the change.",
                "appropriate": false,
                "feedback": "The new concern needs to reach the responsible clinician with its full detail. A pending report or one improved feature does not replace that communication.",
                "requires": []
              },
              {
                "id": "communicate-change",
                "label": "Tell the ED senior the patient reports worse pain, distinguish it from reviewed reports, and confirm who accepts reassessment.",
                "appropriate": true,
                "feedback": "Communicate the actual reported change and confirm a clinical owner. It neither establishes the cause nor predicts the outcome.",
                "requires": []
              }
            ]
          }
        ]
      },
      "title": "The Night Shift",
      "subtitle": "Follow the concern. Review the record. Hand it over.",
      "opening": "A 61-year-old arrives with sudden severe chest discomfort. The team is already arranging urgent assessment. The initial handoff is incomplete.",
      "disclaimer": "Educational fiction pending human review. Reports, changes and update rounds are authored; they are not clinical advice or patient outcomes.",
      "hypotheses": [
        {
          "id": "acute-aortic-syndrome",
          "label": "Acute aortic syndrome"
        },
        {
          "id": "acute-coronary-syndrome",
          "label": "Acute coronary syndrome"
        },
        {
          "id": "pulmonary-embolism",
          "label": "Pulmonary embolism"
        },
        {
          "id": "cause-unresolved",
          "label": "Cause not established by this record"
        }
      ],
      "sources": [
        {
          "title": "2022 ACC/AHA Guideline for the Diagnosis and Management of Aortic Disease",
          "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10784847/"
        },
        {
          "title": "2022 ACC/AHA Aortic Disease Guideline: CT image quality",
          "url": "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001106",
          "scope": "Motion affects root and ascending-aortic image quality and diagnostic confidence. A segment explicitly reported as nondiagnostic cannot support exclusion or confirmation. No care protocol is authored.",
          "checkedDate": "2026-10-16"
        }
      ],
      "actions": [
        {
          "id": "symptom-timeline",
          "label": "Symptom timeline",
          "category": "history",
          "minutes": 4,
          "requires": [],
          "finding": "Authored fictional history: abrupt chest pain was maximal at onset and moved through to the back.",
          "interpretation": "The onset and radiation are high-risk features, but they do not identify one diagnosis by themselves.",
          "sourceIds": [
            0
          ]
        },
        {
          "id": "focused-examination",
          "label": "Focused examination",
          "category": "examination",
          "minutes": 6,
          "requires": [],
          "finding": "Authored fictional measurement: arm pressures are 178/105 on the right and 142/88 on the left; the difference is reproducible.",
          "interpretation": "The fictional inter-arm difference increases concern for an aortic process and keeps premature coronary anchoring unsafe.",
          "sourceIds": [
            0
          ]
        },
        {
          "id": "ecg",
          "label": "ECG report",
          "category": "cardiac",
          "minutes": 5,
          "requires": [],
          "finding": "Authored fictional tracing: a small, nonspecific ST change is present in aVL without a complete diagnostic pattern.",
          "interpretation": "This finding keeps acute coronary syndrome in the differential but is not decisive and cannot erase the aortic warning signs.",
          "sourceIds": [
            0
          ]
        },
        {
          "id": "chest-radiograph",
          "label": "Chest radiograph",
          "category": "imaging",
          "minutes": 5,
          "requires": [],
          "finding": "Authored fictional radiograph: the mediastinal contour is described as subtly widened, with no single definitive answer.",
          "interpretation": "A plain chest radiograph cannot exclude acute aortic syndrome; this fictional image is an ambiguity-preserving clue, not a diagnosis.",
          "sourceIds": [
            0
          ]
        },
        {
          "id": "aortic-cta",
          "label": "Aortic CTA report",
          "category": "imaging",
          "minutes": 12,
          "requires": [],
          "finding": "Authored fictional CTA report: motion obscures the ascending aorta. That segment is nondiagnostic; no definite flap is reported.",
          "interpretation": "A nondiagnostic segment cannot confirm or exclude an aortic process. The limitation needs clinician-owned clarification.",
          "sourceIds": [
            0
          ]
        },
        {
          "id": "specialist-handoff",
          "label": "Specialist handoff",
          "category": "coordination",
          "minutes": 8,
          "requires": [
            "aortic-cta"
          ],
          "finding": "The fictional handoff states the presenting concern and the motion-limited ascending-aortic report. It does not call the scan negative or confirm a cause.",
          "interpretation": "Pass on the report limitation and confirm who owns clarification; a sent message is not an accepted handoff.",
          "sourceIds": [
            0
          ]
        }
      ],
      "reasoning": {
        "openingFacts": [
          {
            "id": "opening:chest-discomfort",
            "label": "Sudden severe chest discomfort in the opening handoff",
            "strength": "concern",
            "supports": [
              "acute-aortic-syndrome",
              "acute-coronary-syndrome",
              "pulmonary-embolism",
              "cause-unresolved"
            ]
          }
        ],
        "supportRules": {
          "symptom-timeline": {
            "strength": "suggestive",
            "supports": [
              "acute-aortic-syndrome"
            ]
          },
          "focused-examination": {
            "strength": "suggestive",
            "supports": [
              "acute-aortic-syndrome"
            ]
          },
          "ecg": {
            "strength": "limited",
            "supports": [
              "acute-coronary-syndrome"
            ]
          },
          "chest-radiograph": {
            "strength": "suggestive",
            "supports": [
              "acute-aortic-syndrome"
            ]
          },
          "aortic-cta": {
            "strength": "decisive",
            "supports": [
              "cause-unresolved"
            ]
          },
          "specialist-handoff": {
            "strength": "coordination",
            "supports": []
          }
        },
        "uncertaintyOptions": [
          {
            "id": "symptoms-not-confirmation",
            "label": "Chest discomfort alone does not establish a cause.",
            "requires": [],
            "scope": "provisional"
          },
          {
            "id": "limited-ecg",
            "label": "The nonspecific ECG alone does not settle the coronary or aortic question.",
            "requires": [
              "ecg"
            ],
            "scope": "any"
          },
          {
            "id": "report-scope",
            "label": "The ascending segment is nondiagnostic: aortic disease is neither confirmed nor excluded.",
            "requires": [
              "aortic-cta"
            ],
            "scope": "supported",
            "forHypotheses": [
              "cause-unresolved"
            ]
          },
          {
            "id": "all-excluded",
            "label": "No reported flap means every aortic explanation is excluded.",
            "requires": [],
            "scope": "unsupported"
          }
        ],
        "supportLabel": "Evidence for your explanation",
        "limitationLabel": "A comparison or limit",
        "prompt": "Connect your explanation to reviewed evidence, then state a limit.",
        "insufficientCitationFeedback": "Cite the reviewed nondiagnostic CTA to justify why this supplied record leaves the cause unresolved. An opening concern alone does not demonstrate that limitation.",
        "caseLearningText": "A technically limited report is evidence about what the record cannot establish. It is neither a negative scan nor proof of the suspected disease."
      },
      "familyId": "doc-002-tearing-back-investigation",
      "familyTitle": "The Night Shift",
      "recordLabel": "Arrival B",
      "workboardPrompt": "Choose work to follow up; reports may arrive together.",
      "reviewStatus": "pending_human_review",
      "authoredFiction": true,
      "reviewProvenance": {
        "status": "unreviewed",
        "ownerReportedPriorClinicianReview": true,
        "priorReviewScope": "unverified",
        "priorReviewVersion": "unverified",
        "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
      },
      "resolution": {
        "hypothesisId": "cause-unresolved",
        "conclusionKind": "unresolved",
        "evidenceActionIds": [
          "aortic-cta"
        ],
        "supportedSummary": "The reviewed CTA explicitly leaves the ascending segment nondiagnostic. The supplied record does not establish the cause; it neither confirms nor excludes aortic disease.",
        "mismatchSummary": "The nondiagnostic ascending segment does not confirm the selected diagnosis or justify excluding an aortic cause.",
        "provisionalSummary": "Without reviewing the CTA limitation, an unresolved explanation is still provisional on this route.",
        "decisiveClue": "The CTA calls the motion-obscured ascending segment nondiagnostic, with no definite flap reported.",
        "missingClue": "The CTA limitation was not reviewed on this route.",
        "nextLearning": "Carry the inadequate-study limitation into the handoff and name the clinician who owns clarification.",
        "limitations": [
          "Authored fictional records pending human medical review; source references support educational framing, not these patient measurements or events.",
          "Update rounds are narrative release events, not clinical minutes, recommended waits or an investigation sequence. Emergency assessment continues independently.",
          "No treatment, dose, eligibility, prognosis or patient outcome is modeled. A recorded explanation does not establish clinical competence.",
          "Earlier owner-reported clinician review has unverified scope and version; it does not cover these new records or workflow events."
        ]
      },
      "transferQuestion": {
        "version": 1,
        "synthetic": true,
        "reviewStatus": "pending_human_review",
        "sourceCheckedDate": "2026-10-16",
        "delivery": "after-another-arrival",
        "id": "aortic-diagnostic-report-contrast-v4",
        "prompt": "A different fictional arrival has a diagnostic-quality CTA. The radiologist explicitly reports acute dissection of the ascending aorta. Which conclusion fits this different report?",
        "choices": [
          {
            "id": "still-nondiagnostic",
            "label": "The aortic question must stay unresolved because a previous arrival had motion-limited imaging.",
            "feedback": "The earlier record does not determine this report’s quality. Use the supplied diagnostic finding for this arrival."
          },
          {
            "id": "finding-supported",
            "label": "The diagnostic report supports the aortic finding here; later care decisions still need the responsible team.",
            "feedback": "This report supplies a positive diagnostic finding. It has a different evidential status from a nondiagnostic segment."
          },
          {
            "id": "all-settled",
            "label": "Attribute the entire presentation to that finding and leave the competing concerns out of the handoff.",
            "feedback": "A diagnostic finding supports a conclusion without resolving every concurrent condition or removing other relevant observations from the handoff."
          }
        ],
        "answerId": "finding-supported",
        "source": {
          "title": "2022 ACC/AHA Aortic Disease Guideline: CT image quality",
          "url": "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001106",
          "scope": "Motion affects root and ascending-aortic image quality and diagnostic confidence. A segment explicitly reported as nondiagnostic cannot support exclusion or confirmation. No care protocol is authored.",
          "checkedDate": "2026-10-16"
        }
      }
    },
    "transfer": {
      "version": 1,
      "synthetic": true,
      "reviewStatus": "pending_human_review",
      "sourceCheckedDate": "2026-10-16",
      "delivery": "after-another-arrival",
      "id": "aortic-diagnostic-report-contrast-v4",
      "prompt": "A different fictional arrival has a diagnostic-quality CTA. The radiologist explicitly reports acute dissection of the ascending aorta. Which conclusion fits this different report?",
      "choices": [
        {
          "id": "still-nondiagnostic",
          "label": "The aortic question must stay unresolved because a previous arrival had motion-limited imaging.",
          "feedback": "The earlier record does not determine this report’s quality. Use the supplied diagnostic finding for this arrival."
        },
        {
          "id": "finding-supported",
          "label": "The diagnostic report supports the aortic finding here; later care decisions still need the responsible team.",
          "feedback": "This report supplies a positive diagnostic finding. It has a different evidential status from a nondiagnostic segment."
        },
        {
          "id": "all-settled",
          "label": "Attribute the entire presentation to that finding and leave the competing concerns out of the handoff.",
          "feedback": "A diagnostic finding supports a conclusion without resolving every concurrent condition or removing other relevant observations from the handoff."
        }
      ],
      "answerId": "finding-supported",
      "source": {
        "title": "2022 ACC/AHA Aortic Disease Guideline: CT image quality",
        "url": "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001106",
        "scope": "Motion affects root and ascending-aortic image quality and diagnostic confidence. A segment explicitly reported as nondiagnostic cannot support exclusion or confirmation. No care protocol is authored.",
        "checkedDate": "2026-10-16"
      }
    }
  },
  {
    "episode": {
      "id": "pub-003-missed-turn-investigation",
      "version": 4,
      "title": "The Missed Turn",
      "subtitle": "Follow the concern. Review the record. Hand it over.",
      "opening": "At dinner, a 68-year-old suddenly cannot finish a sentence and has trouble holding a fork. Emergency help is already on the way. Follow the fictional team record as it arrives.",
      "disclaimer": "Educational fiction pending human review. Reports, changes and update rounds are authored; they are not clinical advice or patient outcomes.",
      "reviewStatus": "pending_human_review",
      "presentation": {
        "audience": "public",
        "playMinutes": "4-7",
        "image": "./assets/episodes/pub-001-stroke-escalation-720.webp",
        "imageAlt": "Generated illustration of a dinner interrupted by an emergency response. Not diagnostic evidence."
      },
      "sources": [
        {
          "title": "NICE NG128: stroke recognition and initial assessment, recommendations 1.1.1-1.1.3",
          "url": "https://www.nice.org.uk/guidance/ng128/chapter/recommendations",
          "checkedUtc": "2026-10-16T04:29:45Z",
          "scope": "Sudden focal symptoms and checking hypoglycaemia as a competing explanation. The fictional normal glucose weakens that rival without establishing stroke; no treatment content is used."
        },
        {
          "title": "NINDS: Assess and Treat, CT and MRI sections",
          "url": "https://www.ninds.nih.gov/health-information/stroke/assess-and-treat",
          "checkedUtc": "2026-10-16T04:29:45Z",
          "scope": "CT detects bleeding; diffusion MRI can show ischemia before a non-contrast CT. Supports limits of the authored reports, not a required scan sequence or patient-specific advice."
        },
        {
          "title": "NINDS: Assess and Treat, diagnostic imaging",
          "url": "https://www.ninds.nih.gov/health-information/stroke/assess-and-treat",
          "scope": "Early ischemia may not be visible on noncontrast CT. An absent or nondiagnostic later study supplies no confirming finding; MRI is not presented as a universal prerequisite for urgent care.",
          "checkedDate": "2026-10-16"
        },
        {
          "title": "2026 AHA/ASA Guideline for Early Management of Acute Ischemic Stroke, section 3.2",
          "url": "https://www.ahajournals.org/doi/10.1161/STR.0000000000000513",
          "scope": "Clinicians can diagnose ischemic stroke from clinical presentation with a negative noncontrast CT in many patients. MRI is not universally required. This exercise only judges the incomplete supplied record and introduces no treatment or eligibility content.",
          "checkedDate": "2026-10-16"
        }
      ],
      "hypotheses": [
        {
          "id": "ischemic-stroke",
          "label": "Ischemic stroke (interrupted blood flow)"
        },
        {
          "id": "hypoglycemia",
          "label": "Low blood glucose"
        },
        {
          "id": "migraine-aura",
          "label": "Migraine with neurological symptoms"
        },
        {
          "id": "cause-unresolved",
          "label": "Cause not established by this record"
        }
      ],
      "actions": [
        {
          "id": "witness-account",
          "label": "Witness account",
          "category": "history",
          "minutes": 3,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional witness account: speech was normal a moment earlier. Word-finding difficulty and right-hand weakness began together and persist.",
          "interpretation": "Sudden speech and one-sided movement changes call for urgent assessment, not a wait-and-see conclusion."
        },
        {
          "id": "team-examination",
          "label": "Team examination",
          "category": "examination",
          "minutes": 4,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional examination: the clinician records difficulty naming familiar objects and right-arm drift. The patient remains awake.",
          "interpretation": "The observed pattern strengthens concern but does not establish its cause alone."
        },
        {
          "id": "glucose-result",
          "label": "Glucose report",
          "category": "laboratory",
          "minutes": 2,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional measurement during the symptoms: blood glucose is 106 mg/dL (5.9 mmol/L).",
          "interpretation": "This result does not support low glucose as the current explanation; it does not itself prove stroke."
        },
        {
          "id": "initial-ct",
          "label": "First CT report",
          "category": "imaging",
          "minutes": 6,
          "requires": [],
          "sourceIds": [
            1
          ],
          "finding": "Fictional non-contrast head CT report: no hemorrhage is seen; no definite early infarct is visible.",
          "interpretation": "An early CT without a visible infarct does not rule out ischemic stroke."
        },
        {
          "id": "team-mri-summary",
          "label": "Later imaging update",
          "category": "imaging",
          "minutes": 8,
          "requires": [],
          "sourceIds": [
            1
          ],
          "finding": "Fictional team review: diffusion MRI shows a small acute left frontal infarct corresponding to the speech and right-arm changes.",
          "interpretation": "The matching imaging finding supports ischemic stroke in this authored story; it is not a rule that every suspected stroke needs MRI before action."
        },
        {
          "id": "witness-handoff",
          "label": "Witness handoff",
          "category": "coordination",
          "minutes": 2,
          "requires": [
            "witness-account"
          ],
          "sourceIds": [
            0
          ],
          "finding": "The fictional handoff preserves the witnessed onset and persisting changes. It makes no claim about examinations or scans you did not read.",
          "interpretation": "A useful handoff separates what was witnessed from what remains unknown."
        }
      ],
      "reasoning": {
        "supportLabel": "Evidence for your explanation",
        "limitationLabel": "A comparison or limit",
        "prompt": "Connect your explanation to reviewed evidence, then state a limit.",
        "caseLearningText": "Weakening one explanation does not prove another. Connect each collected finding to the concern it supports or weakens, and keep a working hypothesis provisional when decisive evidence is absent.",
        "insufficientCitationFeedback": "Your route includes the matching fictional imaging finding. Cite that finding to support the conclusion rather than an earlier concern or a result that only weakens a rival.",
        "openingFacts": [
          {
            "id": "opening:speech-hand-change",
            "label": "Sudden speech and hand-use changes in the opening handoff",
            "strength": "concern",
            "supports": [
              "ischemic-stroke",
              "hypoglycemia",
              "migraine-aura",
              "cause-unresolved"
            ]
          }
        ],
        "supportRules": {
          "witness-account": {
            "strength": "suggestive",
            "supports": [
              "ischemic-stroke"
            ]
          },
          "team-examination": {
            "strength": "suggestive",
            "supports": [
              "ischemic-stroke"
            ]
          },
          "glucose-result": {
            "strength": "limited",
            "supports": [],
            "conflictsWith": [
              "hypoglycemia"
            ],
            "conflictFeedback": "The glucose result you read during the symptoms does not support low glucose as the current explanation. It weakens that rival without proving ischemic stroke."
          },
          "initial-ct": {
            "strength": "limited",
            "supports": []
          },
          "team-mri-summary": {
            "strength": "decisive",
            "supports": [
              "ischemic-stroke"
            ]
          },
          "witness-handoff": {
            "strength": "coordination",
            "supports": []
          }
        },
        "uncertaintyOptions": [
          {
            "id": "symptoms-not-confirmation",
            "label": "The opening symptoms raise concern but do not establish a cause.",
            "requires": [],
            "scope": "provisional"
          },
          {
            "id": "glucose-discriminator",
            "label": "The glucose result weakens the low-glucose explanation; it is not a positive stroke test.",
            "requires": [
              "glucose-result"
            ],
            "forHypotheses": [
              "ischemic-stroke",
              "migraine-aura"
            ],
            "scope": "any"
          },
          {
            "id": "ct-limit",
            "label": "The first CT report does not exclude an early ischemic stroke.",
            "requires": [
              "initial-ct"
            ],
            "scope": "any"
          },
          {
            "id": "mri-scope",
            "label": "The matching MRI finding supports ischemic stroke here; it does not determine every cause or later care decision.",
            "requires": [
              "team-mri-summary"
            ],
            "forHypotheses": [
              "ischemic-stroke"
            ],
            "scope": "supported"
          },
          {
            "id": "all-excluded",
            "label": "Every competing cause has now been ruled out.",
            "requires": [],
            "scope": "unsupported"
          }
        ]
      },
      "resolution": {
        "hypothesisId": "ischemic-stroke",
        "evidenceActionIds": [
          "team-mri-summary"
        ],
        "supportedSummary": "Your conclusion fits the matching acute infarct described in the fictional imaging review. This is support from that recorded finding, beyond the opening symptoms alone.",
        "mismatchSummary": "The chosen explanation does not account for the matching acute infarct described in the fictional imaging review.",
        "provisionalSummary": "Your route ended before the later imaging review. The conclusion remains provisional; a working hypothesis is not confirmation.",
        "decisiveClue": "The later fictional MRI report describes an acute left frontal infarct matching the symptoms.",
        "missingClue": "The later imaging review was not collected. No decisive imaging clue was reached on this route.",
        "nextLearning": "Distinguish a test that finds no bleeding from evidence that excludes interrupted blood flow. Keep uncertainty visible.",
        "limitations": [
          "Authored fictional records pending human medical review; source references support educational framing, not these patient measurements or events.",
          "Update rounds are narrative release events, not clinical minutes, recommended waits or an investigation sequence. Emergency assessment continues independently.",
          "No treatment, dose, eligibility, prognosis or patient outcome is modeled. A recorded explanation does not establish clinical competence.",
          "Earlier owner-reported clinician review has unverified scope and version; it does not cover these new records or workflow events."
        ],
        "conclusionKind": "diagnostic"
      },
      "careWorkflow": {
        "episodeId": "pub-003-missed-turn-investigation",
        "version": 1,
        "role": {
          "label": "Family witness communicating with the ED team",
          "boundary": "Report what you witnessed and ask who accepts updates. The ED team owns tests, clinical assessment and care decisions."
        },
        "timingNote": "Fictional update rounds release reports and narrative events. They are not minutes, recommended waits or a prescribed clinical sequence.",
        "priority": {
          "prompt": "Who needs the opening concern before its cause is settled?",
          "choices": [
            {
              "id": "finish-record-before-contact",
              "label": "Collect the remaining reports first, then ask the receiving ed clinician to accept the complete explanation.",
              "appropriate": false,
              "feedback": "A fuller record may refine the explanation. It does not replace early shared awareness and responsibility for the presenting concern.",
              "requires": []
            },
            {
              "id": "share-opening-concern",
              "label": "Share sudden speech and hand-use changes with the receiving ed clinician and confirm who accepts review.",
              "appropriate": true,
              "feedback": "Communicate the concern and uncertainty early; a diagnostic label is not required to name a review owner.",
              "requires": []
            }
          ]
        },
        "tasks": {
          "witness-account": {
            "owner": "Receiving ED nurse",
            "label": "Follow up: witness account",
            "rounds": 1
          },
          "team-examination": {
            "owner": "ED examining clinician",
            "label": "Follow up: team examination",
            "rounds": 1
          },
          "glucose-result": {
            "owner": "ED examining clinician",
            "label": "Follow up: glucose report",
            "rounds": 1
          },
          "initial-ct": {
            "owner": "ED senior clinician",
            "label": "Follow up: first ct report",
            "rounds": 2
          },
          "team-mri-summary": {
            "owner": "ED senior clinician",
            "label": "Follow up: later imaging update",
            "rounds": 2
          },
          "witness-handoff": {
            "owner": "Receiving ED nurse",
            "label": "Follow up: witness handoff",
            "rounds": 1
          }
        },
        "reassessment": {
          "minimumReviewed": 1,
          "update": "Fictional team checkpoint: identify what you reviewed, what remains pending and who accepts the next review. This checkpoint supplies no additional examination or laboratory finding.",
          "prompt": "What does the next review need from you?",
          "choices": [
            {
              "id": "review-known-and-pending",
              "label": "Separate reviewed from pending information and confirm that the receiving ed clinician owns the next review.",
              "appropriate": true,
              "feedback": "Report availability and clinical ownership are different. Bring the actual evidence and remaining question to the named receiver.",
              "requires": []
            },
            {
              "id": "review-after-worklist",
              "label": "Wait for the worklist to finish, then ask the receiving ed clinician to review one final summary.",
              "appropriate": false,
              "feedback": "The concern needs an owner while work continues. A final summary cannot replace an accepted next review now.",
              "requires": []
            }
          ],
          "variants": [
            {
              "id": "early-ct-limit",
              "requires": [
                "initial-ct"
              ],
              "prompt": "What does the first CT report settle?",
              "choices": [
                {
                  "id": "reassess-ct-excludes",
                  "label": "It reports no visible infarct, so the speech and arm changes can be handed over as a non-stroke problem.",
                  "appropriate": false,
                  "feedback": "Early ischemia may not be visible on this CT. The report does not establish a non-stroke explanation.",
                  "requires": []
                },
                {
                  "id": "reassess-ct-limited",
                  "label": "It reports no hemorrhage or definite early infarct; this CT alone does not exclude early ischemia.",
                  "appropriate": true,
                  "feedback": "A limited negative finding is not exclusion of every cause. Communicate continuing observed concerns to the ED team.",
                  "requires": []
                }
              ]
            }
          ]
        },
        "handoff": {
          "receiver": {
            "prompt": "Who accepts this concern?",
            "choices": [
              {
                "id": "named-clinical-receiver",
                "label": "The receiving ED clinician or nurse accepting the witness account.",
                "appropriate": true,
                "feedback": "Name the clinical receiver and verify acceptance of the concern.",
                "requires": []
              },
              {
                "id": "worklist-receiver",
                "label": "The shared results worklist, with the next reader deciding who receives the concern.",
                "appropriate": false,
                "feedback": "A worklist records tasks; it does not show who accepted responsibility.",
                "requires": []
              }
            ]
          },
          "situation": {
            "prompt": "Which known fact will you carry forward?",
            "choices": [
              {
                "id": "opening-establishes-cause",
                "label": "The initial speech change establishes stroke; hand over the arm change as a severity detail.",
                "appropriate": false,
                "feedback": "The opening observation does not establish that cause. Keep what happened separate from the explanation.",
                "requires": []
              },
              {
                "id": "reviewed-imaging",
                "label": "The later MRI report describes a matching small acute left frontal infarct.",
                "appropriate": true,
                "feedback": "State the findings actually reviewed. Do not replace an unavailable diagnostic result with a normal scan.",
                "requires": [
                  "team-mri-summary"
                ]
              },
              {
                "id": "reviewed-witness",
                "label": "The reviewed witness account places the speech and right-hand changes together, with continuing difficulty.",
                "appropriate": true,
                "feedback": "Distinguish witnessed onset and changes from a diagnosis.",
                "requires": [
                  "witness-account"
                ]
              },
              {
                "id": "opening-concern",
                "label": "At dinner, a 68-year-old suddenly had trouble speaking and holding a fork; emergency help was called.",
                "appropriate": true,
                "feedback": "This is an opening fact, available for an early handoff. Add the actual reviewed and pending information to the shared record.",
                "requires": []
              }
            ]
          },
          "uncertainty": {
            "prompt": "Which limit belongs with that statement?",
            "choices": [
              {
                "id": "opening-scope",
                "label": "The opening symptoms alone do not establish a cause; stronger claims must cite reviewed findings.",
                "appropriate": true,
                "feedback": "This limits the opening account without pretending later reports are still unknown.",
                "requires": []
              },
              {
                "id": "imaging-scope",
                "label": "The matching imaging supports ischemic stroke here; it does not settle every cause or care decision.",
                "appropriate": true,
                "feedback": "The witness reports evidence and concerns; the clinical team owns the assessment and further decisions.",
                "requires": [
                  "team-mri-summary"
                ]
              },
              {
                "id": "confirmation-before-handoff",
                "label": "Hold the handoff until a single cause is confirmed, so the receiver gets no unresolved question.",
                "appropriate": false,
                "feedback": "An unresolved question belongs in an early handoff. It should have a named clinical receiver, not be silently withheld.",
                "requires": []
              }
            ]
          },
          "nextOwner": {
            "prompt": "Who follows up the remaining concern?",
            "choices": [
              {
                "id": "task-implies-transfer",
                "label": "Use the completed request as the transfer of responsibility; the receiving worklist can assign the next review.",
                "appropriate": false,
                "feedback": "A sent request is not evidence that another person accepted the concern or the next review.",
                "requires": []
              },
              {
                "id": "named-next-review",
                "label": "Confirm the receiving ed clinician owns the next review and how new reports or symptom changes reach them.",
                "appropriate": true,
                "feedback": "Identify an accountable receiver and an update route. This assigns communication responsibility, not treatment.",
                "requires": []
              }
            ]
          }
        },
        "readback": {
          "prompt": "Which reply can you verify to close the loop?",
          "choices": [
            {
              "id": "specific-readback",
              "label": "“I heard the sudden speech and hand-use changes concern. I accept the next review; repeat what is reviewed and what needs follow-up.”",
              "appropriate": true,
              "feedback": "Check the repeated concern, known findings and owner against your message; correct a mismatch before closing the loop.",
              "requires": []
            },
            {
              "id": "worklist-acknowledgment",
              "label": "“I can see the request in the worklist. The next person reading the results can arrange further review.”",
              "appropriate": false,
              "feedback": "The concern and accountable next reviewer have not been repeated or accepted. Ask the receiver to clarify them.",
              "requires": []
            }
          ]
        },
        "sources": [
          {
            "title": "WHO Emergency Care Toolkit: Interagency Integrated Triage Tool",
            "url": "https://www.who.int/teams/integrated-health-services/clinical-services-and-systems/emergency-and-critical-care/emergency-care-toolkit",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Prioritizing clinical concern separately from establishing a diagnosis. These role-specific exercises do not implement or validate a triage scale."
          },
          {
            "title": "NICE CG50: recognising and responding to deterioration",
            "url": "https://www.nice.org.uk/guidance/CG50/chapter/recommendations",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Clinical concern, response ownership and reassessment. No physiological thresholds, observation intervals or treatment instructions are introduced."
          },
          {
            "title": "AHRQ TeamSTEPPS: Handoff",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Communicating known information, uncertainty, responsibility and contingencies, with acknowledgment by the receiver. The scripted handoffs are fictional examples."
          },
          {
            "title": "AHRQ TeamSTEPPS: Check-Back (or Repeat-Back)",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/checkback.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Receiver repetition followed by sender verification, including family communication. An acknowledgment does not establish a diagnosis or complete pending tasks."
          }
        ],
        "reviewProvenance": {
          "status": "unreviewed",
          "ownerReportedPriorClinicianReview": true,
          "priorReviewScope": "unverified",
          "priorReviewVersion": "unverified",
          "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
        },
        "workboardPrompt": "Choose work to follow up; reports may arrive together.",
        "patientUpdates": [
          {
            "id": "speech-arm-change",
            "afterRound": 1,
            "requiresReviewed": [],
            "text": "Authored fictional change after arrival: a family member reports speech sounds clearer, while difficulty using the right arm continues. This is a witness update, not a new clinician examination.",
            "prompt": "How should you pass on this mixed change?",
            "choices": [
              {
                "id": "defer-change-to-summary",
                "label": "Pass on the clearer speech as the main update and leave the continuing arm difficulty in the earlier written account.",
                "appropriate": false,
                "feedback": "The new concern needs to reach the responsible clinician with its full detail. A pending report or one improved feature does not replace that communication.",
                "requires": []
              },
              {
                "id": "communicate-change",
                "label": "Tell the receiving ED team that speech seems clearer but the arm difficulty continues, and ask who accepts the update.",
                "appropriate": true,
                "feedback": "Communicate the actual reported change and confirm a clinical owner. It neither establishes the cause nor predicts the outcome.",
                "requires": []
              }
            ]
          }
        ]
      },
      "familyId": "pub-003-missed-turn-investigation",
      "familyTitle": "The Missed Turn",
      "recordLabel": "Arrival A",
      "workboardPrompt": "Choose work to follow up; reports may arrive together.",
      "authoredFiction": true,
      "reviewProvenance": {
        "status": "unreviewed",
        "ownerReportedPriorClinicianReview": true,
        "priorReviewScope": "unverified",
        "priorReviewVersion": "unverified",
        "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
      },
      "transferQuestion": {
        "version": 1,
        "synthetic": true,
        "reviewStatus": "pending_human_review",
        "sourceCheckedDate": "2026-10-16",
        "delivery": "after-another-arrival",
        "id": "stroke-improving-symptoms-v4",
        "prompt": "In a different fictional record, sudden speech difficulty improves while one-sided hand difficulty continues. Emergency help is already called. What changes about the concern?",
        "choices": [
          {
            "id": "exclude",
            "label": "The improvement or lack of a visible infarct establishes a non-stroke explanation.",
            "feedback": "Neither partial symptom improvement nor this early CT excludes ischemia or establishes another cause."
          },
          {
            "id": "confirmed",
            "label": "The symptoms alone establish a confirmed ischemic stroke for the handoff.",
            "feedback": "The focal concern is important but does not by itself establish the cause in this supplied record."
          },
          {
            "id": "concern-and-limits",
            "label": "Report the continuing focal change and the evidence limits to the ED team; the cause still needs clinical assessment.",
            "feedback": "Communicate both the actual observation and uncertainty. A diagnostic later image is not a universal prerequisite for urgent assessment."
          }
        ],
        "answerId": "concern-and-limits",
        "source": {
          "title": "NINDS: Assess and Treat, diagnostic imaging",
          "url": "https://www.ninds.nih.gov/health-information/stroke/assess-and-treat",
          "scope": "Early ischemia may not be visible on noncontrast CT. An absent or nondiagnostic later study supplies no confirming finding; MRI is not presented as a universal prerequisite for urgent care.",
          "checkedDate": "2026-10-16"
        }
      }
    },
    "transfer": {
      "version": 1,
      "synthetic": true,
      "reviewStatus": "pending_human_review",
      "sourceCheckedDate": "2026-10-16",
      "delivery": "after-another-arrival",
      "id": "stroke-improving-symptoms-v4",
      "prompt": "In a different fictional record, sudden speech difficulty improves while one-sided hand difficulty continues. Emergency help is already called. What changes about the concern?",
      "choices": [
        {
          "id": "exclude",
          "label": "The improvement or lack of a visible infarct establishes a non-stroke explanation.",
          "feedback": "Neither partial symptom improvement nor this early CT excludes ischemia or establishes another cause."
        },
        {
          "id": "confirmed",
          "label": "The symptoms alone establish a confirmed ischemic stroke for the handoff.",
          "feedback": "The focal concern is important but does not by itself establish the cause in this supplied record."
        },
        {
          "id": "concern-and-limits",
          "label": "Report the continuing focal change and the evidence limits to the ED team; the cause still needs clinical assessment.",
          "feedback": "Communicate both the actual observation and uncertainty. A diagnostic later image is not a universal prerequisite for urgent assessment."
        }
      ],
      "answerId": "concern-and-limits",
      "source": {
        "title": "NINDS: Assess and Treat, diagnostic imaging",
        "url": "https://www.ninds.nih.gov/health-information/stroke/assess-and-treat",
        "scope": "Early ischemia may not be visible on noncontrast CT. An absent or nondiagnostic later study supplies no confirming finding; MRI is not presented as a universal prerequisite for urgent care.",
        "checkedDate": "2026-10-16"
      }
    }
  },
  {
    "episode": {
      "id": "pub-003-missed-turn-investigation-record-b",
      "version": 4,
      "title": "The Missed Turn",
      "subtitle": "Follow the concern. Review the record. Hand it over.",
      "opening": "At dinner, a 68-year-old suddenly cannot finish a sentence and has trouble holding a fork. Emergency help is already on the way. Follow the fictional team record as it arrives.",
      "disclaimer": "Educational fiction pending human review. Reports, changes and update rounds are authored; they are not clinical advice or patient outcomes.",
      "reviewStatus": "pending_human_review",
      "presentation": {
        "audience": "public",
        "playMinutes": "4-7",
        "image": "./assets/episodes/pub-001-stroke-escalation-720.webp",
        "imageAlt": "Generated illustration of a dinner interrupted by an emergency response. Not diagnostic evidence."
      },
      "sources": [
        {
          "title": "NICE NG128: stroke recognition and initial assessment, recommendations 1.1.1-1.1.3",
          "url": "https://www.nice.org.uk/guidance/ng128/chapter/recommendations",
          "checkedUtc": "2026-10-16T04:29:45Z",
          "scope": "Sudden focal symptoms and checking hypoglycaemia as a competing explanation. The fictional normal glucose weakens that rival without establishing stroke; no treatment content is used."
        },
        {
          "title": "NINDS: Assess and Treat, CT and MRI sections",
          "url": "https://www.ninds.nih.gov/health-information/stroke/assess-and-treat",
          "checkedUtc": "2026-10-16T04:29:45Z",
          "scope": "CT detects bleeding; diffusion MRI can show ischemia before a non-contrast CT. Supports limits of the authored reports, not a required scan sequence or patient-specific advice."
        },
        {
          "title": "NINDS: Assess and Treat, diagnostic imaging",
          "url": "https://www.ninds.nih.gov/health-information/stroke/assess-and-treat",
          "scope": "Early ischemia may not be visible on noncontrast CT. An absent or nondiagnostic later study supplies no confirming finding; MRI is not presented as a universal prerequisite for urgent care.",
          "checkedDate": "2026-10-16"
        },
        {
          "title": "2026 AHA/ASA Guideline for Early Management of Acute Ischemic Stroke, section 3.2",
          "url": "https://www.ahajournals.org/doi/10.1161/STR.0000000000000513",
          "scope": "Clinicians can diagnose ischemic stroke from clinical presentation with a negative noncontrast CT in many patients. MRI is not universally required. This exercise only judges the incomplete supplied record and introduces no treatment or eligibility content.",
          "checkedDate": "2026-10-16"
        }
      ],
      "hypotheses": [
        {
          "id": "ischemic-stroke",
          "label": "Ischemic stroke (interrupted blood flow)"
        },
        {
          "id": "hypoglycemia",
          "label": "Low blood glucose"
        },
        {
          "id": "migraine-aura",
          "label": "Migraine with neurological symptoms"
        },
        {
          "id": "cause-unresolved",
          "label": "Cause not established by this record"
        }
      ],
      "actions": [
        {
          "id": "witness-account",
          "label": "Witness account",
          "category": "history",
          "minutes": 3,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional witness account: speech was normal a moment earlier. Word-finding difficulty and right-hand weakness began together and persist.",
          "interpretation": "Sudden speech and one-sided movement changes call for urgent assessment, not a wait-and-see conclusion."
        },
        {
          "id": "team-examination",
          "label": "Team examination",
          "category": "examination",
          "minutes": 4,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional examination: the clinician records difficulty naming familiar objects and right-arm drift. The patient remains awake.",
          "interpretation": "The observed pattern strengthens concern but does not establish its cause alone."
        },
        {
          "id": "glucose-result",
          "label": "Glucose report",
          "category": "laboratory",
          "minutes": 2,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional measurement during the symptoms: blood glucose is 106 mg/dL (5.9 mmol/L).",
          "interpretation": "This result does not support low glucose as the current explanation; it does not itself prove stroke."
        },
        {
          "id": "initial-ct",
          "label": "First CT report",
          "category": "imaging",
          "minutes": 6,
          "requires": [],
          "sourceIds": [
            1
          ],
          "finding": "Fictional non-contrast head CT report: no hemorrhage is seen; no definite early infarct is visible.",
          "interpretation": "An early CT without a visible infarct does not rule out ischemic stroke."
        },
        {
          "id": "team-mri-summary",
          "label": "Later imaging update",
          "category": "imaging",
          "minutes": 8,
          "requires": [],
          "sourceIds": [
            1
          ],
          "finding": "Fictional later imaging update: an attempted study is nondiagnostic. No diagnostic later imaging result is available in this supplied record.",
          "interpretation": "This supplies no confirming image and does not rule out stroke. The persistent focal concern still needs clinician-owned assessment; this is not a rule that care waits for MRI."
        },
        {
          "id": "witness-handoff",
          "label": "Witness handoff",
          "category": "coordination",
          "minutes": 2,
          "requires": [
            "witness-account"
          ],
          "sourceIds": [
            0
          ],
          "finding": "The fictional handoff preserves the witnessed onset and persisting changes. It makes no claim about examinations or scans you did not read.",
          "interpretation": "A useful handoff separates what was witnessed from what remains unknown."
        }
      ],
      "reasoning": {
        "supportLabel": "Evidence for your explanation",
        "limitationLabel": "A comparison or limit",
        "prompt": "Connect your explanation to reviewed evidence, then state a limit.",
        "caseLearningText": "No hemorrhage on this CT is different from excluding early ischemia. The supplied later study adds no diagnostic finding. Clinicians can diagnose stroke from clinical presentation and CT; this exercise judges only the incomplete supplied record, without making MRI a prerequisite.",
        "insufficientCitationFeedback": "Connect the first CT and later nondiagnostic update. Together they explain why these supplied images have not established the cause; neither is proof that stroke is excluded.",
        "openingFacts": [
          {
            "id": "opening:speech-hand-change",
            "label": "Sudden speech and hand-use changes in the opening handoff",
            "strength": "concern",
            "supports": [
              "ischemic-stroke",
              "hypoglycemia",
              "migraine-aura",
              "cause-unresolved"
            ]
          }
        ],
        "supportRules": {
          "witness-account": {
            "strength": "suggestive",
            "supports": [
              "ischemic-stroke"
            ]
          },
          "team-examination": {
            "strength": "suggestive",
            "supports": [
              "ischemic-stroke"
            ]
          },
          "glucose-result": {
            "strength": "limited",
            "supports": [],
            "conflictsWith": [
              "hypoglycemia"
            ],
            "conflictFeedback": "The glucose result you read during the symptoms does not support low glucose as the current explanation. It weakens that rival without proving ischemic stroke."
          },
          "initial-ct": {
            "strength": "component",
            "supports": [
              "cause-unresolved"
            ]
          },
          "team-mri-summary": {
            "strength": "component",
            "supports": [
              "cause-unresolved"
            ]
          },
          "witness-handoff": {
            "strength": "coordination",
            "supports": []
          }
        },
        "uncertaintyOptions": [
          {
            "id": "symptoms-not-confirmation",
            "label": "The opening speech and hand changes raise concern but do not establish a cause.",
            "requires": [],
            "scope": "provisional"
          },
          {
            "id": "glucose-discriminator",
            "label": "The glucose result weakens current low glucose; it is not a positive stroke test.",
            "requires": [
              "glucose-result"
            ],
            "scope": "any",
            "forHypotheses": [
              "ischemic-stroke",
              "migraine-aura",
              "cause-unresolved"
            ]
          },
          {
            "id": "ct-limit",
            "label": "The first CT alone does not exclude early ischemia.",
            "requires": [
              "initial-ct"
            ],
            "scope": "any"
          },
          {
            "id": "imaging-scope",
            "label": "These reports leave the cause unestablished; persistent focal changes still belong in the clinician handoff.",
            "requires": [
              "initial-ct",
              "team-mri-summary"
            ],
            "scope": "supported",
            "forHypotheses": [
              "cause-unresolved"
            ]
          },
          {
            "id": "all-excluded",
            "label": "The first CT and absent diagnostic later image exclude stroke.",
            "requires": [],
            "scope": "unsupported"
          }
        ],
        "supportGroups": [
          {
            "id": "pattern:imaging-limits",
            "label": "First CT and later imaging limitation together",
            "requires": [
              "initial-ct",
              "team-mri-summary"
            ],
            "strength": "decisive",
            "supports": [
              "cause-unresolved"
            ]
          }
        ]
      },
      "resolution": {
        "hypothesisId": "cause-unresolved",
        "conclusionKind": "unresolved",
        "evidenceActionIds": [
          "initial-ct",
          "team-mri-summary"
        ],
        "supportedSummary": "The first CT shows no hemorrhage or definite early infarct, and later imaging is nondiagnostic. The cause is not established by this supplied record; stroke is not excluded.",
        "mismatchSummary": "The supplied imaging does not establish the selected cause. Persistent focal changes keep stroke a live concern rather than a confirmed or excluded diagnosis here.",
        "provisionalSummary": "The first CT and later imaging limitation were not both reviewed. An unresolved explanation remains provisional on this route.",
        "decisiveClue": "The early CT does not exclude ischemia; the later attempted study supplies no diagnostic result.",
        "missingClue": "At least one of the two imaging reports was not reviewed.",
        "nextLearning": "Report the ongoing focal concern and the actual imaging limits. Further assessment belongs to the responsible clinician, without a universal MRI requirement.",
        "limitations": [
          "Authored fictional records pending human medical review; source references support educational framing, not these patient measurements or events.",
          "Update rounds are narrative release events, not clinical minutes, recommended waits or an investigation sequence. Emergency assessment continues independently.",
          "No treatment, dose, eligibility, prognosis or patient outcome is modeled. A recorded explanation does not establish clinical competence.",
          "Earlier owner-reported clinician review has unverified scope and version; it does not cover these new records or workflow events."
        ]
      },
      "careWorkflow": {
        "episodeId": "pub-003-missed-turn-investigation-record-b",
        "version": 1,
        "role": {
          "label": "Family witness communicating with the ED team",
          "boundary": "Report what you witnessed and ask who accepts updates. The ED team owns tests, clinical assessment and care decisions."
        },
        "timingNote": "Fictional update rounds release reports and narrative events. They are not minutes, recommended waits or a prescribed clinical sequence.",
        "priority": {
          "prompt": "Who needs the opening concern before its cause is settled?",
          "choices": [
            {
              "id": "share-opening-concern",
              "label": "Share sudden speech and hand-use changes with the receiving ed clinician and confirm who accepts review.",
              "appropriate": true,
              "feedback": "Communicate the concern and uncertainty early; a diagnostic label is not required to name a review owner.",
              "requires": []
            },
            {
              "id": "finish-record-before-contact",
              "label": "Collect the remaining reports first, then ask the receiving ed clinician to accept the complete explanation.",
              "appropriate": false,
              "feedback": "A fuller record may refine the explanation. It does not replace early shared awareness and responsibility for the presenting concern.",
              "requires": []
            }
          ]
        },
        "tasks": {
          "witness-account": {
            "owner": "Receiving ED nurse",
            "label": "Follow up: witness account",
            "rounds": 1
          },
          "team-examination": {
            "owner": "ED examining clinician",
            "label": "Follow up: team examination",
            "rounds": 1
          },
          "glucose-result": {
            "owner": "ED examining clinician",
            "label": "Follow up: glucose report",
            "rounds": 1
          },
          "initial-ct": {
            "owner": "ED senior clinician",
            "label": "Follow up: first ct report",
            "rounds": 2
          },
          "team-mri-summary": {
            "owner": "ED senior clinician",
            "label": "Follow up: later imaging update",
            "rounds": 2
          },
          "witness-handoff": {
            "owner": "Receiving ED nurse",
            "label": "Follow up: witness handoff",
            "rounds": 1
          }
        },
        "reassessment": {
          "minimumReviewed": 1,
          "update": "Fictional team checkpoint: identify what you reviewed, what remains pending and who accepts the next review. This checkpoint supplies no additional examination or laboratory finding.",
          "prompt": "What does the next review need from you?",
          "choices": [
            {
              "id": "review-after-worklist",
              "label": "Wait for the worklist to finish, then ask the receiving ed clinician to review one final summary.",
              "appropriate": false,
              "feedback": "The concern needs an owner while work continues. A final summary cannot replace an accepted next review now.",
              "requires": []
            },
            {
              "id": "review-known-and-pending",
              "label": "Separate reviewed from pending information and confirm that the receiving ed clinician owns the next review.",
              "appropriate": true,
              "feedback": "Report availability and clinical ownership are different. Bring the actual evidence and remaining question to the named receiver.",
              "requires": []
            }
          ],
          "variants": [
            {
              "id": "early-ct-limit",
              "requires": [
                "initial-ct"
              ],
              "prompt": "What does the first CT report settle?",
              "choices": [
                {
                  "id": "reassess-ct-limited",
                  "label": "It reports no hemorrhage or definite early infarct; this CT alone does not exclude early ischemia.",
                  "appropriate": true,
                  "feedback": "A limited negative finding is not exclusion of every cause. Communicate continuing observed concerns to the ED team.",
                  "requires": []
                },
                {
                  "id": "reassess-ct-excludes",
                  "label": "It reports no visible infarct, so the speech and arm changes can be handed over as a non-stroke problem.",
                  "appropriate": false,
                  "feedback": "Early ischemia may not be visible on this CT. The report does not establish a non-stroke explanation.",
                  "requires": []
                }
              ]
            }
          ]
        },
        "handoff": {
          "receiver": {
            "prompt": "Who accepts this concern?",
            "choices": [
              {
                "id": "worklist-receiver",
                "label": "The shared results worklist, with the next reader deciding who receives the concern.",
                "appropriate": false,
                "feedback": "A worklist records tasks; it does not show who accepted responsibility.",
                "requires": []
              },
              {
                "id": "named-clinical-receiver",
                "label": "The receiving ED clinician or nurse accepting the witness account.",
                "appropriate": true,
                "feedback": "Name the clinical receiver and verify acceptance of the concern.",
                "requires": []
              }
            ]
          },
          "situation": {
            "prompt": "Which known fact will you carry forward?",
            "choices": [
              {
                "id": "opening-concern",
                "label": "At dinner, a 68-year-old suddenly had trouble speaking and holding a fork; emergency help was called.",
                "appropriate": true,
                "feedback": "This is an opening fact, available for an early handoff. Add the actual reviewed and pending information to the shared record.",
                "requires": []
              },
              {
                "id": "reviewed-witness",
                "label": "The reviewed witness account places the speech and right-hand changes together, with continuing difficulty.",
                "appropriate": true,
                "feedback": "Distinguish witnessed onset and changes from a diagnosis.",
                "requires": [
                  "witness-account"
                ]
              },
              {
                "id": "reviewed-imaging",
                "label": "The first CT shows no hemorrhage or definite early infarct; the later attempted study is nondiagnostic.",
                "appropriate": true,
                "feedback": "State the findings actually reviewed. Do not replace an unavailable diagnostic result with a normal scan.",
                "requires": [
                  "initial-ct",
                  "team-mri-summary"
                ]
              },
              {
                "id": "opening-establishes-cause",
                "label": "The initial speech change establishes stroke; hand over the arm change as a severity detail.",
                "appropriate": false,
                "feedback": "The opening observation does not establish that cause. Keep what happened separate from the explanation.",
                "requires": []
              }
            ]
          },
          "uncertainty": {
            "prompt": "Which limit belongs with that statement?",
            "choices": [
              {
                "id": "confirmation-before-handoff",
                "label": "Hold the handoff until a single cause is confirmed, so the receiver gets no unresolved question.",
                "appropriate": false,
                "feedback": "An unresolved question belongs in an early handoff. It should have a named clinical receiver, not be silently withheld.",
                "requires": []
              },
              {
                "id": "imaging-scope",
                "label": "The supplied images do not establish the cause or exclude stroke; continuing focal changes need the ED team’s assessment.",
                "appropriate": true,
                "feedback": "The witness reports evidence and concerns; the clinical team owns the assessment and further decisions.",
                "requires": [
                  "initial-ct",
                  "team-mri-summary"
                ]
              },
              {
                "id": "opening-scope",
                "label": "The opening symptoms alone do not establish a cause; stronger claims must cite reviewed findings.",
                "appropriate": true,
                "feedback": "This limits the opening account without pretending later reports are still unknown.",
                "requires": []
              }
            ]
          },
          "nextOwner": {
            "prompt": "Who follows up the remaining concern?",
            "choices": [
              {
                "id": "named-next-review",
                "label": "Confirm the receiving ed clinician owns the next review and how new reports or symptom changes reach them.",
                "appropriate": true,
                "feedback": "Identify an accountable receiver and an update route. This assigns communication responsibility, not treatment.",
                "requires": []
              },
              {
                "id": "task-implies-transfer",
                "label": "Use the completed request as the transfer of responsibility; the receiving worklist can assign the next review.",
                "appropriate": false,
                "feedback": "A sent request is not evidence that another person accepted the concern or the next review.",
                "requires": []
              }
            ]
          }
        },
        "readback": {
          "prompt": "Which reply can you verify to close the loop?",
          "choices": [
            {
              "id": "worklist-acknowledgment",
              "label": "“I can see the request in the worklist. The next person reading the results can arrange further review.”",
              "appropriate": false,
              "feedback": "The concern and accountable next reviewer have not been repeated or accepted. Ask the receiver to clarify them.",
              "requires": []
            },
            {
              "id": "specific-readback",
              "label": "“I heard the sudden speech and hand-use changes concern. I accept the next review; repeat what is reviewed and what needs follow-up.”",
              "appropriate": true,
              "feedback": "Check the repeated concern, known findings and owner against your message; correct a mismatch before closing the loop.",
              "requires": []
            }
          ]
        },
        "sources": [
          {
            "title": "WHO Emergency Care Toolkit: Interagency Integrated Triage Tool",
            "url": "https://www.who.int/teams/integrated-health-services/clinical-services-and-systems/emergency-and-critical-care/emergency-care-toolkit",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Prioritizing clinical concern separately from establishing a diagnosis. These role-specific exercises do not implement or validate a triage scale."
          },
          {
            "title": "NICE CG50: recognising and responding to deterioration",
            "url": "https://www.nice.org.uk/guidance/CG50/chapter/recommendations",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Clinical concern, response ownership and reassessment. No physiological thresholds, observation intervals or treatment instructions are introduced."
          },
          {
            "title": "AHRQ TeamSTEPPS: Handoff",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Communicating known information, uncertainty, responsibility and contingencies, with acknowledgment by the receiver. The scripted handoffs are fictional examples."
          },
          {
            "title": "AHRQ TeamSTEPPS: Check-Back (or Repeat-Back)",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/checkback.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Receiver repetition followed by sender verification, including family communication. An acknowledgment does not establish a diagnosis or complete pending tasks."
          }
        ],
        "reviewProvenance": {
          "status": "unreviewed",
          "ownerReportedPriorClinicianReview": true,
          "priorReviewScope": "unverified",
          "priorReviewVersion": "unverified",
          "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
        },
        "workboardPrompt": "Choose work to follow up; reports may arrive together.",
        "patientUpdates": [
          {
            "id": "speech-arm-change",
            "afterRound": 1,
            "requiresReviewed": [],
            "text": "Authored fictional change after arrival: a family member reports speech sounds clearer, while difficulty using the right arm continues. This is a witness update, not a new clinician examination.",
            "prompt": "How should you pass on this mixed change?",
            "choices": [
              {
                "id": "communicate-change",
                "label": "Tell the receiving ED team that speech seems clearer but the arm difficulty continues, and ask who accepts the update.",
                "appropriate": true,
                "feedback": "Communicate the actual reported change and confirm a clinical owner. It neither establishes the cause nor predicts the outcome.",
                "requires": []
              },
              {
                "id": "defer-change-to-summary",
                "label": "Pass on the clearer speech as the main update and leave the continuing arm difficulty in the earlier written account.",
                "appropriate": false,
                "feedback": "The new concern needs to reach the responsible clinician with its full detail. A pending report or one improved feature does not replace that communication.",
                "requires": []
              }
            ]
          }
        ]
      },
      "familyId": "pub-003-missed-turn-investigation",
      "familyTitle": "The Missed Turn",
      "recordLabel": "Arrival B",
      "workboardPrompt": "Choose work to follow up; reports may arrive together.",
      "authoredFiction": true,
      "reviewProvenance": {
        "status": "unreviewed",
        "ownerReportedPriorClinicianReview": true,
        "priorReviewScope": "unverified",
        "priorReviewVersion": "unverified",
        "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
      },
      "transferQuestion": {
        "version": 1,
        "synthetic": true,
        "reviewStatus": "pending_human_review",
        "sourceCheckedDate": "2026-10-16",
        "delivery": "after-another-arrival",
        "id": "stroke-positive-report-contrast-v4",
        "prompt": "A different fictional arrival has continuing focal changes. A later diagnostic imaging report explicitly identifies acute ischemic injury matching those changes. What can this report add?",
        "choices": [
          {
            "id": "still-no-evidence",
            "label": "The cause remains unsupported solely because the first CT showed no definite early infarct.",
            "feedback": "A later positive finding changes this supplied record. The first CT does not cancel it."
          },
          {
            "id": "matching-support",
            "label": "The matching report supports ischemic stroke here, while its cause and later care decisions still need assessment.",
            "feedback": "A matching diagnostic finding adds support beyond the early limited report. It does not mean all suspected strokes universally require this imaging."
          },
          {
            "id": "all-focal-proven",
            "label": "Use the matching injury to establish its mechanism as well, without a separate cause assessment.",
            "feedback": "A matching injury supports ischemic stroke in this record; its mechanism and later care decisions are separate questions."
          }
        ],
        "answerId": "matching-support",
        "source": {
          "title": "NINDS: Assess and Treat, diagnostic imaging",
          "url": "https://www.ninds.nih.gov/health-information/stroke/assess-and-treat",
          "scope": "Early ischemia may not be visible on noncontrast CT. An absent or nondiagnostic later study supplies no confirming finding; MRI is not presented as a universal prerequisite for urgent care.",
          "checkedDate": "2026-10-16"
        }
      }
    },
    "transfer": {
      "version": 1,
      "synthetic": true,
      "reviewStatus": "pending_human_review",
      "sourceCheckedDate": "2026-10-16",
      "delivery": "after-another-arrival",
      "id": "stroke-positive-report-contrast-v4",
      "prompt": "A different fictional arrival has continuing focal changes. A later diagnostic imaging report explicitly identifies acute ischemic injury matching those changes. What can this report add?",
      "choices": [
        {
          "id": "still-no-evidence",
          "label": "The cause remains unsupported solely because the first CT showed no definite early infarct.",
          "feedback": "A later positive finding changes this supplied record. The first CT does not cancel it."
        },
        {
          "id": "matching-support",
          "label": "The matching report supports ischemic stroke here, while its cause and later care decisions still need assessment.",
          "feedback": "A matching diagnostic finding adds support beyond the early limited report. It does not mean all suspected strokes universally require this imaging."
        },
        {
          "id": "all-focal-proven",
          "label": "Use the matching injury to establish its mechanism as well, without a separate cause assessment.",
          "feedback": "A matching injury supports ischemic stroke in this record; its mechanism and later care decisions are separate questions."
        }
      ],
      "answerId": "matching-support",
      "source": {
        "title": "NINDS: Assess and Treat, diagnostic imaging",
        "url": "https://www.ninds.nih.gov/health-information/stroke/assess-and-treat",
        "scope": "Early ischemia may not be visible on noncontrast CT. An absent or nondiagnostic later study supplies no confirming finding; MRI is not presented as a universal prerequisite for urgent care.",
        "checkedDate": "2026-10-16"
      }
    }
  },
  {
    "episode": {
      "id": "stu-003-after-weekend-investigation",
      "version": 4,
      "title": "After the Weekend",
      "subtitle": "Follow the concern. Review the record. Hand it over.",
      "opening": "A 26-year-old arrives after a weekend away with vomiting, fatigue and abdominal discomfort. The team is already assessing the patient. The first handoff suggests a stomach illness, but the record is incomplete.",
      "disclaimer": "Educational fiction pending human review. Reports, changes and update rounds are authored; they are not clinical advice or patient outcomes.",
      "reviewStatus": "pending_human_review",
      "presentation": {
        "audience": "student",
        "playMinutes": "5-8",
        "image": "./assets/episodes/stu-001-dka-escalation-720.webp",
        "imageAlt": "Generated illustration of a young adult under observation with a hospital team. Not diagnostic evidence."
      },
      "sources": [
        {
          "title": "ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus report",
          "url": "https://doi.org/10.2337/dci24-0032",
          "checkedUtc": "2026-10-16T04:29:45Z",
          "scope": "Diagnosis requires the combined glucose/diabetes, ketone and metabolic-acidosis criteria. HHS involves hyperosmolality without significant ketosis or acidosis; no treatment recommendations are used. Fictional values are not source patient data."
        },
        {
          "title": "2024 consensus report: open full text, diagnostic criteria section",
          "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11272983/",
          "checkedUtc": "2026-10-16T04:29:45Z",
          "scope": "Primary consensus text for the three-part DKA argument and the competing HHS pattern. Used only to check authored evidence relations, not care decisions."
        },
        {
          "title": "ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus",
          "url": "https://doi.org/10.2337/dci24-0032",
          "scope": "Compare the combined DKA criteria with severe hyperglycemia, hyperosmolality and absence of significant ketosis/acidosis in HHS. The fictional alternatives are simplified; real presentations can overlap. No treatment content is used.",
          "checkedDate": "2026-10-16"
        }
      ],
      "hypotheses": [
        {
          "id": "diabetic-ketoacidosis",
          "label": "Diabetic ketoacidosis"
        },
        {
          "id": "hyperosmolar-state",
          "label": "Hyperglycemic hyperosmolar state (HHS) alone"
        },
        {
          "id": "gastroenteritis",
          "label": "Gastroenteritis with dehydration"
        },
        {
          "id": "cause-unresolved",
          "label": "Cause not established by this record"
        }
      ],
      "actions": [
        {
          "id": "recent-history",
          "label": "Recent history",
          "category": "history",
          "minutes": 3,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional history: thirst and frequent urination started before the vomiting. There is no established diabetes diagnosis in the record.",
          "interpretation": "The chronology weakens a stomach-only explanation but cannot settle the metabolic diagnosis."
        },
        {
          "id": "bedside-observations",
          "label": "Bedside observations",
          "category": "examination",
          "minutes": 3,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional observations: the patient is tired but conversant, with deep breathing, dry mouth and diffuse abdominal discomfort.",
          "interpretation": "These observations require explanation; they are not specific enough to label the illness."
        },
        {
          "id": "plasma-glucose",
          "label": "Plasma glucose",
          "category": "laboratory",
          "minutes": 2,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional laboratory result: plasma glucose is 286 mg/dL.",
          "interpretation": "Elevated glucose alone is not sufficient to establish ketoacidosis."
        },
        {
          "id": "blood-ketones",
          "label": "Blood ketones",
          "category": "laboratory",
          "minutes": 3,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional laboratory result: beta-hydroxybutyrate is 4.8 mmol/L.",
          "interpretation": "The ketone result adds a second piece. Acid-base evidence is still distinct."
        },
        {
          "id": "acid-base",
          "label": "Acid-base report",
          "category": "laboratory",
          "minutes": 4,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional laboratory results: venous pH is 7.22 and bicarbonate is 13 mmol/L.",
          "interpretation": "Acidosis together with elevated glucose and ketones supports the ketoacidosis explanation in this case."
        },
        {
          "id": "serum-osmolality",
          "label": "Serum osmolality",
          "category": "laboratory",
          "minutes": 4,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional laboratory result: measured total serum osmolality is 297 mOsm/kg.",
          "interpretation": "This fictional result does not support a markedly hyperosmolar explanation. It does not replace the three-part ketoacidosis assessment."
        }
      ],
      "reasoning": {
        "supportLabel": "Evidence for your explanation",
        "limitationLabel": "A comparison or limit",
        "prompt": "Connect your explanation to reviewed evidence, then state a limit.",
        "caseLearningText": "Keep glucose, ketones and acid-base evidence distinct until you can connect them. Compare the metabolic explanation with its rivals; one abnormal result is not the whole argument. These alternatives are simplified; real presentations can overlap.",
        "insufficientCitationFeedback": "The three-part argument needs the glucose, ketone and acid-base findings together. Select their combined argument to justify this conclusion; citing one component does not demonstrate that connection.",
        "openingFacts": [
          {
            "id": "opening:vomiting-fatigue-discomfort",
            "label": "Vomiting, fatigue and abdominal discomfort in the opening handoff",
            "strength": "concern",
            "supports": [
              "diabetic-ketoacidosis",
              "hyperosmolar-state",
              "gastroenteritis",
              "cause-unresolved"
            ]
          }
        ],
        "supportRules": {
          "recent-history": {
            "strength": "suggestive",
            "supports": [
              "diabetic-ketoacidosis",
              "hyperosmolar-state"
            ]
          },
          "bedside-observations": {
            "strength": "concern",
            "supports": [
              "diabetic-ketoacidosis",
              "hyperosmolar-state",
              "gastroenteritis"
            ]
          },
          "plasma-glucose": {
            "strength": "component",
            "supports": [
              "diabetic-ketoacidosis"
            ],
            "conflictsWith": [
              "hyperosmolar-state"
            ],
            "conflictFeedback": "The glucose value you read does not fit HHS alone in this fictional case. It does not establish DKA without the remaining findings; real presentations can overlap."
          },
          "blood-ketones": {
            "strength": "component",
            "supports": [
              "diabetic-ketoacidosis"
            ],
            "conflictsWith": [
              "hyperosmolar-state"
            ],
            "conflictFeedback": "The ketone elevation you read does not fit HHS alone in this fictional case. It does not establish DKA without the remaining findings; real presentations can overlap."
          },
          "acid-base": {
            "strength": "component",
            "supports": [
              "diabetic-ketoacidosis"
            ],
            "conflictsWith": [
              "hyperosmolar-state"
            ],
            "conflictFeedback": "The acidosis you read does not fit HHS alone in this fictional case. It does not establish DKA without the remaining findings; real presentations can overlap."
          },
          "serum-osmolality": {
            "strength": "limited",
            "supports": [],
            "conflictsWith": [
              "hyperosmolar-state"
            ],
            "conflictFeedback": "The osmolality result you read does not support HHS alone in this fictional case. It does not establish DKA without the remaining findings; real presentations can overlap."
          }
        },
        "supportGroups": [
          {
            "id": "pattern:metabolic-triad",
            "label": "Glucose, blood ketones and acid-base results together",
            "requires": [
              "plasma-glucose",
              "blood-ketones",
              "acid-base"
            ],
            "strength": "decisive",
            "supports": [
              "diabetic-ketoacidosis"
            ]
          }
        ],
        "uncertaintyOptions": [
          {
            "id": "symptoms-not-confirmation",
            "label": "Vomiting and discomfort alone do not establish a metabolic diagnosis.",
            "requires": [],
            "scope": "provisional"
          },
          {
            "id": "history-limits",
            "label": "Thirst and frequent urination before vomiting weaken a stomach-only explanation; the metabolic cause is still unresolved.",
            "requires": [
              "recent-history"
            ],
            "missingAny": [
              "plasma-glucose",
              "blood-ketones",
              "acid-base"
            ],
            "scope": "provisional"
          },
          {
            "id": "glucose-with-missing-components",
            "label": "Glucose is raised, but a ketone or acid-base report is still missing from my route.",
            "requires": [
              "plasma-glucose"
            ],
            "missingAny": [
              "blood-ketones",
              "acid-base"
            ],
            "forHypotheses": [
              "diabetic-ketoacidosis"
            ],
            "scope": "provisional"
          },
          {
            "id": "ketones-with-missing-components",
            "label": "Ketones are raised, but a glucose or acid-base report is still missing from my route.",
            "requires": [
              "blood-ketones"
            ],
            "missingAny": [
              "plasma-glucose",
              "acid-base"
            ],
            "forHypotheses": [
              "diabetic-ketoacidosis"
            ],
            "scope": "provisional"
          },
          {
            "id": "acidosis-with-missing-components",
            "label": "A glucose or ketone report is still missing, so this acidosis has not been linked to the full pattern.",
            "requires": [
              "acid-base"
            ],
            "missingAny": [
              "plasma-glucose",
              "blood-ketones"
            ],
            "forHypotheses": [
              "diabetic-ketoacidosis"
            ],
            "scope": "provisional"
          },
          {
            "id": "triad-scope",
            "label": "The laboratory pattern supports ketoacidosis here; it does not determine why it developed or settle every care decision.",
            "requires": [
              "plasma-glucose",
              "blood-ketones",
              "acid-base"
            ],
            "forHypotheses": [
              "diabetic-ketoacidosis"
            ],
            "scope": "supported"
          },
          {
            "id": "osmolality-discriminator",
            "label": "This osmolality result weakens a markedly hyperosmolar explanation; it cannot establish ketoacidosis on its own.",
            "requires": [
              "serum-osmolality"
            ],
            "forHypotheses": [
              "diabetic-ketoacidosis",
              "gastroenteritis"
            ],
            "scope": "any"
          },
          {
            "id": "all-excluded",
            "label": "Every other cause of vomiting has now been ruled out.",
            "requires": [],
            "scope": "unsupported"
          }
        ]
      },
      "resolution": {
        "hypothesisId": "diabetic-ketoacidosis",
        "evidenceActionIds": [
          "plasma-glucose",
          "blood-ketones",
          "acid-base"
        ],
        "supportedSummary": "The collected three-part pattern supports ketoacidosis in this fictional case: elevated glucose, ketones and acidosis. The opening complaint alone was not enough.",
        "mismatchSummary": "The collected glucose, ketone and acid-base findings fit ketoacidosis more closely than the selected explanation in this fictional case.",
        "provisionalSummary": "Your conclusion remains provisional because the glucose, ketone and acid-base results were not all collected. A partial pattern is not the complete evidence set.",
        "decisiveClue": "The fictional combination is glucose 286 mg/dL, beta-hydroxybutyrate 4.8 mmol/L, pH 7.22 and bicarbonate 13 mmol/L.",
        "missingClue": "At least one component of the three-part laboratory pattern is missing from your route.",
        "nextLearning": "Ask whether the required pieces fit together, rather than letting one abnormal number carry the whole conclusion.",
        "limitations": [
          "Authored fictional records pending human medical review; source references support educational framing, not these patient measurements or events.",
          "Update rounds are narrative release events, not clinical minutes, recommended waits or an investigation sequence. Emergency assessment continues independently.",
          "No treatment, dose, eligibility, prognosis or patient outcome is modeled. A recorded explanation does not establish clinical competence.",
          "Earlier owner-reported clinician review has unverified scope and version; it does not cover these new records or workflow events."
        ],
        "conclusionKind": "diagnostic"
      },
      "careWorkflow": {
        "episodeId": "stu-003-after-weekend-investigation",
        "version": 1,
        "role": {
          "label": "Student reporting to a supervising clinician",
          "boundary": "Offer a synthesis and questions to the supervisor. Independent test orders, treatment and care decisions are outside the student role."
        },
        "timingNote": "Fictional update rounds release reports and narrative events. They are not minutes, recommended waits or a prescribed clinical sequence.",
        "priority": {
          "prompt": "Who needs the opening concern before its cause is settled?",
          "choices": [
            {
              "id": "share-opening-concern",
              "label": "Share vomiting, fatigue and abdominal discomfort with the supervising clinician and confirm who accepts review.",
              "appropriate": true,
              "feedback": "Communicate the concern and uncertainty early; a diagnostic label is not required to name a review owner.",
              "requires": []
            },
            {
              "id": "finish-record-before-contact",
              "label": "Collect the remaining reports first, then ask the supervising clinician to accept the complete explanation.",
              "appropriate": false,
              "feedback": "A fuller record may refine the explanation. It does not replace early shared awareness and responsibility for the presenting concern.",
              "requires": []
            }
          ]
        },
        "tasks": {
          "recent-history": {
            "owner": "Supervising clinician",
            "label": "Follow up: recent history",
            "rounds": 1
          },
          "bedside-observations": {
            "owner": "Supervising clinician",
            "label": "Follow up: bedside observations",
            "rounds": 1
          },
          "plasma-glucose": {
            "owner": "Supervising clinician",
            "label": "Follow up: plasma glucose",
            "rounds": 1
          },
          "blood-ketones": {
            "owner": "Supervising clinician",
            "label": "Follow up: blood ketones",
            "rounds": 2
          },
          "acid-base": {
            "owner": "Supervising clinician",
            "label": "Follow up: acid-base report",
            "rounds": 2
          },
          "serum-osmolality": {
            "owner": "Supervising clinician",
            "label": "Follow up: serum osmolality",
            "rounds": 2
          }
        },
        "reassessment": {
          "minimumReviewed": 1,
          "update": "Fictional team checkpoint: identify what you reviewed, what remains pending and who accepts the next review. This checkpoint supplies no additional examination or laboratory finding.",
          "prompt": "What does the next review need from you?",
          "choices": [
            {
              "id": "review-after-worklist",
              "label": "Wait for the worklist to finish, then ask the supervising clinician to review one final summary.",
              "appropriate": false,
              "feedback": "The concern needs an owner while work continues. A final summary cannot replace an accepted next review now.",
              "requires": []
            },
            {
              "id": "review-known-and-pending",
              "label": "Separate reviewed from pending information and confirm that the supervising clinician owns the next review.",
              "appropriate": true,
              "feedback": "Report availability and clinical ownership are different. Bring the actual evidence and remaining question to the named receiver.",
              "requires": []
            }
          ],
          "variants": [
            {
              "id": "glucose-component-limit",
              "requires": [
                "plasma-glucose"
              ],
              "prompt": "What can glucose 286 mg/dL establish alone?",
              "choices": [
                {
                  "id": "reassess-glucose-component",
                  "label": "Report raised glucose as one component; compare ketones, acid-base and any reviewed osmolality separately.",
                  "appropriate": true,
                  "feedback": "The full metabolic argument depends on the relevant combination. A single component does not establish the pattern.",
                  "requires": []
                },
                {
                  "id": "reassess-glucose-completes",
                  "label": "Use the glucose value to establish ketoacidosis; treat the remaining reports as severity details.",
                  "appropriate": false,
                  "feedback": "Raised glucose alone is insufficient for ketoacidosis. Ketones and acid-base findings address distinct parts of the explanation.",
                  "requires": []
                }
              ]
            }
          ]
        },
        "handoff": {
          "receiver": {
            "prompt": "Who accepts this concern?",
            "choices": [
              {
                "id": "worklist-receiver",
                "label": "The shared results worklist, with the next reader deciding who receives the concern.",
                "appropriate": false,
                "feedback": "A worklist records tasks; it does not show who accepted responsibility.",
                "requires": []
              },
              {
                "id": "named-clinical-receiver",
                "label": "The supervising clinician responsible for this assessment.",
                "appropriate": true,
                "feedback": "Name the clinical receiver and verify acceptance of the concern.",
                "requires": []
              }
            ]
          },
          "situation": {
            "prompt": "Which known fact will you carry forward?",
            "choices": [
              {
                "id": "opening-concern",
                "label": "A 26-year-old arrived with vomiting, fatigue and abdominal discomfort; the stomach-illness account was incomplete.",
                "appropriate": true,
                "feedback": "This is an opening fact, available for an early handoff. Add the actual reviewed and pending information to the shared record.",
                "requires": []
              },
              {
                "id": "reviewed-glucose",
                "label": "The reviewed plasma glucose is 286 mg/dL; this number alone is not the full pattern.",
                "appropriate": true,
                "feedback": "Include the value without inventing the unreviewed components.",
                "requires": [
                  "plasma-glucose"
                ]
              },
              {
                "id": "reviewed-pattern",
                "label": "The reviewed reports show glucose 286 mg/dL, ketones 4.8 mmol/L, pH 7.22 and bicarbonate 13 mmol/L.",
                "appropriate": true,
                "feedback": "A report-specific combined statement is available only after all its components were reviewed.",
                "requires": [
                  "plasma-glucose",
                  "blood-ketones",
                  "acid-base"
                ]
              },
              {
                "id": "opening-establishes-cause",
                "label": "The initial vomiting establishes a stomach illness; hand over the glucose report as a separate issue.",
                "appropriate": false,
                "feedback": "The opening observation does not establish that cause. Keep what happened separate from the explanation.",
                "requires": []
              }
            ]
          },
          "uncertainty": {
            "prompt": "Which limit belongs with that statement?",
            "choices": [
              {
                "id": "confirmation-before-handoff",
                "label": "Hold the handoff until a single cause is confirmed, so the receiver gets no unresolved question.",
                "appropriate": false,
                "feedback": "An unresolved question belongs in an early handoff. It should have a named clinical receiver, not be silently withheld.",
                "requires": []
              },
              {
                "id": "pattern-scope",
                "label": "The combined reports fit ketoacidosis here; the precipitant and care decisions remain for the supervisor.",
                "appropriate": true,
                "feedback": "A supported synthesis does not transfer clinical responsibility to the student. Real metabolic presentations can overlap.",
                "requires": [
                  "plasma-glucose",
                  "blood-ketones",
                  "acid-base"
                ]
              },
              {
                "id": "opening-scope",
                "label": "The opening symptoms alone do not establish a cause; stronger claims must cite reviewed findings.",
                "appropriate": true,
                "feedback": "This limits the opening account without pretending later reports are still unknown.",
                "requires": []
              }
            ]
          },
          "nextOwner": {
            "prompt": "Who follows up the remaining concern?",
            "choices": [
              {
                "id": "named-next-review",
                "label": "Confirm the supervising clinician owns the next review and how new reports or symptom changes reach them.",
                "appropriate": true,
                "feedback": "Identify an accountable receiver and an update route. This assigns communication responsibility, not treatment.",
                "requires": []
              },
              {
                "id": "task-implies-transfer",
                "label": "Use the completed request as the transfer of responsibility; the receiving worklist can assign the next review.",
                "appropriate": false,
                "feedback": "A sent request is not evidence that another person accepted the concern or the next review.",
                "requires": []
              }
            ]
          }
        },
        "readback": {
          "prompt": "Which reply can you verify to close the loop?",
          "choices": [
            {
              "id": "worklist-acknowledgment",
              "label": "“I can see the request in the worklist. The next person reading the results can arrange further review.”",
              "appropriate": false,
              "feedback": "The concern and accountable next reviewer have not been repeated or accepted. Ask the receiver to clarify them.",
              "requires": []
            },
            {
              "id": "specific-readback",
              "label": "“I heard the vomiting, fatigue and abdominal discomfort concern. I accept the next review; repeat what is reviewed and what needs follow-up.”",
              "appropriate": true,
              "feedback": "Check the repeated concern, known findings and owner against your message; correct a mismatch before closing the loop.",
              "requires": []
            }
          ]
        },
        "sources": [
          {
            "title": "WHO Emergency Care Toolkit: Interagency Integrated Triage Tool",
            "url": "https://www.who.int/teams/integrated-health-services/clinical-services-and-systems/emergency-and-critical-care/emergency-care-toolkit",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Prioritizing clinical concern separately from establishing a diagnosis. These role-specific exercises do not implement or validate a triage scale."
          },
          {
            "title": "NICE CG50: recognising and responding to deterioration",
            "url": "https://www.nice.org.uk/guidance/CG50/chapter/recommendations",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Clinical concern, response ownership and reassessment. No physiological thresholds, observation intervals or treatment instructions are introduced."
          },
          {
            "title": "AHRQ TeamSTEPPS: Handoff",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Communicating known information, uncertainty, responsibility and contingencies, with acknowledgment by the receiver. The scripted handoffs are fictional examples."
          },
          {
            "title": "AHRQ TeamSTEPPS: Check-Back (or Repeat-Back)",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/checkback.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Receiver repetition followed by sender verification, including family communication. An acknowledgment does not establish a diagnosis or complete pending tasks."
          }
        ],
        "reviewProvenance": {
          "status": "unreviewed",
          "ownerReportedPriorClinicianReview": true,
          "priorReviewScope": "unverified",
          "priorReviewVersion": "unverified",
          "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
        },
        "workboardPrompt": "Choose work to follow up; reports may arrive together.",
        "patientUpdates": [
          {
            "id": "thirst-tiredness-change",
            "afterRound": 1,
            "requiresReviewed": [],
            "text": "Authored fictional change after arrival: the patient tells the student that thirst persists and tiredness has increased; the patient is still conversant. No new laboratory or examination result is supplied.",
            "prompt": "What should you bring to the supervisor?",
            "choices": [
              {
                "id": "communicate-change",
                "label": "Report persistent thirst and increased tiredness, state that the patient is conversant, and confirm the supervisor accepts review.",
                "appropriate": true,
                "feedback": "Communicate the actual reported change and confirm a clinical owner. It neither establishes the cause nor predicts the outcome.",
                "requires": []
              },
              {
                "id": "defer-change-to-summary",
                "label": "Keep the symptom update for the completed laboratory synthesis, using conversation as reassurance while the reports are pending.",
                "appropriate": false,
                "feedback": "The new concern needs to reach the responsible clinician with its full detail. A pending report or one improved feature does not replace that communication.",
                "requires": []
              }
            ]
          }
        ]
      },
      "familyId": "stu-003-after-weekend-investigation",
      "familyTitle": "After the Weekend",
      "recordLabel": "Arrival A",
      "workboardPrompt": "Choose work to follow up; reports may arrive together.",
      "authoredFiction": true,
      "reviewProvenance": {
        "status": "unreviewed",
        "ownerReportedPriorClinicianReview": true,
        "priorReviewScope": "unverified",
        "priorReviewVersion": "unverified",
        "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
      },
      "transferQuestion": {
        "version": 1,
        "synthetic": true,
        "reviewStatus": "pending_human_review",
        "sourceCheckedDate": "2026-10-16",
        "delivery": "after-another-arrival",
        "id": "hyperosmolar-pattern-contrast-v4",
        "prompt": "A different fictional record has glucose 720 mg/dL, total osmolality 334 mOsm/kg, ketones 0.8 mmol/L, pH 7.36 and bicarbonate 23 mmol/L. Which explanation fits the combination?",
        "choices": [
          {
            "id": "dka",
            "label": "The high glucose establishes ketoacidosis; the other components describe its severity.",
            "feedback": "Glucose alone does not establish ketoacidosis. These supplied ketone and acid-base results do not show that pattern."
          },
          {
            "id": "hhs",
            "label": "Severe hyperglycemia and hyperosmolality without significant ketosis or acidosis fit the HHS pattern.",
            "feedback": "The combined components distinguish this authored pattern. They do not settle the precipitant or care decisions, and real presentations can overlap."
          },
          {
            "id": "reassured",
            "label": "The non-acidotic pH makes the glucose and osmolality findings a secondary concern.",
            "feedback": "A non-acidotic pH is not reassurance about the full metabolic picture. The glucose and osmolality remain material findings."
          }
        ],
        "answerId": "hhs",
        "source": {
          "title": "ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus",
          "url": "https://doi.org/10.2337/dci24-0032",
          "scope": "Compare the combined DKA criteria with severe hyperglycemia, hyperosmolality and absence of significant ketosis/acidosis in HHS. The fictional alternatives are simplified; real presentations can overlap. No treatment content is used.",
          "checkedDate": "2026-10-16"
        }
      }
    },
    "transfer": {
      "version": 1,
      "synthetic": true,
      "reviewStatus": "pending_human_review",
      "sourceCheckedDate": "2026-10-16",
      "delivery": "after-another-arrival",
      "id": "hyperosmolar-pattern-contrast-v4",
      "prompt": "A different fictional record has glucose 720 mg/dL, total osmolality 334 mOsm/kg, ketones 0.8 mmol/L, pH 7.36 and bicarbonate 23 mmol/L. Which explanation fits the combination?",
      "choices": [
        {
          "id": "dka",
          "label": "The high glucose establishes ketoacidosis; the other components describe its severity.",
          "feedback": "Glucose alone does not establish ketoacidosis. These supplied ketone and acid-base results do not show that pattern."
        },
        {
          "id": "hhs",
          "label": "Severe hyperglycemia and hyperosmolality without significant ketosis or acidosis fit the HHS pattern.",
          "feedback": "The combined components distinguish this authored pattern. They do not settle the precipitant or care decisions, and real presentations can overlap."
        },
        {
          "id": "reassured",
          "label": "The non-acidotic pH makes the glucose and osmolality findings a secondary concern.",
          "feedback": "A non-acidotic pH is not reassurance about the full metabolic picture. The glucose and osmolality remain material findings."
        }
      ],
      "answerId": "hhs",
      "source": {
        "title": "ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus",
        "url": "https://doi.org/10.2337/dci24-0032",
        "scope": "Compare the combined DKA criteria with severe hyperglycemia, hyperosmolality and absence of significant ketosis/acidosis in HHS. The fictional alternatives are simplified; real presentations can overlap. No treatment content is used.",
        "checkedDate": "2026-10-16"
      }
    }
  },
  {
    "episode": {
      "id": "stu-003-after-weekend-investigation-record-b",
      "version": 4,
      "title": "After the Weekend",
      "subtitle": "Follow the concern. Review the record. Hand it over.",
      "opening": "A 26-year-old arrives after a weekend away with vomiting, fatigue and abdominal discomfort. The team is already assessing the patient. The first handoff suggests a stomach illness, but the record is incomplete.",
      "disclaimer": "Educational fiction pending human review. Reports, changes and update rounds are authored; they are not clinical advice or patient outcomes.",
      "reviewStatus": "pending_human_review",
      "presentation": {
        "audience": "student",
        "playMinutes": "5-8",
        "image": "./assets/episodes/stu-001-dka-escalation-720.webp",
        "imageAlt": "Generated illustration of a young adult under observation with a hospital team. Not diagnostic evidence."
      },
      "sources": [
        {
          "title": "ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus report",
          "url": "https://doi.org/10.2337/dci24-0032",
          "checkedUtc": "2026-10-16T04:29:45Z",
          "scope": "Diagnosis requires the combined glucose/diabetes, ketone and metabolic-acidosis criteria. HHS involves hyperosmolality without significant ketosis or acidosis; no treatment recommendations are used. Fictional values are not source patient data."
        },
        {
          "title": "2024 consensus report: open full text, diagnostic criteria section",
          "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11272983/",
          "checkedUtc": "2026-10-16T04:29:45Z",
          "scope": "Primary consensus text for the three-part DKA argument and the competing HHS pattern. Used only to check authored evidence relations, not care decisions."
        },
        {
          "title": "ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus",
          "url": "https://doi.org/10.2337/dci24-0032",
          "scope": "Compare the combined DKA criteria with severe hyperglycemia, hyperosmolality and absence of significant ketosis/acidosis in HHS. The fictional alternatives are simplified; real presentations can overlap. No treatment content is used.",
          "checkedDate": "2026-10-16"
        }
      ],
      "hypotheses": [
        {
          "id": "diabetic-ketoacidosis",
          "label": "Diabetic ketoacidosis"
        },
        {
          "id": "hyperosmolar-state",
          "label": "Hyperglycemic hyperosmolar state (HHS) alone"
        },
        {
          "id": "gastroenteritis",
          "label": "Gastroenteritis with dehydration"
        },
        {
          "id": "cause-unresolved",
          "label": "Cause not established by this record"
        }
      ],
      "actions": [
        {
          "id": "recent-history",
          "label": "Recent history",
          "category": "history",
          "minutes": 3,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional history: thirst and frequent urination started before the vomiting. There is no established diabetes diagnosis in the record.",
          "interpretation": "The chronology weakens a stomach-only explanation but cannot settle the metabolic diagnosis."
        },
        {
          "id": "bedside-observations",
          "label": "Bedside observations",
          "category": "examination",
          "minutes": 3,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional observations: the patient is tired but conversant, with dry mouth and abdominal discomfort.",
          "interpretation": "These observations need explanation. Conversing does not settle the metabolic pattern or its importance."
        },
        {
          "id": "plasma-glucose",
          "label": "Plasma glucose",
          "category": "laboratory",
          "minutes": 2,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional laboratory result: plasma glucose is 720 mg/dL.",
          "interpretation": "Markedly raised glucose is one component; it does not establish ketoacidosis or HHS by itself."
        },
        {
          "id": "blood-ketones",
          "label": "Blood ketones",
          "category": "laboratory",
          "minutes": 3,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional laboratory result: beta-hydroxybutyrate is 0.8 mmol/L.",
          "interpretation": "This report does not show significant ketonemia. Compare it with glucose, osmolality and acid-base findings."
        },
        {
          "id": "acid-base",
          "label": "Acid-base report",
          "category": "laboratory",
          "minutes": 4,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional laboratory results: venous pH is 7.36 and bicarbonate is 23 mmol/L.",
          "interpretation": "This report does not show the metabolic acidosis required for the authored DKA pattern. It does not make the other abnormalities unimportant."
        },
        {
          "id": "serum-osmolality",
          "label": "Serum osmolality",
          "category": "laboratory",
          "minutes": 4,
          "requires": [],
          "sourceIds": [
            0
          ],
          "finding": "Fictional laboratory result: measured total serum osmolality is 334 mOsm/kg.",
          "interpretation": "Hyperosmolality joins the other report components; this value alone does not establish the entire explanation."
        }
      ],
      "reasoning": {
        "supportLabel": "Evidence for your explanation",
        "limitationLabel": "A comparison or limit",
        "prompt": "Connect your explanation to reviewed evidence, then state a limit.",
        "caseLearningText": "Compare all four reports: severe hyperglycemia and hyperosmolality without significant ketosis or acidosis support the HHS pattern here. One value cannot carry the conclusion. These alternatives are simplified; real presentations can overlap.",
        "insufficientCitationFeedback": "Select the combined glucose, osmolality, ketone and acid-base argument. Reading all four but citing a single component does not explain how this pattern differs from ketoacidosis.",
        "openingFacts": [
          {
            "id": "opening:vomiting-fatigue-discomfort",
            "label": "Vomiting, fatigue and abdominal discomfort in the opening handoff",
            "strength": "concern",
            "supports": [
              "diabetic-ketoacidosis",
              "hyperosmolar-state",
              "gastroenteritis",
              "cause-unresolved"
            ]
          }
        ],
        "supportRules": {
          "recent-history": {
            "strength": "suggestive",
            "supports": [
              "diabetic-ketoacidosis",
              "hyperosmolar-state"
            ]
          },
          "bedside-observations": {
            "strength": "concern",
            "supports": [
              "diabetic-ketoacidosis",
              "hyperosmolar-state",
              "gastroenteritis",
              "cause-unresolved"
            ]
          },
          "plasma-glucose": {
            "strength": "component",
            "supports": [
              "diabetic-ketoacidosis",
              "hyperosmolar-state"
            ]
          },
          "blood-ketones": {
            "strength": "component",
            "supports": [
              "hyperosmolar-state"
            ],
            "conflictsWith": [
              "diabetic-ketoacidosis"
            ],
            "conflictFeedback": "The reviewed ketone value does not show the significant ketosis required for DKA in this authored record. It does not establish HHS without the other report components; real presentations can overlap."
          },
          "acid-base": {
            "strength": "component",
            "supports": [
              "hyperosmolar-state"
            ],
            "conflictsWith": [
              "diabetic-ketoacidosis"
            ],
            "conflictFeedback": "The reviewed pH and bicarbonate do not show the acidosis required for this authored DKA pattern. They do not establish HHS or make the other abnormalities safe."
          },
          "serum-osmolality": {
            "strength": "component",
            "supports": [
              "hyperosmolar-state"
            ]
          }
        },
        "supportGroups": [
          {
            "id": "pattern:hyperosmolar-components",
            "label": "Glucose, osmolality, ketones and acid-base together",
            "requires": [
              "plasma-glucose",
              "blood-ketones",
              "acid-base",
              "serum-osmolality"
            ],
            "strength": "decisive",
            "supports": [
              "hyperosmolar-state"
            ]
          }
        ],
        "uncertaintyOptions": [
          {
            "id": "symptoms-not-confirmation",
            "label": "Vomiting and discomfort alone do not establish a metabolic cause.",
            "requires": [],
            "scope": "provisional"
          },
          {
            "id": "history-limits",
            "label": "The symptom chronology suggests a metabolic concern but does not distinguish its laboratory pattern.",
            "requires": [
              "recent-history"
            ],
            "scope": "provisional",
            "missingAny": [
              "plasma-glucose",
              "blood-ketones",
              "acid-base",
              "serum-osmolality"
            ]
          },
          {
            "id": "partial-pattern",
            "label": "Glucose alone does not distinguish HHS from DKA; another component is still missing from my route.",
            "requires": [
              "plasma-glucose"
            ],
            "scope": "provisional",
            "missingAny": [
              "blood-ketones",
              "acid-base",
              "serum-osmolality"
            ]
          },
          {
            "id": "hyperosmolar-scope",
            "label": "The combined reports support HHS here, but do not establish its precipitant or every care decision.",
            "requires": [
              "plasma-glucose",
              "blood-ketones",
              "acid-base",
              "serum-osmolality"
            ],
            "scope": "supported",
            "forHypotheses": [
              "hyperosmolar-state"
            ]
          },
          {
            "id": "acid-base-limit",
            "label": "A non-acidotic pH alone cannot make the glucose and osmolality findings unimportant.",
            "requires": [
              "acid-base"
            ],
            "scope": "any"
          },
          {
            "id": "all-excluded",
            "label": "The non-acidotic pH excludes an important metabolic problem.",
            "requires": [],
            "scope": "unsupported"
          }
        ]
      },
      "resolution": {
        "hypothesisId": "hyperosmolar-state",
        "conclusionKind": "diagnostic",
        "evidenceActionIds": [
          "plasma-glucose",
          "blood-ketones",
          "acid-base",
          "serum-osmolality"
        ],
        "supportedSummary": "The combined fictional reports fit the HHS pattern: severe hyperglycemia and hyperosmolality without significant ketosis or acidosis.",
        "mismatchSummary": "The combined reports favor the hyperosmolar pattern over the selected explanation in this fictional record. Raised glucose alone was not enough to choose.",
        "provisionalSummary": "At least one of glucose, osmolality, ketones or acid-base was not reviewed. This remains a partial metabolic argument.",
        "decisiveClue": "Glucose 720 mg/dL, total osmolality 334 mOsm/kg, beta-hydroxybutyrate 0.8 mmol/L, pH 7.36 and bicarbonate 23 mmol/L form the authored pattern.",
        "missingClue": "At least one of the four required report components is missing from this route.",
        "nextLearning": "Compare the full pattern. Very high glucose does not by itself mean ketoacidosis, and a non-acidotic pH does not mean no major metabolic concern.",
        "limitations": [
          "Authored fictional records pending human medical review; source references support educational framing, not these patient measurements or events.",
          "Update rounds are narrative release events, not clinical minutes, recommended waits or an investigation sequence. Emergency assessment continues independently.",
          "No treatment, dose, eligibility, prognosis or patient outcome is modeled. A recorded explanation does not establish clinical competence.",
          "Earlier owner-reported clinician review has unverified scope and version; it does not cover these new records or workflow events."
        ]
      },
      "careWorkflow": {
        "episodeId": "stu-003-after-weekend-investigation-record-b",
        "version": 1,
        "role": {
          "label": "Student reporting to a supervising clinician",
          "boundary": "Offer a synthesis and questions to the supervisor. Independent test orders, treatment and care decisions are outside the student role."
        },
        "timingNote": "Fictional update rounds release reports and narrative events. They are not minutes, recommended waits or a prescribed clinical sequence.",
        "priority": {
          "prompt": "Who needs the opening concern before its cause is settled?",
          "choices": [
            {
              "id": "finish-record-before-contact",
              "label": "Collect the remaining reports first, then ask the supervising clinician to accept the complete explanation.",
              "appropriate": false,
              "feedback": "A fuller record may refine the explanation. It does not replace early shared awareness and responsibility for the presenting concern.",
              "requires": []
            },
            {
              "id": "share-opening-concern",
              "label": "Share vomiting, fatigue and abdominal discomfort with the supervising clinician and confirm who accepts review.",
              "appropriate": true,
              "feedback": "Communicate the concern and uncertainty early; a diagnostic label is not required to name a review owner.",
              "requires": []
            }
          ]
        },
        "tasks": {
          "recent-history": {
            "owner": "Supervising clinician",
            "label": "Follow up: recent history",
            "rounds": 1
          },
          "bedside-observations": {
            "owner": "Supervising clinician",
            "label": "Follow up: bedside observations",
            "rounds": 1
          },
          "plasma-glucose": {
            "owner": "Supervising clinician",
            "label": "Follow up: plasma glucose",
            "rounds": 1
          },
          "blood-ketones": {
            "owner": "Supervising clinician",
            "label": "Follow up: blood ketones",
            "rounds": 2
          },
          "acid-base": {
            "owner": "Supervising clinician",
            "label": "Follow up: acid-base report",
            "rounds": 2
          },
          "serum-osmolality": {
            "owner": "Supervising clinician",
            "label": "Follow up: serum osmolality",
            "rounds": 2
          }
        },
        "reassessment": {
          "minimumReviewed": 1,
          "update": "Fictional team checkpoint: identify what you reviewed, what remains pending and who accepts the next review. This checkpoint supplies no additional examination or laboratory finding.",
          "prompt": "What does the next review need from you?",
          "choices": [
            {
              "id": "review-known-and-pending",
              "label": "Separate reviewed from pending information and confirm that the supervising clinician owns the next review.",
              "appropriate": true,
              "feedback": "Report availability and clinical ownership are different. Bring the actual evidence and remaining question to the named receiver.",
              "requires": []
            },
            {
              "id": "review-after-worklist",
              "label": "Wait for the worklist to finish, then ask the supervising clinician to review one final summary.",
              "appropriate": false,
              "feedback": "The concern needs an owner while work continues. A final summary cannot replace an accepted next review now.",
              "requires": []
            }
          ],
          "variants": [
            {
              "id": "glucose-component-limit",
              "requires": [
                "plasma-glucose"
              ],
              "prompt": "What can glucose 720 mg/dL establish alone?",
              "choices": [
                {
                  "id": "reassess-glucose-completes",
                  "label": "Use the glucose value to establish ketoacidosis; treat the remaining reports as severity details.",
                  "appropriate": false,
                  "feedback": "Raised glucose alone is insufficient for ketoacidosis. Ketones and acid-base findings address distinct parts of the explanation.",
                  "requires": []
                },
                {
                  "id": "reassess-glucose-component",
                  "label": "Report raised glucose as one component; compare ketones, acid-base and any reviewed osmolality separately.",
                  "appropriate": true,
                  "feedback": "The full metabolic argument depends on the relevant combination. A single component does not establish the pattern.",
                  "requires": []
                }
              ]
            }
          ]
        },
        "handoff": {
          "receiver": {
            "prompt": "Who accepts this concern?",
            "choices": [
              {
                "id": "named-clinical-receiver",
                "label": "The supervising clinician responsible for this assessment.",
                "appropriate": true,
                "feedback": "Name the clinical receiver and verify acceptance of the concern.",
                "requires": []
              },
              {
                "id": "worklist-receiver",
                "label": "The shared results worklist, with the next reader deciding who receives the concern.",
                "appropriate": false,
                "feedback": "A worklist records tasks; it does not show who accepted responsibility.",
                "requires": []
              }
            ]
          },
          "situation": {
            "prompt": "Which known fact will you carry forward?",
            "choices": [
              {
                "id": "opening-establishes-cause",
                "label": "The initial vomiting establishes a stomach illness; hand over the glucose report as a separate issue.",
                "appropriate": false,
                "feedback": "The opening observation does not establish that cause. Keep what happened separate from the explanation.",
                "requires": []
              },
              {
                "id": "reviewed-pattern",
                "label": "The reviewed reports show glucose 720 mg/dL, total osmolality 334 mOsm/kg, ketones 0.8 mmol/L, pH 7.36 and bicarbonate 23 mmol/L.",
                "appropriate": true,
                "feedback": "A report-specific combined statement is available only after all its components were reviewed.",
                "requires": [
                  "plasma-glucose",
                  "serum-osmolality",
                  "blood-ketones",
                  "acid-base"
                ]
              },
              {
                "id": "reviewed-glucose",
                "label": "The reviewed plasma glucose is 720 mg/dL; this number alone is not the full pattern.",
                "appropriate": true,
                "feedback": "Include the value without inventing the unreviewed components.",
                "requires": [
                  "plasma-glucose"
                ]
              },
              {
                "id": "opening-concern",
                "label": "A 26-year-old arrived with vomiting, fatigue and abdominal discomfort; the stomach-illness account was incomplete.",
                "appropriate": true,
                "feedback": "This is an opening fact, available for an early handoff. Add the actual reviewed and pending information to the shared record.",
                "requires": []
              }
            ]
          },
          "uncertainty": {
            "prompt": "Which limit belongs with that statement?",
            "choices": [
              {
                "id": "opening-scope",
                "label": "The opening symptoms alone do not establish a cause; stronger claims must cite reviewed findings.",
                "appropriate": true,
                "feedback": "This limits the opening account without pretending later reports are still unknown.",
                "requires": []
              },
              {
                "id": "pattern-scope",
                "label": "The combined reports fit the HHS pattern here; the precipitant and care decisions remain for the supervisor.",
                "appropriate": true,
                "feedback": "A supported synthesis does not transfer clinical responsibility to the student. Real metabolic presentations can overlap.",
                "requires": [
                  "plasma-glucose",
                  "serum-osmolality",
                  "blood-ketones",
                  "acid-base"
                ]
              },
              {
                "id": "confirmation-before-handoff",
                "label": "Hold the handoff until a single cause is confirmed, so the receiver gets no unresolved question.",
                "appropriate": false,
                "feedback": "An unresolved question belongs in an early handoff. It should have a named clinical receiver, not be silently withheld.",
                "requires": []
              }
            ]
          },
          "nextOwner": {
            "prompt": "Who follows up the remaining concern?",
            "choices": [
              {
                "id": "task-implies-transfer",
                "label": "Use the completed request as the transfer of responsibility; the receiving worklist can assign the next review.",
                "appropriate": false,
                "feedback": "A sent request is not evidence that another person accepted the concern or the next review.",
                "requires": []
              },
              {
                "id": "named-next-review",
                "label": "Confirm the supervising clinician owns the next review and how new reports or symptom changes reach them.",
                "appropriate": true,
                "feedback": "Identify an accountable receiver and an update route. This assigns communication responsibility, not treatment.",
                "requires": []
              }
            ]
          }
        },
        "readback": {
          "prompt": "Which reply can you verify to close the loop?",
          "choices": [
            {
              "id": "specific-readback",
              "label": "“I heard the vomiting, fatigue and abdominal discomfort concern. I accept the next review; repeat what is reviewed and what needs follow-up.”",
              "appropriate": true,
              "feedback": "Check the repeated concern, known findings and owner against your message; correct a mismatch before closing the loop.",
              "requires": []
            },
            {
              "id": "worklist-acknowledgment",
              "label": "“I can see the request in the worklist. The next person reading the results can arrange further review.”",
              "appropriate": false,
              "feedback": "The concern and accountable next reviewer have not been repeated or accepted. Ask the receiver to clarify them.",
              "requires": []
            }
          ]
        },
        "sources": [
          {
            "title": "WHO Emergency Care Toolkit: Interagency Integrated Triage Tool",
            "url": "https://www.who.int/teams/integrated-health-services/clinical-services-and-systems/emergency-and-critical-care/emergency-care-toolkit",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Prioritizing clinical concern separately from establishing a diagnosis. These role-specific exercises do not implement or validate a triage scale."
          },
          {
            "title": "NICE CG50: recognising and responding to deterioration",
            "url": "https://www.nice.org.uk/guidance/CG50/chapter/recommendations",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Clinical concern, response ownership and reassessment. No physiological thresholds, observation intervals or treatment instructions are introduced."
          },
          {
            "title": "AHRQ TeamSTEPPS: Handoff",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Communicating known information, uncertainty, responsibility and contingencies, with acknowledgment by the receiver. The scripted handoffs are fictional examples."
          },
          {
            "title": "AHRQ TeamSTEPPS: Check-Back (or Repeat-Back)",
            "url": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/checkback.html",
            "checkedUtc": "2026-10-16T06:06:44Z",
            "scope": "Receiver repetition followed by sender verification, including family communication. An acknowledgment does not establish a diagnosis or complete pending tasks."
          }
        ],
        "reviewProvenance": {
          "status": "unreviewed",
          "ownerReportedPriorClinicianReview": true,
          "priorReviewScope": "unverified",
          "priorReviewVersion": "unverified",
          "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
        },
        "workboardPrompt": "Choose work to follow up; reports may arrive together.",
        "patientUpdates": [
          {
            "id": "thirst-tiredness-change",
            "afterRound": 1,
            "requiresReviewed": [],
            "text": "Authored fictional change after arrival: the patient tells the student that thirst persists and tiredness has increased; the patient is still conversant. No new laboratory or examination result is supplied.",
            "prompt": "What should you bring to the supervisor?",
            "choices": [
              {
                "id": "defer-change-to-summary",
                "label": "Keep the symptom update for the completed laboratory synthesis, using conversation as reassurance while the reports are pending.",
                "appropriate": false,
                "feedback": "The new concern needs to reach the responsible clinician with its full detail. A pending report or one improved feature does not replace that communication.",
                "requires": []
              },
              {
                "id": "communicate-change",
                "label": "Report persistent thirst and increased tiredness, state that the patient is conversant, and confirm the supervisor accepts review.",
                "appropriate": true,
                "feedback": "Communicate the actual reported change and confirm a clinical owner. It neither establishes the cause nor predicts the outcome.",
                "requires": []
              }
            ]
          }
        ]
      },
      "familyId": "stu-003-after-weekend-investigation",
      "familyTitle": "After the Weekend",
      "recordLabel": "Arrival B",
      "workboardPrompt": "Choose work to follow up; reports may arrive together.",
      "authoredFiction": true,
      "reviewProvenance": {
        "status": "unreviewed",
        "ownerReportedPriorClinicianReview": true,
        "priorReviewScope": "unverified",
        "priorReviewVersion": "unverified",
        "text": "The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review."
      },
      "transferQuestion": {
        "version": 1,
        "synthetic": true,
        "reviewStatus": "pending_human_review",
        "sourceCheckedDate": "2026-10-16",
        "delivery": "after-another-arrival",
        "id": "ketoacidotic-pattern-contrast-v4",
        "prompt": "A different fictional arrival has glucose 410 mg/dL, beta-hydroxybutyrate 5.2 mmol/L, venous pH 7.25 and bicarbonate 16 mmol/L. Which explanation uses this different combination?",
        "choices": [
          {
            "id": "hhs-by-memory",
            "label": "HHS alone, treating the ketones and acidosis as nonspecific effects of dehydration.",
            "feedback": "The significant ketones and acidosis are required parts of the ketoacidotic pattern, not findings to discard. Real presentations can overlap."
          },
          {
            "id": "dka-pattern",
            "label": "Ketoacidosis is supported by raised glucose, significant ketones and acidosis together.",
            "feedback": "The three components form the authored ketoacidotic pattern. Do not reuse the earlier HHS conclusion just because both involve high glucose."
          },
          {
            "id": "glucose-alone",
            "label": "Keep ketoacidosis unsupported until an osmolality report completes its diagnostic pattern.",
            "feedback": "Osmolality can help compare explanations, but it is not a substitute for or an additional requirement of the supplied three-part DKA argument."
          }
        ],
        "answerId": "dka-pattern",
        "source": {
          "title": "ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus",
          "url": "https://doi.org/10.2337/dci24-0032",
          "scope": "Compare the combined DKA criteria with severe hyperglycemia, hyperosmolality and absence of significant ketosis/acidosis in HHS. The fictional alternatives are simplified; real presentations can overlap. No treatment content is used.",
          "checkedDate": "2026-10-16"
        }
      }
    },
    "transfer": {
      "version": 1,
      "synthetic": true,
      "reviewStatus": "pending_human_review",
      "sourceCheckedDate": "2026-10-16",
      "delivery": "after-another-arrival",
      "id": "ketoacidotic-pattern-contrast-v4",
      "prompt": "A different fictional arrival has glucose 410 mg/dL, beta-hydroxybutyrate 5.2 mmol/L, venous pH 7.25 and bicarbonate 16 mmol/L. Which explanation uses this different combination?",
      "choices": [
        {
          "id": "hhs-by-memory",
          "label": "HHS alone, treating the ketones and acidosis as nonspecific effects of dehydration.",
          "feedback": "The significant ketones and acidosis are required parts of the ketoacidotic pattern, not findings to discard. Real presentations can overlap."
        },
        {
          "id": "dka-pattern",
          "label": "Ketoacidosis is supported by raised glucose, significant ketones and acidosis together.",
          "feedback": "The three components form the authored ketoacidotic pattern. Do not reuse the earlier HHS conclusion just because both involve high glucose."
        },
        {
          "id": "glucose-alone",
          "label": "Keep ketoacidosis unsupported until an osmolality report completes its diagnostic pattern.",
          "feedback": "Osmolality can help compare explanations, but it is not a substitute for or an additional requirement of the supplied three-part DKA argument."
        }
      ],
      "answerId": "dka-pattern",
      "source": {
        "title": "ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus",
        "url": "https://doi.org/10.2337/dci24-0032",
        "scope": "Compare the combined DKA criteria with severe hyperglycemia, hyperosmolality and absence of significant ketosis/acidosis in HHS. The fictional alternatives are simplified; real presentations can overlap. No treatment content is used.",
        "checkedDate": "2026-10-16"
      }
    }
  }
]);
