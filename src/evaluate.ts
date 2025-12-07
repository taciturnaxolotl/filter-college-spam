#!/usr/bin/env bun
// Evaluate classifier performance against labeled test data

import { readFile } from "fs/promises";
import { EmailClassifier } from "./classifier.ts";
import type { LabeledEmail, TestCase, TestResult, ClassificationResult } from "./types.ts";

interface LabeledData {
  source_file: string;
  labeled_at: string;
  total_count: number;
  labeled_count: number;
  emails: LabeledEmail[];
}

async function evaluate() {
  console.log("📊 Evaluating Email Classifier\n");

  // Load labeled data
  const args = process.argv.slice(2);
  const labeledFile = args[0] || "data/labeled-emails.json";
  const data: LabeledData = JSON.parse(await readFile(labeledFile, "utf-8"));
  
  // Filter to only labeled emails
  const labeled = data.emails.filter(e => e.pertains !== undefined);
  
  console.log(`Loaded ${labeled.length} labeled emails`);
  console.log(`  Relevant: ${labeled.filter(e => e.pertains).length}`);
  console.log(`  Not relevant: ${labeled.filter(e => !e.pertains).length}\n`);

  // Create test cases
  const testCases: TestCase[] = labeled.map(e => ({
    input: {
      subject: e.subject,
      from: e.from,
      to: e.to,
      cc: e.cc,
      body: e.body,
      date: e.date
    },
    expected: {
      pertains: e.pertains!,
      reason: e.reason || ""
    },
    metadata: {
      thread_id: e.thread_id,
      date: e.date,
      confidence: e.confidence || "unknown",
      notes: e.notes,
      labels: e.labels
    }
  }));

  // Run classifier on all test cases
  const classifier = new EmailClassifier();
  const results: TestResult = {
    total: testCases.length,
    correct: 0,
    incorrect: 0,
    accuracy: 0,
    false_positives: 0,
    false_negatives: 0,
    precision: 0,
    recall: 0,
    f1_score: 0,
    failures: []
  };

  let truePositives = 0;
  let trueNegatives = 0;

  for (const testCase of testCases) {
    const actual = classifier.classify(testCase.input);
    const expected = testCase.expected.pertains;
    const predicted = actual.pertains;

    if (predicted === expected) {
      results.correct++;
      if (predicted) truePositives++;
      else trueNegatives++;
    } else {
      results.incorrect++;
      results.failures.push({ test_case: testCase, actual });
      
      if (predicted && !expected) {
        results.false_positives++; // Said relevant when not
      } else {
        results.false_negatives++; // Said not relevant when is
      }
    }
  }

  // Calculate metrics
  results.accuracy = results.correct / results.total;
  
  const totalPredictedPositive = truePositives + results.false_positives;
  const totalActualPositive = truePositives + results.false_negatives;
  
  results.precision = totalPredictedPositive > 0 ? truePositives / totalPredictedPositive : 0;
  results.recall = totalActualPositive > 0 ? truePositives / totalActualPositive : 0;
  results.f1_score = (results.precision + results.recall) > 0 
    ? 2 * (results.precision * results.recall) / (results.precision + results.recall)
    : 0;

  // Print results
  console.log("═".repeat(80));
  console.log("EVALUATION RESULTS");
  console.log("═".repeat(80));
  console.log(`Total test cases:     ${results.total}`);
  console.log(`Correct:              ${results.correct} (${(results.accuracy * 100).toFixed(1)}%)`);
  console.log(`Incorrect:            ${results.incorrect}`);
  console.log(`  False positives:    ${results.false_positives} (said relevant when not)`);
  console.log(`  False negatives:    ${results.false_negatives} (said not relevant when is)`);
  console.log();
  console.log(`Accuracy:             ${(results.accuracy * 100).toFixed(1)}%`);
  console.log(`Precision:            ${(results.precision * 100).toFixed(1)}% (of predicted relevant, % correct)`);
  console.log(`Recall:               ${(results.recall * 100).toFixed(1)}% (of actual relevant, % found)`);
  console.log(`F1 Score:             ${(results.f1_score * 100).toFixed(1)}%`);
  console.log("═".repeat(80));

  // Show failures
  if (results.failures.length > 0) {
    console.log("\n❌ FAILURES:\n");
    for (let i = 0; i < results.failures.length; i++) {
      const failure = results.failures[i];
      const expected = failure.test_case.expected.pertains;
      const actual = failure.actual.pertains;
      
      console.log(`${i + 1}. ${actual ? "FALSE POSITIVE" : "FALSE NEGATIVE"}`);
      console.log(`   Subject: ${failure.test_case.input.subject}`);
      console.log(`   From: ${failure.test_case.input.from}`);
      console.log(`   Expected: ${expected ? "RELEVANT" : "NOT RELEVANT"} (${failure.test_case.expected.reason})`);
      console.log(`   Got: ${actual ? "RELEVANT" : "NOT RELEVANT"} (${failure.actual.reason})`);
      console.log(`   Confidence: ${(failure.actual.confidence * 100).toFixed(0)}%`);
      console.log(`   Rules: ${failure.actual.matched_rules?.join(", ") || "none"}`);
      console.log();
    }
  } else {
    console.log("\n✅ ALL TESTS PASSED!\n");
  }

  // Summary recommendations
  console.log("═".repeat(80));
  console.log("RECOMMENDATIONS");
  console.log("═".repeat(80));
  
  if (results.accuracy >= 0.95) {
    console.log("✅ Excellent! Classifier is performing very well.");
  } else if (results.accuracy >= 0.85) {
    console.log("⚠️  Good performance, but room for improvement.");
  } else {
    console.log("❌ Poor performance. Significant improvements needed.");
  }

  if (results.false_negatives > results.false_positives) {
    console.log("⚠️  More false negatives than false positives.");
    console.log("   Risk: Missing important emails (they'll be filtered).");
    console.log("   Recommendation: Add more rules to catch relevant emails.");
  } else if (results.false_positives > results.false_negatives) {
    console.log("⚠️  More false positives than false negatives.");
    console.log("   Risk: Spam getting through to inbox.");
    console.log("   Recommendation: Tighten rules to reduce false relevance.");
  }

  if (results.recall < 0.9) {
    console.log(`⚠️  Low recall (${(results.recall * 100).toFixed(1)}%). Missing too many relevant emails.`);
  }

  if (results.precision < 0.9) {
    console.log(`⚠️  Low precision (${(results.precision * 100).toFixed(1)}%). Too many false alarms.`);
  }

  console.log("═".repeat(80));

  // Return exit code based on performance
  process.exit(results.accuracy >= 0.90 ? 0 : 1);
}

evaluate().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
