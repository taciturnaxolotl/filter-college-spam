# Crush Workflow: Adding New Email Data

This guide explains how to process new college spam emails and improve the classifier.

## Overview

The workflow involves:
1. Exporting emails from Gmail to JSON
2. Importing unlabeled emails (automatically labels based on current classifier)
3. Reviewing classifier performance
4. Updating classifier rules to fix failures
5. Testing and deploying

## Step 1: Export Emails from Gmail

### Option A: From Google Apps Script Console
1. Open [Google Apps Script](https://script.google.com)
2. Open your existing project (the one with the filter script)
3. Make sure you have `scripts/export-from-label.gs` pasted in a separate file
4. In the Apps Script editor console, run: `exportEmailsToDrive()`
5. This creates a JSON file in your Google Drive root named `college_emails_export_YYYY-MM-DD.json`
6. Download it to your `data/` directory

### Option B: Manual Gmail Export (if needed)
Create a JSON file with this structure:
```json
{
  "exported_at": "2025-12-15T18:52:04.726Z",
  "total_count": 4,
  "label": "College",
  "emails": [
    {
      "thread_id": "unique_id",
      "subject": "Email subject",
      "from": "sender@example.com",
      "to": "you@example.com",
      "cc": "",
      "date": "2025-12-15T16:24:10.000Z",
      "body": "Email body text...",
      "labels": ["College"],
      "is_in_inbox": true
    }
  ]
}
```

## Step 2: Import New Emails

Run the import script to add new emails to the labeled dataset:

```bash
bun src/import-labeled.ts data/college_emails_export_2025-12-15.json
```

This script will:
- Load the new emails from your export file
- Check for duplicates (by `thread_id`)
- Add new emails to `data/labeled-emails.json`
- Run the classifier on each new email
- Show evaluation results (accuracy, failures)

### Output Example

```
📥 Importing labeled emails from data/college_emails_export_2025-12-15.json...
📊 Loading existing dataset from data/labeled-emails.json...
✅ Importing 4 new labeled emails
💾 Saved 82 total emails to data/labeled-emails.json

================================================================================
🧪 Evaluating classifier on newly labeled emails...
================================================================================

Results for 4 new emails:
  ✅ Correct: 0
  ❌ Incorrect: 4
  📊 Accuracy: 0.0%
```

## Step 3: Review Failures

If there are failures, the script shows detailed information:

```
❌ FAILURES - Update classifier to fix these:
================================================================================

1. FALSE POSITIVE
   Subject: You have until midnight tonight to apply
   From: Wilmington College <...>
   Expected: NOT RELEVANT (undefined)
   Got: RELEVANT (Accepted student portal/deposit information)
   Body preview: Submit your Wilmington College Application for Admission...
```

**False Positive**: Classifier marked spam as relevant (needs stricter filtering)
**False Negative**: Classifier marked important email as spam (needs more permissive rules)

## Step 4: Update Classifier

Open `src/classifier.ts` and add new patterns to fix failures.

### Example: Filter Out Application Deadline Spam

For the "You have until midnight tonight to apply" spam, add to the `checkAccepted()` method:

```typescript
// Exclude "you have until midnight/tonight to apply" deadline pressure
if (/\byou\s+have\s+until\b.*\b(midnight|tonight|today)\b.*\bto\s+apply\b/.test(combined)) {
  return null;
}
```

### Example: Filter Out Scholarship Estimates

For "scholarship estimate" spam, add to `notAwardedPatterns` in `checkScholarship()`:

```typescript
// Scholarship estimate (not actual award)
/\bscholarship\s+estimate\b/,
/\byou\s+have\s+not\s+(yet\s+)?seen\s+your.*\bscholarship\b/,
/\bacademic\s+scholarship\s+estimate\b/,
```

### Pattern Tips

- Use `\b` for word boundaries: `/\bapply\b/` matches "apply" but not "reapply"
- Use `.*` to match anything between words: `/\bscholarship\b.*\bestimate\b/`
- Use `(option1|option2)` for alternatives: `/\b(midnight|tonight|today)\b/`
- Use `\s+` for whitespace: `/\byou\s+have\s+until\b/`
- Test patterns carefully - they're case-insensitive

## Step 5: Test Changes

```bash
# Run unit tests
bun test

# Evaluate on full dataset
bun src/evaluate.ts
```

Expected output:
```
════════════════════════════════════════════════════════════════════════════════
EVALUATION RESULTS
════════════════════════════════════════════════════════════════════════════════
Total test cases:     82
Correct:              82 (100.0%)
Incorrect:            0
  False positives:    0 (said relevant when not)
  False negatives:    0 (said not relevant when is)

Accuracy:             100.0%
Precision:            100.0% (of predicted relevant, % correct)
Recall:               100.0% (of actual relevant, % found)
F1 Score:             100.0%
════════════════════════════════════════════════════════════════════════════════
```

## Step 6: Build and Deploy

Build the Google Apps Script:

```bash
bun run gas build
```

This creates `build/Code.gs` which bundles the classifier with the Apps Script wrapper.

### Deploy to Gmail

1. Open [Google Apps Script](https://script.google.com)
2. Open your existing filter project
3. Open the `Code.gs` file
4. Copy all contents of `build/Code.gs`
5. Paste into the Apps Script editor (replacing old code)
6. Click **Save** (Ctrl/Cmd + S)
7. The filter will automatically run every 10 minutes (if triggers are set up)

### First Time Setup

If this is your first deployment:

1. After pasting the code, run `ensureLabels()` to create required Gmail labels
2. Run `setupTriggers()` to enable auto-filtering every 10 minutes
3. Set `DRY_RUN = false` at the top of the file to enable actual filtering

## Troubleshooting

### "Skipped N duplicate emails"

This is normal - it means those emails are already in your dataset.

### Import script fails

- Check JSON file is valid (use a JSON validator)
- Ensure `data/labeled-emails.json` exists
- Check file paths are correct

### All new emails classified wrong

- Run `bun src/evaluate.ts` to check full dataset performance
- Review the specific failure patterns in the output
- Update `src/classifier.ts` with new rules

### Pattern not working

- Test regex patterns at [regex101.com](https://regex101.com) (set flavor to JavaScript)
- Remember text is lowercased before matching
- Use `console.log(combined)` to debug what text you're matching against

## Quick Reference

```bash
# Complete workflow
bun src/import-labeled.ts data/new-emails.json  # Import & evaluate
# Review failures, update src/classifier.ts
bun test                                          # Test changes
bun src/evaluate.ts                              # Evaluate full dataset
bun run gas build                                 # Build for deployment
# Copy build/Code.gs to Google Apps Script

# Individual commands
bun test                      # Run unit tests
bun src/evaluate.ts          # Evaluate on full dataset
bun run gas build             # Build Apps Script bundle
bun src/label.ts <file>      # Interactive labeling (if needed)
```

## Classifier Architecture

The classifier uses rule-based pattern matching with priority ordering:

1. **Security** (always relevant): Password resets, account alerts
2. **Student Actions** (relevant): Application confirmations, enrollment confirmations
3. **Accepted Students** (relevant): Portal access, deposit reminders
4. **Dual Enrollment** (relevant): Course registration, schedules
5. **Scholarships Awarded** (relevant): Actually awarded scholarships
6. **Financial Aid Ready** (relevant): Aid offers ready to view
7. **Irrelevant** (not relevant): Marketing, newsletters, unsolicited outreach
8. **Default** (not relevant): If uncertain, mark as spam

Rules are evaluated in order. First match wins.

## Dataset Stats

After importing, check dataset stats:

```bash
bun src/evaluate.ts
```

Shows:
- Total emails in dataset
- Relevant vs not relevant breakdown
- Accuracy, precision, recall, F1 score
- Confusion matrix (if there are errors)

Current performance: **100% accuracy on 82 labeled emails**
