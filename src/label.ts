#!/usr/bin/env bun
// Interactive CLI tool for labeling exported emails

import { readFileSync, writeFileSync } from "fs";

interface ExportedEmail {
  thread_id: string;
  subject: string;
  from: string;
  to?: string;
  cc?: string;
  date: string;
  body: string;
  labels?: string[];
  is_in_inbox?: boolean;
}

interface LabeledEmail extends ExportedEmail {
  pertains: boolean;
  reason: string;
  labeled_at: string;
}

interface ExportData {
  exported_at: string;
  total_count: number;
  label: string;
  emails: ExportedEmail[];
}

interface LabeledData {
  exported_at: string;
  labeled_at: string;
  total_count: number;
  label: string;
  emails: LabeledEmail[];
}

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return "";
}

function truncate(text: string, maxLength: number = 300): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

async function labelEmail(email: ExportedEmail, index: number, total: number): Promise<LabeledEmail | null> {
  console.log("\n" + "=".repeat(80));
  console.log(`Email ${index + 1} of ${total}`);
  console.log("=".repeat(80));
  console.log(`From: ${email.from}`);
  console.log(`Subject: ${email.subject}`);
  console.log(`Date: ${email.date}`);
  console.log("\nBody preview:");
  console.log(truncate(email.body, 500));
  console.log("\n" + "-".repeat(80));

  const pertainsInput = await prompt("Is this relevant? (y/n/s=skip/q=quit): ");
  
  if (pertainsInput.toLowerCase() === "q") {
    return null; // Signal to quit
  }
  
  if (pertainsInput.toLowerCase() === "s") {
    console.log("Skipped");
    return null; // Signal to skip
  }

  const pertains = pertainsInput.toLowerCase() === "y";
  
  const reason = await prompt(pertains ? "Why is it relevant? " : "Why not relevant? ");

  return {
    ...email,
    pertains,
    reason: reason || (pertains ? "relevant" : "not relevant"),
    labeled_at: new Date().toISOString(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error("Usage: bun label.ts <exported-file.json> [output-file.json]");
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || inputFile.replace(".json", "-labeled.json");

  console.log(`Loading emails from ${inputFile}...`);
  
  let data: ExportData;
  try {
    data = JSON.parse(readFileSync(inputFile, "utf-8"));
  } catch (e) {
    console.error(`Failed to read ${inputFile}:`, e);
    process.exit(1);
  }

  console.log(`Loaded ${data.emails.length} emails to label`);

  const labeled: LabeledEmail[] = [];
  
  for (let i = 0; i < data.emails.length; i++) {
    const result = await labelEmail(data.emails[i], i, data.emails.length);
    
    if (result === null && i < data.emails.length - 1) {
      const continueInput = await prompt("Continue labeling? (y/n): ");
      if (continueInput.toLowerCase() !== "y") {
        console.log("\nStopping. Saving labeled emails so far...");
        break;
      }
      continue;
    }
    
    if (result) {
      labeled.push(result);
    }
  }

  if (labeled.length === 0) {
    console.log("\nNo emails labeled. Exiting without saving.");
    return;
  }

  const output: LabeledData = {
    exported_at: data.exported_at,
    labeled_at: new Date().toISOString(),
    total_count: labeled.length,
    label: data.label,
    emails: labeled,
  };

  writeFileSync(outputFile, JSON.stringify(output, null, 2));
  
  console.log("\n" + "=".repeat(80));
  console.log(`✓ Labeled ${labeled.length} emails`);
  console.log(`✓ Saved to ${outputFile}`);
  console.log("\nNext steps:");
  console.log(`  1. Review labels in ${outputFile}`);
  console.log(`  2. Run: bun import-labeled.ts ${outputFile}`);
  console.log("=".repeat(80));
}

main();
