# Email Filter Improvement Workflow

This document describes the streamlined process for improving the email classifier.

## Quick Start

```bash
# 1. Export new emails from Gmail (run in Apps Script)
# Uses: export-from-label.gscript

# 2. Label the exported emails interactively
bun label.ts new-emails.json

# 3. Import labeled emails and see results
bun import-labeled.ts new-emails-labeled.json

# 4. If there are failures, update classifier.ts

# 5. Test and regenerate
bun test
bun run evaluate.ts
bun run generate-gscript.ts
```

## Detailed Workflow

### Step 1: Export Emails from Gmail

In Google Apps Script, run the export script:

```javascript
// Run this in Apps Script console
exportEmailsToDrive()
```

This exports all emails with the `College/Auto` label to a JSON file in your Google Drive.

Download the file to your project directory.

### Step 2: Label Emails Interactively

Use the interactive labeling tool:

```bash
bun label.ts college_emails_export_2025-12-07.json
```

For each email, you'll be prompted:
- `y` - Email is relevant (should go to inbox)
- `n` - Email is not relevant (should be filtered)
- `s` - Skip this email
- `q` - Quit and save labeled emails so far

When marking as relevant/not relevant, provide a short reason like:
- "password reset"
- "marketing spam"
- "scholarship awarded"
- "unsolicited outreach"

The tool saves to `college_emails_export_2025-12-07-labeled.json` by default.

### Step 3: Import and Evaluate

Import the labeled emails into the main dataset:

```bash
bun import-labeled.ts college_emails_export_2025-12-07-labeled.json
```

This will:
1. Merge new labeled emails into `college_emails_export_2025-12-05_labeled.json`
2. Check for duplicates (by thread_id)
3. Run the classifier on the new emails
4. Report any failures

### Step 4: Fix Failures

If there are classification failures, update `classifier.ts`:

**For false positives** (classifier said relevant when it's not):
- Add exclusion patterns to existing rules
- Add new patterns to `checkIrrelevant()`

**For false negatives** (classifier said not relevant when it is):
- Add new patterns to the appropriate check function
- Ensure patterns are specific enough

Example:
```typescript
// False positive: "I'm eager to consider you" triggered accepted_student
// Fix: Add exclusion in checkAccepted()
if (/\bi'?m\s+eager\s+to\s+consider\s+you\b/.test(combined)) {
  return null; // Not actually accepted
}
```

### Step 5: Test and Deploy

```bash
# Run unit tests
bun test

# Run full evaluation on all labeled emails
bun run evaluate.ts college_emails_export_2025-12-05_labeled.json

# Generate updated GScript
bun run generate-gscript.ts

# Copy filter-hybrid.gscript to Apps Script and deploy
```

## File Structure

- `export-from-label.gscript` - Apps Script to export emails from Gmail
- `label.ts` - Interactive CLI for labeling emails
- `import-labeled.ts` - Import labeled emails and evaluate
- `classifier.ts` - TypeScript classifier (source of truth)
- `generate-gscript.ts` - Generate GScript from TypeScript
- `filter-hybrid.gscript` - Generated GScript for Gmail
- `college_emails_export_*_labeled.json` - Main labeled dataset

## Tips

### Labeling Best Practices

- **Be consistent** - Use similar reasons for similar emails
- **Be specific** - "marketing spam" vs "scholarship not awarded"
- **Label in batches** - Do 10-20 at a time to stay focused
- **When in doubt** - Mark as not relevant (safer to filter)

### Common Email Categories

**Relevant** (should go to inbox):
- Password resets / security alerts
- Application confirmations
- Enrollment confirmations
- Scholarships actually awarded
- Financial aid offers ready
- Dual enrollment course info
- Accepted student portal access

**Not Relevant** (should be filtered):
- Marketing / newsletters
- Unsolicited outreach
- Application reminders
- Scholarship eligibility (not awarded)
- FAFSA reminders
- Campus events / tours
- Deadline extensions

### Classifier Pattern Tips

1. **Test patterns broadly** - Use `combined` (subject + body) for most checks
2. **Add exclusions** - Marketing often uses similar words to real notifications
3. **Be specific** - "admission decision ready" vs "you will receive an admission decision"
4. **Check order matters** - More specific checks should come before general ones

## Maintenance

### Regular Tasks

1. **Weekly**: Export new emails and label them
2. **Monthly**: Review classifier accuracy
3. **As needed**: Update patterns for new spam types

### Monitoring

Check accuracy metrics after each import:
- **Target accuracy**: >95%
- **Target precision**: >90% (low false positives)
- **Target recall**: >95% (low false negatives)

If metrics drop below targets, review recent failures and update patterns.
