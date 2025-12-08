// Apps Script wrapper - imports the main classifier
// This file is bundled into a single .gs file

import { classifyEmail } from "../classifier";
import type { EmailInput, ClassificationResult } from "../types";

// Configuration
const AUTO_LABEL_NAME = "College/Auto";
const FILTERED_LABEL_NAME = "College/Filtered";
const APPROVED_LABEL_NAME = "College";
const DRY_RUN = true;

const MAX_THREADS_PER_RUN = 75;
const MAX_EXECUTION_TIME_MS = 4.5 * 60 * 1000;
const GMAIL_BATCH_SIZE = 20;

// Declare global for Apps Script
declare const GmailApp: any;
declare const Logger: any;
declare const Utilities: any;
declare const ScriptApp: any;

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
  thread: any,
  autoLabel: any,
  approvedLabel: any,
  filteredLabel: any,
  stats: any
): void {
  const msg = thread.getMessages()[thread.getMessages().length - 1];
  if (!msg) throw new Error("No messages in thread");

  const meta: EmailInput = {
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
  thread: any,
  autoLabel: any,
  approvedLabel: any,
  filteredLabel: any,
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
  thread: any,
  autoLabel: any,
  filteredLabel: any,
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

// Utilities
function getOrCreateLabel(name: string): any {
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

// Export for Apps Script global scope - these become top-level functions
// Note: The bundler needs to be configured to expose these properly

// Make sure functions are not tree-shaken by referencing them
export { ensureLabels, runTriage, setupTriggers };
