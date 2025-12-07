#!/usr/bin/env bun
// Import labeled emails into the main dataset and evaluate

import { readFileSync, writeFileSync } from "fs";
import { classifyEmail } from "./classifier.ts";
import type { EmailInput } from "./types.ts";

interface LabeledEmail {
  thread_id: string;
  subject: string;
  from: string;
  to?: string;
  cc?: string;
  date: string;
  body: string;
  labels?: string[];
  is_in_inbox?: boolean;
  pertains: boolean;
  reason: string;
  labeled_at: string;
}

interface LabeledData {
  exported_at: string;
  labeled_at?: string;
  total_count: number;
  label?: string;
  emails: LabeledEmail[];
}

interface DatasetEmail extends LabeledEmail {
  confidence?: string;
}

interface Dataset {
  exported_at: string;
  total_count: number;
  label: string;
  emails: DatasetEmail[];
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error("Usage: bun import-labeled.ts <labeled-file.json> [dataset-file.json]");
    process.exit(1);
  }

  const inputFile = args[0];
  const datasetFile = args[1] || "data/labeled-emails.json";

  console.log(`📥 Importing labeled emails from ${inputFile}...`);
  
  let newData: LabeledData;
  try {
    newData = JSON.parse(readFileSync(inputFile, "utf-8"));
  } catch (e) {
    console.error(`Failed to read ${inputFile}:`, e);
    process.exit(1);
  }

  console.log(`📊 Loading existing dataset from ${datasetFile}...`);
  
  let dataset: Dataset;
  try {
    dataset = JSON.parse(readFileSync(datasetFile, "utf-8"));
  } catch (e) {
    console.error(`Failed to read ${datasetFile}:`, e);
    process.exit(1);
  }

  // Check for duplicates by thread_id
  const existingThreadIds = new Set(dataset.emails.map(e => e.thread_id));
  const newEmails = newData.emails.filter(e => !existingThreadIds.has(e.thread_id));
  const skipped = newData.emails.length - newEmails.length;

  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} duplicate emails`);
  }

  if (newEmails.length === 0) {
    console.log("❌ No new emails to import");
    return;
  }

  console.log(`✅ Importing ${newEmails.length} new labeled emails`);

  // Add confidence field for consistency (human labels are high confidence)
  const emailsWithConfidence: DatasetEmail[] = newEmails.map(e => ({
    ...e,
    confidence: "high"
  }));

  // Merge into dataset
  dataset.emails.push(...emailsWithConfidence);
  dataset.total_count = dataset.emails.length;
  dataset.exported_at = new Date().toISOString();

  // Save updated dataset
  writeFileSync(datasetFile, JSON.stringify(dataset, null, 2));
  console.log(`💾 Saved ${dataset.total_count} total emails to ${datasetFile}`);

  // Evaluate the classifier on new emails
  console.log("\n" + "=".repeat(80));
  console.log("🧪 Evaluating classifier on newly labeled emails...");
  console.log("=".repeat(80));

  let correct = 0;
  let incorrect = 0;
  const failures: Array<{
    email: LabeledEmail;
    expected: boolean;
    got: boolean;
    reason: string;
  }> = [];

  for (const email of newEmails) {
    const input: EmailInput = {
      subject: email.subject,
      from: email.from,
      body: email.body,
    };

    const result = classifyEmail(input);
    const isCorrect = result.pertains === email.pertains;

    if (isCorrect) {
      correct++;
    } else {
      incorrect++;
      failures.push({
        email,
        expected: email.pertains,
        got: result.pertains,
        reason: result.reason,
      });
    }
  }

  const accuracy = ((correct / newEmails.length) * 100).toFixed(1);

  console.log(`\nResults for ${newEmails.length} new emails:`);
  console.log(`  ✅ Correct: ${correct}`);
  console.log(`  ❌ Incorrect: ${incorrect}`);
  console.log(`  📊 Accuracy: ${accuracy}%`);

  if (failures.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("❌ FAILURES - Update classifier to fix these:");
    console.log("=".repeat(80));

    failures.forEach((f, i) => {
      console.log(`\n${i + 1}. ${f.expected ? "FALSE NEGATIVE" : "FALSE POSITIVE"}`);
      console.log(`   Subject: ${f.email.subject}`);
      console.log(`   From: ${f.email.from}`);
      console.log(`   Expected: ${f.expected ? "RELEVANT" : "NOT RELEVANT"} (${f.email.reason})`);
      console.log(`   Got: ${f.got ? "RELEVANT" : "NOT RELEVANT"} (${f.reason})`);
      console.log(`   Body preview: ${f.email.body.slice(0, 200)}...`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("Next steps:");
    console.log("  1. Review failures above");
    console.log("  2. Update classifier.ts with new patterns");
    console.log("  3. Run: bun test");
    console.log("  4. Run: bun run evaluate.ts");
    console.log("  5. Run: bun run generate-gscript.ts");
    console.log("=".repeat(80));
  } else {
    console.log("\n" + "=".repeat(80));
    console.log("🎉 All new emails classified correctly!");
    console.log("=".repeat(80));
  }
}

main();
