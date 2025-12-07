# College Email Spam Filter

Intelligent email classifier that automatically filters college marketing spam while keeping important emails in your inbox.

**Current Performance**: 100% accuracy on 58 labeled emails

## Quick Start

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build Google Apps Script
bun run gas build

# Copy build/Code.gs and paste into Apps Script editor
# https://script.google.com
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

**TypeScript → Google Apps Script Pipeline**

```
src/apps-script/Code.ts (TypeScript with type safety)
  ↓
  ↓ bun run gas build (compile)
  ↓
build/Code.gs (Google Apps Script)
  ↓
  ↓ Manual copy/paste
  ↓
Google Apps Script → Gmail Auto-Filtering
```

## Gmail Deployment

```bash
# 1. Build
bun run gas build

# 2. Copy build/Code.gs contents

# 3. Paste into Google Apps Script
# https://script.google.com

# 4. Also paste scripts/export-from-label.gs
```

Once deployed:
1. Set `DRY_RUN = false` in the Apps Script editor
2. Run `setupTriggers()` to enable auto-filtering every 10 minutes
3. Run `ensureLabels()` to create required labels

## Development Workflow

### Improving the Classifier

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for detailed instructions.

```bash
# 1. Export emails from Gmail
# Run exportEmailsToDrive() in Apps Script console

# 2. Label them interactively
bun run label new-emails.json

# 3. Import and evaluate
bun run import new-emails-labeled.json

# 4. Update patterns in src/apps-script/Code.ts

# 5. Test locally
bun test

# 6. Build and deploy
bun run gas build
# Copy build/Code.gs to Apps Script editor
```

### Adding New Patterns

1. Edit `src/apps-script/Code.ts` with type-safe TypeScript
2. Add tests in `src/classifier.test.ts`
3. Run `bun test` to verify
4. Build and deploy: `bun run gas build` then copy to Apps Script

**Note**: Keep `src/classifier.ts` (local testing) and `src/apps-script/Code.ts` (deployed) in sync manually.

## Project Structure

```
src/
  apps-script/
    Code.ts             - Apps Script source (TypeScript)
    appsscript.json     - Apps Script manifest
  classifier.ts         - Core classifier (for local testing)
  classifier.test.ts    - Unit tests
  types.ts              - TypeScript types
  evaluate.ts           - Evaluation tool
  label.ts              - Interactive labeling CLI
  import-labeled.ts     - Import labeled emails
  build-gas.ts          - Build/deploy script

scripts/
  export-from-label.gs  - Export emails from Gmail

build/                  - Generated (gitignored)
  Code.gs               - Compiled Apps Script
  compiled/             - Intermediate JavaScript

data/
  labeled-emails.json   - Main dataset (58 emails)
  example-export.json   - Example export

tsconfig.apps-script.json - TypeScript config for Apps Script
```

## Commands

```bash
# Testing & Evaluation
bun test                - Run unit tests
bun run evaluate        - Evaluate on labeled dataset

# Apps Script Deployment
bun run gas build       - Compile TypeScript → .gs

# Labeling Workflow
bun run label <file>    - Label emails interactively
bun run import <file>   - Import labeled emails to dataset
```

## TypeScript Compilation

Following [Google's official TypeScript guide](https://developers.google.com/apps-script/guides/typescript):

- **Type safety**: Full `@types/google-apps-script` support
- **Modern syntax**: ES6+ features (arrow functions, classes, etc.)
- **Local development**: Edit with VS Code autocomplete
- **Manual deployment**: Build locally, copy/paste to Apps Script
- **No bundler overhead**: Simple TypeScript → JavaScript compilation

Configuration:
- `tsconfig.apps-script.json` - Targets ES2015, no modules
- `src/build-gas.ts` - Build script

## Metrics

- **Accuracy**: 100% (58/58 emails correctly classified)
- **Precision**: 100% (no false positives - no spam in inbox)
- **Recall**: 100% (no false negatives - all important emails reach inbox)
- **F1 Score**: 100%

## Requirements

- [Bun](https://bun.sh) - JavaScript runtime
- Gmail account
- Google account for Apps Script

## License

MIT

## References

- [Google Apps Script TypeScript Guide](https://developers.google.com/apps-script/guides/typescript)
- [@types/google-apps-script](https://www.npmjs.com/package/@types/google-apps-script)
