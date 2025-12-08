# College Email Spam Filter

Intelligent email classifier that automatically filters college marketing spam while keeping important emails in your inbox.

**Current Performance**: 100% accuracy on 63 labeled emails

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
src/classifier.ts (Core classification logic - single source of truth)
  ↓
  ↓ imported by
  ↓
src/apps-script/wrapper.ts (Apps Script wrapper)
  ↓
  ↓ bun run gas (bundle with esbuild)
  ↓
build/Code.gs (Single-file Google Apps Script)
  ↓
  ↓ Manual copy/paste
  ↓
Google Apps Script → Gmail Auto-Filtering
```

**Key Improvement**: The classifier logic is now shared between local testing and Apps Script deployment. No more manual syncing!

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

# 4. Update patterns in src/classifier.ts

# 5. Test locally
bun test

# 6. Build and deploy
bun run gas build
# Copy build/Code.gs to Apps Script editor
```

### Adding New Patterns

1. Edit `src/classifier.ts` - the single source of truth
2. Add tests in `src/classifier.test.ts`
3. Run `bun test` to verify
4. Build and deploy: `bun run gas build` then copy to Apps Script

**Note**: The Apps Script is automatically bundled from `src/classifier.ts` via `src/apps-script/wrapper.ts`

## Project Structure

```
src/
  apps-script/
    wrapper.ts            - Apps Script wrapper (imports classifier)
    Code.ts               - DEPRECATED (see wrapper.ts)
    appsscript.json       - Apps Script manifest
  classifier.ts         - Core classifier (SINGLE SOURCE OF TRUTH)
  classifier.test.ts    - Unit tests
  types.ts              - TypeScript types
  evaluate.ts           - Evaluation tool
  label.ts              - Interactive labeling CLI
  import-labeled.ts     - Import labeled emails
  build-gas.ts          - Build/deploy script (uses esbuild)

scripts/
  export-from-label.gs  - Export emails from Gmail

build/                  - Generated (gitignored)
  Code.gs               - Bundled Apps Script
  bundled.js            - Intermediate bundle

data/
  labeled-emails.json   - Main dataset (63 emails)
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
- **Bundling**: esbuild bundles classifier + wrapper into single file
- **Single source of truth**: `src/classifier.ts` used by both local tests and Apps Script

Configuration:
- `src/build-gas.ts` - Build script with esbuild bundler
- `src/apps-script/wrapper.ts` - Apps Script wrapper that imports classifier

## Metrics

- **Accuracy**: 100% (63/63 emails correctly classified)
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
