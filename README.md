# College Email Spam Filter

Intelligent email classifier that automatically filters college marketing spam while keeping important emails in your inbox.

**Current Performance**: 100% accuracy on 58 labeled emails

## Quick Start

```bash
# Install dependencies
bun install

# Run tests
bun test

# Evaluate classifier
bun run evaluate

# Generate GScript for Gmail
bun run generate-gscript
# → Creates build/filter-hybrid.gs
```

## What Gets Filtered vs Kept

### ✅ Kept in Inbox
- Security alerts (password resets, account issues)
- Application confirmations
- Enrollment confirmations
- Scholarships actually awarded
- Financial aid offers ready to view
- Dual enrollment course information
- Accepted student portal access

### 🗑️ Filtered Out
- Marketing emails and newsletters
- Unsolicited college outreach
- Application reminders (haven't applied)
- Scholarship eligibility (not awarded)
- FAFSA reminders
- Campus tours and events
- Deadline extensions

## How It Works

1. **TypeScript Classifier** (`src/classifier.ts`) - Source of truth, rule-based patterns
2. **GScript Generator** (`src/generate-gscript.ts`) - Converts TS to Apps Script
3. **Gmail Automation** (`build/filter-hybrid.gs`) - Runs in Gmail every 10 minutes

### Architecture

```
TypeScript Classifier (100% accurate patterns)
  ↓
GScript Generator
  ↓
Google Apps Script (build/filter-hybrid.gs)
  ↓
Gmail Auto-Filtering
```

## Workflow for Improving the Classifier

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for detailed instructions.

```bash
# 1. Export emails from Gmail (run in Apps Script console)
exportEmailsToDrive()

# 2. Label them interactively
bun run label new-emails.json

# 3. Import and evaluate
bun run import new-emails-labeled.json

# 4. If failures, update src/classifier.ts

# 5. Test and deploy
bun test
bun run generate-gscript
# Copy build/filter-hybrid.gs to Apps Script
```

## Project Structure

```
src/
  classifier.ts         - Main classifier logic (TypeScript)
  classifier.test.ts    - Unit tests
  types.ts             - TypeScript types
  evaluate.ts          - Evaluation tool
  generate-gscript.ts  - TS → GScript generator
  label.ts             - Interactive labeling CLI
  import-labeled.ts    - Import labeled emails

scripts/
  export-from-label.gs - Export emails from Gmail

build/                 - Generated files (gitignored)
  filter-hybrid.gs     - Generated Gmail automation script

data/
  labeled-emails.json  - Main labeled dataset (58 emails)
  example-export.json  - Example unlabeled export

docs/
  WORKFLOW.md          - Detailed workflow guide
```

## Development

### Running Tests

```bash
# Unit tests
bun test

# Full evaluation on labeled dataset
bun run evaluate
```

### Adding New Patterns

1. Update `src/classifier.ts`
2. Add tests in `src/classifier.test.ts`
3. Run `bun test` to verify
4. Run `bun run generate-gscript` to update GScript
5. Deploy `build/filter-hybrid.gs` to Gmail Apps Script

### Metrics

- **Accuracy**: 100% (58/58 emails)
- **Precision**: 100% (no false positives)
- **Recall**: 100% (no false negatives)
- **F1 Score**: 100%

## Gmail Deployment

1. Run `bun run generate-gscript`
2. Open [Google Apps Script](https://script.google.com)
3. Create new project
4. Copy contents of `build/filter-hybrid.gs`
5. Copy contents of `scripts/export-from-label.gs` (for exporting emails)
6. Set `DRY_RUN = false` when ready
7. Run `setupTriggers()` to enable auto-filtering
8. Run `ensureLabels()` to create required labels

## Requirements

- [Bun](https://bun.sh) runtime
- Gmail account
- Google Apps Script (for Gmail automation)

## License

MIT
