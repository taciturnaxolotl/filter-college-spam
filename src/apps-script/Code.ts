// Apps Script classifier - compiled from TypeScript
// This file is the source of truth for Gmail filtering logic

// Configuration
const AUTO_LABEL_NAME = "College/Auto";
const FILTERED_LABEL_NAME = "College/Filtered";
const APPROVED_LABEL_NAME = "College";
const DRY_RUN = true;

const AI_BASE_URL = "https://ai.hackclub.com/proxy/v1/chat/completions";
const AI_MODEL = "deepseek/deepseek-r1-distill-qwen-32b";

const MAX_THREADS_PER_RUN = 75;
const MAX_EXECUTION_TIME_MS = 4.5 * 60 * 1000;
const GMAIL_BATCH_SIZE = 20;
const AI_CONFIDENCE_THRESHOLD = 0.5;

// Main entry points
function ensureLabels(): void {
  getOrCreateLabel(AUTO_LABEL_NAME);
  getOrCreateLabel(FILTERED_LABEL_NAME);
  getOrCreateLabel(APPROVED_LABEL_NAME);
  Logger.log(`Labels ensured: ${AUTO_LABEL_NAME}, ${FILTERED_LABEL_NAME}, ${APPROVED_LABEL_NAME}`);
}

function runTriage(): void {
  const startTime = Date.now();
  const autoLabel = getOrCreateLabel(AUTO_LABEL_NAME);
  const filteredLabel = getOrCreateLabel(FILTERED_LABEL_NAME);
  const approvedLabel = getOrCreateLabel(APPROVED_LABEL_NAME);

  const threads = autoLabel.getThreads(0, MAX_THREADS_PER_RUN);
  if (!threads.length) {
    Logger.log("No threads under College/Auto.");
    return;
  }

  Logger.log(`Processing ${threads.length} threads`);

  let stats = {
    wouldInbox: 0,
    wouldFiltered: 0,
    didInbox: 0,
    didFiltered: 0,
    errors: 0,
    skipped: 0
  };

  for (let i = 0; i < threads.length; i++) {
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_EXECUTION_TIME_MS) {
      Logger.log(`Time limit reached. Processed ${i}/${threads.length}`);
      stats.skipped = threads.length - i;
      break;
    }

    const thread = threads[i];
    
    try {
      processThread(thread, autoLabel, approvedLabel, filteredLabel, stats);
    } catch (e) {
      Logger.log(`ERROR: ${e}. FAIL-SAFE: Moving to inbox.`);
      stats.errors += 1;
      
      if (!DRY_RUN) {
        thread.removeLabel(autoLabel);
        thread.removeLabel(filteredLabel);
        thread.moveToInbox();
        stats.didInbox += 1;
      } else {
        stats.wouldInbox += 1;
      }
    }

    if ((i + 1) % GMAIL_BATCH_SIZE === 0) {
      Utilities.sleep(100);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  Logger.log(`Summary: Inbox=${stats.wouldInbox}/${stats.didInbox}, Filtered=${stats.wouldFiltered}/${stats.didFiltered}, Errors=${stats.errors}, Time=${totalTime}s`);
}

function processThread(
  thread: GoogleAppsScript.Gmail.GmailThread,
  autoLabel: GoogleAppsScript.Gmail.GmailLabel,
  approvedLabel: GoogleAppsScript.Gmail.GmailLabel,
  filteredLabel: GoogleAppsScript.Gmail.GmailLabel,
  stats: any
): void {
  const msg = thread.getMessages()[thread.getMessages().length - 1];
  if (!msg) throw new Error("No messages in thread");

  const meta = {
    subject: safeStr(msg.getSubject()),
    body: safeStr(msg.getPlainBody(), 10000),
    from: safeStr(msg.getFrom()),
  };

  if (!meta.subject && !meta.body) {
    Logger.log(`WARNING: No content. FAIL-SAFE: Moving to inbox.`);
    applyInboxAction(thread, autoLabel, approvedLabel, filteredLabel, stats, "no content");
    return;
  }

  const result = classifyEmail(meta);
  
  Logger.log(`[${thread.getId()}] Relevant=${result.pertains} Confidence=${result.confidence} Reason="${result.reason}"`);
  
  if (result.pertains) {
    applyInboxAction(thread, autoLabel, approvedLabel, filteredLabel, stats, result.reason);
  } else {
    applyFilteredAction(thread, autoLabel, filteredLabel, stats, result.reason);
  }
}

function applyInboxAction(
  thread: GoogleAppsScript.Gmail.GmailThread,
  autoLabel: GoogleAppsScript.Gmail.GmailLabel,
  approvedLabel: GoogleAppsScript.Gmail.GmailLabel,
  filteredLabel: GoogleAppsScript.Gmail.GmailLabel,
  stats: any,
  reason: string
): void {
  if (DRY_RUN) {
    stats.wouldInbox += 1;
    Logger.log(`  DRY_RUN: Would move to Inbox (${reason})`);
  } else {
    thread.removeLabel(autoLabel);
    thread.removeLabel(filteredLabel);
    thread.addLabel(approvedLabel);
    thread.moveToInbox();
    stats.didInbox += 1;
    Logger.log(`  Applied: Moved to Inbox (${reason})`);
  }
}

function applyFilteredAction(
  thread: GoogleAppsScript.Gmail.GmailThread,
  autoLabel: GoogleAppsScript.Gmail.GmailLabel,
  filteredLabel: GoogleAppsScript.Gmail.GmailLabel,
  stats: any,
  reason: string
): void {
  if (DRY_RUN) {
    stats.wouldFiltered += 1;
    Logger.log(`  DRY_RUN: Would filter (${reason})`);
  } else {
    thread.removeLabel(autoLabel);
    thread.addLabel(filteredLabel);
    if (thread.isInInbox()) thread.moveToArchive();
    stats.didFiltered += 1;
    Logger.log(`  Applied: Filtered (${reason})`);
  }
}

// Classifier
interface ClassificationResult {
  pertains: boolean;
  reason: string;
  confidence: number;
}

interface EmailMeta {
  subject: string;
  body: string;
  from: string;
}

function classifyEmail(meta: EmailMeta): ClassificationResult {
  const subject = meta.subject.toLowerCase();
  const body = meta.body.toLowerCase();
  const combined = subject + " " + body;

  // Security alerts - always relevant
  const securityResult = checkSecurity(combined);
  if (securityResult) return securityResult;

  // Student action confirmations
  const actionResult = checkStudentAction(combined);
  if (actionResult) return actionResult;

  // Accepted student info
  const acceptedResult = checkAccepted(combined);
  if (acceptedResult) return acceptedResult;

  // Dual enrollment
  const dualResult = checkDualEnrollment(combined);
  if (dualResult) return dualResult;

  // Scholarships
  const scholarshipResult = checkScholarship(subject, combined);
  if (scholarshipResult) return scholarshipResult;

  // Financial aid
  const aidResult = checkFinancialAid(combined);
  if (aidResult) return aidResult;

  // Marketing/spam
  const irrelevantResult = checkIrrelevant(combined);
  if (irrelevantResult) return irrelevantResult;

  // Default to not relevant
  return { pertains: false, reason: "No clear relevance indicators", confidence: 0.3 };
}

function checkSecurity(combined: string): ClassificationResult | null {
  const patterns = [
    /\bpassword\s+(reset|change|update|expired)\b/,
    /\breset\s+your\s+password\b/,
    /\baccount\s+security\b/,
    /\bsecurity\s+alert\b/,
    /\bunusual\s+(sign[- ]?in|activity)\b/,
    /\bverification\s+code\b/,
    /\b(2fa|mfa|two[- ]factor)\b/,
    /\bcompromised\s+account\b/,
    /\baccount\s+(locked|suspended)\b/,
    /\bsuspicious\s+activity\b/
  ];

  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(combined)) {
      if (/\bsaving.*\bon\s+tuition\b|\btuition.*\bsaving\b/.test(combined)) {
        continue;
      }
      return { pertains: true, reason: "Security/password alert", confidence: 1.0 };
    }
  }
  return null;
}

function checkStudentAction(combined: string): ClassificationResult | null {
  const patterns = [
    /\bapplication\s+(received|complete|submitted|confirmation)\b/,
    /\breceived\s+your\s+application\b/,
    /\bthank\s+you\s+for\s+(applying|submitting)\b/,
    /\benrollment\s+confirmation\b/,
    /\bconfirmation\s+(of|for)\s+(your\s+)?(application|enrollment)\b/,
    /\byour\s+application\s+(has\s+been|is)\s+(received|complete)\b/
  ];

  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(combined)) {
      if (/\bhow\s+to\s+apply\b|\bapply\s+now\b|\bstart\s+(your\s+)?application\b/.test(combined)) {
        continue;
      }
      return { pertains: true, reason: "Application/enrollment confirmation", confidence: 0.95 };
    }
  }
  return null;
}

function checkAccepted(combined: string): ClassificationResult | null {
  const patterns = [
    /\baccepted\s+(student\s+)?portal\b/,
    /\byour\s+(personalized\s+)?accepted\s+portal\b/,
    /\bdeposit\s+(today|now|by|to\s+reserve)\b/,
    /\breserve\s+your\s+(place|spot)\b/,
    /\bcongratulations.*\baccepted\b/,
    /\byou\s+(have\s+been|are|were)\s+accepted\b/,
    /\badmission\s+(decision|offer)\b/,
    /\benroll(ment)?\s+deposit\b/
  ];

  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(combined)) {
      if (/\bacceptance\s+rate\b|\bhigh\s+acceptance\b|\bpre[- ]admit(ted)?\b|\bautomatic\s+admission\b/.test(combined)) {
        continue;
      }
      if (/\byou\s+will\s+(also\s+)?receive\s+(an?\s+)?(accelerated\s+)?admission\s+decision\b/.test(combined)) {
        continue;
      }
      if (/\breceive\s+an\s+admission\s+decision\s+within\b/.test(combined)) {
        continue;
      }
      return { pertains: true, reason: "Accepted student information", confidence: 0.95 };
    }
  }
  return null;
}

function checkDualEnrollment(combined: string): ClassificationResult | null {
  const patterns = [
    /\bdual\s+enrollment\b/,
    /\bcourse\s+(registration|deletion|added|dropped)\b/,
    /\bspring\s+\d{4}\s+(course|on[- ]campus)\b/,
    /\bhow\s+to\s+register\b.*\b(course|class)/
  ];

  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(combined)) {
      if (/\blearn\s+more\s+about\b|\binterested\s+in\b|\bconsider\s+joining\b/.test(combined)) {
        continue;
      }
      return { pertains: true, reason: "Dual enrollment course information", confidence: 0.9 };
    }
  }
  return null;
}

function checkScholarship(subject: string, combined: string): ClassificationResult | null {
  // Specific scholarship applications
  if (/\bapply\s+for\s+(the\s+)?.*\bscholarship\b/.test(subject)) {
    if (/\bpresident'?s\b|\bministry\b|\bimpact\b/.test(combined)) {
      return { pertains: true, reason: "Scholarship application opportunity", confidence: 0.75 };
    }
  }

  // Not awarded patterns (check first)
  const notAwardedPatterns = [
    /\bscholarship\b.*\b(held|reserved)\s+for\s+you\b/,
    /\b(held|reserved)\s+for\s+you\b/,
    /\bconsider(ed|ation)\b.*\bscholarship\b/,
    /\bscholarship\b.*\bconsider(ed|ation)\b/,
    /\beligible\s+for\b.*\bscholarship\b/,
    /\bscholarship\b.*\beligible\b/,
    /\bmay\s+qualify\b.*\bscholarship\b/
  ];

  if (/\bscholarship\b/.test(combined)) {
    for (let i = 0; i < notAwardedPatterns.length; i++) {
      if (notAwardedPatterns[i].test(combined)) {
        return { pertains: false, reason: "Scholarship not actually awarded", confidence: 0.9 };
      }
    }
  }

  // Awarded patterns
  const awardedPatterns = [
    /\bcongratulations\b.*\bscholarship\b/,
    /\byou\s+(have|received|are\s+awarded|won)\b.*\bscholarship\b/,
    /\bwe\s+(are\s+)?(pleased\s+to\s+)?award(ing)?\b.*\bscholarship\b/,
    /\bscholarship\s+(offer|award)\b/
  ];

  for (let i = 0; i < awardedPatterns.length; i++) {
    if (awardedPatterns[i].test(combined)) {
      return { pertains: true, reason: "Scholarship awarded", confidence: 0.95 };
    }
  }

  return null;
}

function checkFinancialAid(combined: string): ClassificationResult | null {
  const readyPatterns = [
    /\bfinancial\s+aid\b.*\boffer\b.*\b(ready|available)\b/,
    /\baward\s+letter\b.*\b(ready|available|posted|view)\b/,
    /\b(view|review)\s+(your\s+)?award\s+letter\b/,
    /\byour\s+aid\s+is\s+ready\b/
  ];

  const notReadyPatterns = [
    /\blearn\s+more\s+about\b.*\bfinancial\s+aid\b/,
    /\bapply\b.*\b(for\s+)?financial\s+aid\b/,
    /\bcomplete\s+(your\s+)?fafsa\b/,
    /\bpriority\s+(deadline|consideration)\b.*\bfinancial\s+aid\b/
  ];

  for (let i = 0; i < readyPatterns.length; i++) {
    if (readyPatterns[i].test(combined)) {
      for (let j = 0; j < notReadyPatterns.length; j++) {
        if (notReadyPatterns[j].test(combined)) {
          return null;
        }
      }
      return { pertains: true, reason: "Financial aid offer ready", confidence: 0.95 };
    }
  }
  return null;
}

function checkIrrelevant(combined: string): ClassificationResult | null {
  const patterns = [
    /\bstudent\s+life\s+blog\b/,
    /\bnewsletter\b/,
    /\bweekly\s+(digest|update)\b/,
    /\bupcoming\s+events\b/,
    /\bjoin\s+us\s+(for|at)\b/,
    /\bopen\s+house\b/,
    /\bvirtual\s+tour\b/,
    /\bhaven'?t\s+applied.*yet\b/,
    /\bstill\s+time\s+to\s+apply\b/,
    /\bhow\s+is\s+your\s+college\s+search\b/,
    /\bextended.*\bpriority\s+deadline\b/,
    /\bpriority\s+deadline.*\bextended\b/,
    /\bsummer\s+(academy|camp|program)\b/,
    /\bugly\s+sweater\b/,
    /\bi\s+hope\s+you\s+have\s+been\s+receiving\s+my\s+emails\b/,
    /\bam\s+i\s+reaching\b/,
    /\byou\s+are\s+on\s+.*\s+(radar|list)\b/,
    /\bi\s+want\s+to\s+make\s+sure\s+you\s+know\b/,
    /\byou'?re\s+invited\s+to\s+submit\b/,
    /\bi'?m\s+eager\s+to\s+consider\s+you\b/,
    /\bsubmit\s+your\s+.*\s+application\b/,
    /\bpriority\s+status\b.*\bsubmit.*application\b/
  ];

  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(combined)) {
      return { pertains: false, reason: "Marketing/newsletter/spam", confidence: 0.95 };
    }
  }

  if (/\bhaven'?t\s+applied\b/.test(combined)) {
    return { pertains: false, reason: "Unsolicited outreach", confidence: 0.95 };
  }

  return null;
}

// Utilities
function getOrCreateLabel(name: string): GoogleAppsScript.Gmail.GmailLabel {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function safeStr(s: string | null, maxLen?: number): string {
  if (s === null || s === undefined) return "";
  const str = s.toString().trim();
  if (maxLen && str.length > maxLen) return str.slice(0, maxLen);
  return str;
}

function setupTriggers(): void {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runTriage") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Create new trigger
  ScriptApp.newTrigger("runTriage")
    .timeBased()
    .everyMinutes(10)
    .create();
  
  Logger.log("Trigger created: runTriage every 10 minutes");
}
 
