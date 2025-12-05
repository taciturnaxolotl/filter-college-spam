#!/usr/bin/env bun
// Generate GScript-compatible classifier code from TypeScript rules

import { readFile, writeFile } from "fs/promises";

// Read the classifier
const classifierSrc = await readFile("classifier.ts", "utf-8");

// Extract patterns from each rule function
const extractPatterns = (functionName: string): string[] => {
  const match = classifierSrc.match(new RegExp(`private ${functionName}[^}]+\\[([^\\]]+)\\]`, "s"));
  if (!match) return [];
  
  return match[1]
    .split(/,\s*/)
    .map(p => p.trim())
    .filter(p => p.startsWith("/"));
};

const securityPatterns = extractPatterns("checkSecurity");
const studentActionPatterns = extractPatterns("checkStudentAction");
const acceptedPatterns = extractPatterns("checkAccepted");
const scholarshipAwardedPatterns = classifierSrc.match(/awardedPatterns = \[([^\]]+)\]/s)?.[1]
  .split(/,\s*/).map(p => p.trim()).filter(p => p.startsWith("/")) || [];
const scholarshipNotAwardedPatterns = classifierSrc.match(/notAwardedPatterns = \[([^\]]+)\]/s)?.[1]
  .split(/,\s*/).map(p => p.trim()).filter(p => p.startsWith("/")) || [];
const irrelevantPatterns = extractPatterns("checkIrrelevant");

// Generate GScript code
const gscript = `
// Auto-generated from classifier.ts - DO NOT EDIT MANUALLY
// Generated at: ${new Date().toISOString()}

function classifyEmailTS(meta) {
  const subject = (meta.subject || "").toLowerCase();
  const body = (meta.body || "").toLowerCase();
  const from = (meta.from || "").toLowerCase();
  const combined = subject + " " + body;

  // Security alerts - always relevant
  const securityPatterns = [
    ${securityPatterns.join(",\n    ")}
  ];
  
  for (const pattern of securityPatterns) {
    if (pattern.test(combined)) {
      // Exclude tuition savings marketing
      if (/\\bsaving.*\\bon\\s+tuition\\b|\\btuition.*\\bsaving\\b/.test(combined)) {
        continue;
      }
      return {
        pertains: true,
        reason: "Security/password alert - always important",
        confidence: 1.0
      };
    }
  }

  // Student action confirmations
  const actionPatterns = [
    ${studentActionPatterns.join(",\n    ")}
  ];
  
  for (const pattern of actionPatterns) {
    if (pattern.test(combined)) {
      if (/\\bhow\\s+to\\s+apply\\b|\\bapply\\s+now\\b|\\bstart\\s+(your\\s+)?application\\b/.test(combined)) {
        continue;
      }
      return {
        pertains: true,
        reason: "Confirmation of student action",
        confidence: 0.95
      };
    }
  }

  // Accepted student info
  const acceptedPatterns = [
    ${acceptedPatterns.join(",\n    ")}
  ];
  
  for (const pattern of acceptedPatterns) {
    if (pattern.test(combined)) {
      if (/\\bacceptance\\s+rate\\b|\\bhigh\\s+acceptance\\b|\\bpre[- ]admit(ted)?\\b|\\bautomatic\\s+admission\\b/.test(combined)) {
        continue;
      }
      return {
        pertains: true,
        reason: "Accepted student portal/deposit information",
        confidence: 0.95
      };
    }
  }

  // Dual enrollment
  if (/\\bdual\\s+enrollment\\b|\\bcourse\\s+(registration|deletion|added|dropped)\\b/.test(combined)) {
    if (!/\\blearn\\s+more\\s+about\\b|\\binterested\\s+in\\b|\\bconsider\\s+joining\\b/.test(combined)) {
      return {
        pertains: true,
        reason: "Dual enrollment course information",
        confidence: 0.9
      };
    }
  }

  // Scholarships - check specific applications first
  if (/\\bapply\\s+for\\s+(the\\s+)?.*\\bscholarship\\b/.test(subject)) {
    if (/\\bpresident'?s\\b|\\bministry\\b|\\bimpact\\b/.test(combined)) {
      return {
        pertains: true,
        reason: "Scholarship application opportunity",
        confidence: 0.75
      };
    }
  }

  // Scholarship not awarded (check before awarded)
  const scholarshipNotAwardedPatterns = [
    ${scholarshipNotAwardedPatterns.join(",\n    ")}
  ];
  
  if (/\\bscholarship\\b/.test(combined)) {
    for (const pattern of scholarshipNotAwardedPatterns) {
      if (pattern.test(combined)) {
        return {
          pertains: false,
          reason: "Scholarship not actually awarded",
          confidence: 0.9
        };
      }
    }
  }

  // Scholarship awarded
  const scholarshipAwardedPatterns = [
    ${scholarshipAwardedPatterns.join(",\n    ")}
  ];
  
  for (const pattern of scholarshipAwardedPatterns) {
    if (pattern.test(combined)) {
      return {
        pertains: true,
        reason: "Scholarship actually awarded",
        confidence: 0.95
      };
    }
  }

  // Financial aid ready
  if (/\\bfinancial\\s+aid\\b.*\\boffer\\b.*\\b(ready|available)\\b|\\baward\\s+letter\\b.*\\b(ready|available)\\b/.test(combined)) {
    if (!/\\blearn\\s+more\\s+about\\b|\\bapply\\b|\\bcomplete\\s+(your\\s+)?fafsa\\b/.test(combined)) {
      return {
        pertains: true,
        reason: "Financial aid offer ready",
        confidence: 0.95
      };
    }
  }

  // Marketing/spam - definitely not relevant
  const irrelevantPatterns = [
    ${irrelevantPatterns.join(",\n    ")}
  ];
  
  for (const pattern of irrelevantPatterns) {
    if (pattern.test(combined)) {
      return {
        pertains: false,
        reason: "Marketing/newsletter/unsolicited outreach",
        confidence: 0.95
      };
    }
  }

  // Haven't applied yet
  if (/\\bhaven'?t\\s+applied\\b/.test(combined)) {
    return {
      pertains: false,
      reason: "Unsolicited email where student has not applied",
      confidence: 0.95
    };
  }

  // Default to not relevant
  return {
    pertains: false,
    reason: "No clear relevance indicators found",
    confidence: 0.3
  };
}
`.trim();

await writeFile("filter_generated.gscript", gscript);
console.log("✅ Generated filter_generated.gscript");
console.log("   Copy the classifyEmailTS() function into your Google Apps Script");
console.log("   and call it instead of classifyWithAI_() for offline classification");
