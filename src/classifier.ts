// Email classifier using rule-based approach learned from labeled data

import type { EmailInput, ClassificationResult } from "./types.ts";

export class EmailClassifier {
  classify(email: EmailInput): ClassificationResult {
    // Defensive checks for Apps Script environment
    if (!email || typeof email !== 'object') {
      return {
        pertains: false,
        reason: "Invalid email object",
        confidence: 0.0,
        matched_rules: ["invalid_input"]
      };
    }

    const subject = (email.subject || '').toLowerCase();
    const body = (email.body || '').toLowerCase();
    const from = (email.from || '').toLowerCase();
    const combined = `${subject} ${body}`;

    // CRITICAL RULES: Always relevant (security, passwords, account issues)
    const securityResult = this.checkSecurity(subject, body, combined);
    if (securityResult) return securityResult;

    // RESPONSE TO STUDENT OUTREACH: Replies to emails the student sent
    const outreachResult = this.checkStudentOutreach(subject, body, combined);
    if (outreachResult) return outreachResult;

    // RESPONSE TO STUDENT ACTION: Application confirmations, enrollment confirmations
    const actionResult = this.checkStudentAction(subject, body, combined);
    if (actionResult) return actionResult;

    // ACCEPTED STUDENT: Portal access, deposit reminders, accepted student info
    const acceptedResult = this.checkAccepted(subject, body, combined);
    if (acceptedResult) return acceptedResult;

    // DUAL ENROLLMENT: Course registration, schedules, specific to enrolled students
    const dualEnrollmentResult = this.checkDualEnrollment(subject, body, combined, from);
    if (dualEnrollmentResult) return dualEnrollmentResult;

    // SCHOLARSHIP AWARDED: Actually awarded/received (not eligible/apply/consideration)
    const scholarshipResult = this.checkScholarship(subject, body, combined);
    if (scholarshipResult) return scholarshipResult;

    // FINANCIAL AID READY: Explicit offers ready to review (not applications)
    const aidResult = this.checkFinancialAid(subject, body, combined);
    if (aidResult) return aidResult;

    // DEFINITELY NOT RELEVANT: Marketing, newsletters, unsolicited outreach
    const irrelevantResult = this.checkIrrelevant(subject, body, combined, from);
    if (irrelevantResult) return irrelevantResult;

    // DEFAULT: If uncertain, mark as not relevant (fail-safe for spam)
    return {
      pertains: false,
      reason: "No clear relevance indicators found",
      confidence: 0.3,
      matched_rules: ["default_not_relevant"]
    };
  }

  private checkStudentOutreach(subject: string, body: string, combined: string): ClassificationResult | null {
    // Check if this is a reply to an email the student sent
    const isReply = /^re:/i.test(subject.trim());
    if (!isReply) return null;

    const responsePatterns = [
      /\bthank\s+you\s+for\s+reaching\s+out\b/,
      /\bthanks\s+for\s+reaching\s+out\b/,
      /\bthank\s+you\s+for\s+(your\s+)?(email|inquiry|question|interest)\b/,
      /\bin\s+response\s+to\s+your\s+(email|inquiry|question)\b/,
    ];

    for (const pattern of responsePatterns) {
      if (pattern.test(combined)) {
        return {
          pertains: true,
          reason: "Reply to student's outreach email",
          confidence: 0.95,
          matched_rules: ["student_outreach_reply"]
        };
      }
    }

    return null;
  }

  private checkSecurity(subject: string, body: string, combined: string): ClassificationResult | null {
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
      /\bsuspicious\s+activity\b/,
    ];

    for (const pattern of patterns) {
      if (pattern.test(combined)) {
        // Make sure it's not just marketing mentioning "saving" (false positive on "$36,645 on tuition")
        // Real security alerts won't talk about tuition savings
        if (/\bsaving.*\bon\s+tuition\b|\btuition.*\bsaving\b/.test(combined)) {
          return null; // Just marketing
        }
        return {
          pertains: true,
          reason: "Security/password alert - always important",
          confidence: 1.0,
          matched_rules: ["security_alert"]
        };
      }
    }

    return null;
  }

  private checkStudentAction(subject: string, body: string, combined: string): ClassificationResult | null {
    const patterns = [
      /\bapplication\s+(received|complete|submitted|confirmation)\b/,
      /\breceived\s+your\s+application\b/,
      /\bthank\s+you\s+for\s+(applying|submitting)\b/,
      /\benrollment\s+confirmation\b/,
      /\bconfirmation\s+(of|for)\s+(your\s+)?(application|enrollment)\b/,
      /\byour\s+application\s+(has\s+been|is)\s+(received|complete)\b/,
    ];

    for (const pattern of patterns) {
      if (pattern.test(combined)) {
        // But exclude if it's just marketing about "how to apply"
        if (/\bhow\s+to\s+apply\b|\bapply\s+now\b|\bstart\s+(your\s+)?application\b/.test(combined)) {
          return null;
        }
        return {
          pertains: true,
          reason: "Confirmation of student action (application/enrollment)",
          confidence: 0.95,
          matched_rules: ["student_action_confirmation"]
        };
      }
    }

    return null;
  }

  private checkAccepted(subject: string, body: string, combined: string): ClassificationResult | null {
    const patterns = [
      /\baccepted\s+(student\s+)?portal\b/,
      /\byour\s+(personalized\s+)?accepted\s+portal\b/,
      /\bdeposit\s+(today|now|by|to\s+reserve)\b/,
      /\breserve\s+your\s+(place|spot)\b/,
      /\bcongratulations.*\baccepted\b/,
      /\byou\s+(have\s+been|are|were)\s+accepted\b/,
      /\badmission\s+(decision|offer)\b/,
      /\benroll(ment)?\s+deposit\b/,
    ];

    for (const pattern of patterns) {
      if (pattern.test(combined)) {
        // Exclude pre-admission and marketing
        if (/\bacceptance\s+rate\b|\bhigh\s+acceptance\b|\bpre[- ]admit(ted)?\b|\bautomatic\s+admission\b/.test(combined)) {
          return null;
        }
        // Exclude "direct admit/admission" marketing that asks to complete profile
        if (/\bdirect\s+(admit(ted)?|admission)\b.*\b(complete|submit).*\bprofile\b|\b(complete|submit).*\bprofile\b.*\bdirect\s+(admit(ted)?|admission)\b/.test(combined)) {
          return null;
        }
        // Exclude marketing about future admission decisions
        if (/\byou\s+will\s+(also\s+)?receive\s+(an?\s+)?(accelerated\s+)?admission\s+decision\b/.test(combined)) {
          return null;
        }
        if (/\breceive\s+an\s+admission\s+decision\s+within\b/.test(combined)) {
          return null;
        }
        // Exclude "Priority Student" spam that asks to submit application
        if (/\bpriority\s+student\b.*\bsubmit.*application\b|\bsubmit.*\bpriority\s+student\s+application\b/.test(combined)) {
          return null;
        }
        // Exclude if asking to submit ANY application (not accepted yet)
        if (/\bsubmit\s+(your\s+)?(the\s+)?application\b/.test(combined)) {
          return null;
        }
        // Exclude "once you are accepted" - means they're not accepted yet
        if (/\bonce\s+you\s+(are|have\s+been)\s+accepted\b/.test(combined)) {
          return null;
        }
        // Exclude "reserve your spot" for events/webinars (not enrollment)
        if (/\breserve\s+your\s+spot\b/.test(combined) && /\b(virtual|webinar|event|program|zoom|session)\b/.test(combined)) {
          return null;
        }
        // Exclude "top candidate" spam asking to apply/start application
        if (/\btop\s+candidate\b.*\b(apply|start.*application|submit.*application)\b/.test(combined)) {
          return null;
        }
        if (/\binvite\s+you\s+to\s+apply\b/.test(combined)) {
          return null;
        }
        // Exclude application deadline marketing (Early Decision/Action, priority deadlines, etc.)
        if (/\b(early\s+(decision|action)|priority)\b.*\b(deadline|apply|application)\b.*\b(approaching|by|extended)\b/.test(combined)) {
          return null;
        }
        if (/\bapply\s+(by|now|right\s+away|today)\b|\bdeadline.*\b(december|january|february|march)\b/.test(combined)) {
          return null;
        }
        // Exclude "Panther Priority Application" and similar marketing
        if (/\bpanther\s+priority\s+application\b|\bpriority\s+application\b/.test(combined)) {
          return null;
        }
        // Exclude "deadline details" marketing spam
        if (/\bdeadline\s+details\b|\byour\s+deadline\b/.test(combined)) {
          return null;
        }
        // Exclude "application deadline will be" (future deadline announcements)
        if (/\bapplication\s+deadline\s+will\s+be\b/.test(combined)) {
          return null;
        }
        // Exclude "flip these pages" and similar exploratory marketing
        if (/\bflip\s+these\s+pages\b|\blearn\s+more\s+about\s+being\b/.test(combined)) {
          return null;
        }
        // Exclude "want to make sure you're ready" deadline pressure
        if (/\b(want|wanted)\s+to\s+make\s+sure\s+you'?re\s+ready\b/.test(combined)) {
          return null;
        }
        // Exclude "we're interested in you" with apply language
        if (/\bwe'?re\s+interested\s+in\s+you\b/.test(combined) && /\bapply\b/.test(combined)) {
          return null;
        }
        // Exclude "you have until midnight/tonight to apply" deadline pressure
        if (/\byou\s+have\s+until\b.*\b(midnight|tonight|today)\b.*\bto\s+apply\b/.test(combined)) {
          return null;
        }
        // Exclude "I'm giving you until midnight/tonight" deadline extensions
        if (/\bgiving\s+you\s+until\b.*\b(midnight|tonight|today)\b.*\bto\s+apply\b/.test(combined)) {
          return null;
        }
        // Exclude "apply by the [month] deadline" marketing
        if (/\bapply\s+by\s+the\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b.*\bdeadline\b/.test(combined)) {
          return null;
        }
        // Exclude fee waiver deadline pressure
        if (/\bfee\s+waiver\b.*\b(ends|today|tonight|last\s+day)\b|\b(today|tonight).*\blast\s+day\s+for.*\bfee\s+waiver\b/.test(combined)) {
          return null;
        }
        // Exclude "complete your application" with perks/benefits (priority status, no essay, etc.)
        if (/\bcomplete\s+your\s+application\b.*\b(priority|perks|benefits|no\s+application\s+fee|no\s+essay)\b/.test(combined)) {
          return null;
        }
        // Exclude "apply for free" or "waiving your fee" marketing
        if (/\bapply\s+for\s+free\b|\bwaiving\s+your.*\bfee\b|\bwe'?re\s+waiving\s+your\b/.test(combined)) {
          return null;
        }
        // Exclude "apply and enroll" combined deadline marketing
        if (/\bapply\s+and\s+enroll\b.*\bfree\b/.test(combined)) {
          return null;
        }
        // Exclude "haven't received your application" or "we haven't received" (outreach)
        if (/\bhaven'?t\s+received\s+your\s+application\b|\bwe\s+haven'?t\s+received\b/.test(combined)) {
          return null;
        }
        return {
          pertains: true,
          reason: "Accepted student portal/deposit information",
          confidence: 0.95,
          matched_rules: ["accepted_student"]
        };
      }
    }

    return null;
  }

  private checkDualEnrollment(subject: string, body: string, combined: string, from: string): ClassificationResult | null {
    // Check for dual enrollment patterns
    const dualEnrollmentIndicators = [
      /\bdual\s+enrollment\b/,
      /\bcourse\s+(registration|deletion|added|dropped)\b/,
      /\bspring\s+\d{4}\s+(course|on[- ]campus)\b/,
      /\bhow\s+to\s+register\b.*\b(course|class)/,
      /\bcedarville\s+university\).*\b(course|registration)\b/,
    ];

    for (const pattern of dualEnrollmentIndicators) {
      if (pattern.test(combined)) {
        // Dual enrollment is relevant if it's about actual courses, not marketing
        if (/\blearn\s+more\s+about\b|\binterested\s+in\b|\bconsider\s+joining\b/.test(combined)) {
          return null; // Just marketing
        }
        // Exclude general "explore your academic interests" marketing
        if (/\bfreedom\s+to\s+explore\b.*\bacademic\s+interests\b|\bmajors,?\s+minors\s+and\s+more\b/.test(combined)) {
          return null;
        }
        return {
          pertains: true,
          reason: "Dual enrollment course information",
          confidence: 0.9,
          matched_rules: ["dual_enrollment"]
        };
      }
    }

    return null;
  }

  private checkScholarship(subject: string, body: string, combined: string): ClassificationResult | null {
    // Check for specific scholarship application opportunities FIRST (for accepted/enrolled students)
    // This is different from general "apply for scholarships" marketing
    if (/\bapply\s+for\s+(the\s+)?.*\bscholarship\b/.test(subject)) {
      // Check if it's specific (President's, Ministry, named scholarships)
      if (/\bpresident'?s\b|\bministry\b|\bimpact\b/.test(combined)) {
        return {
          pertains: true,
          reason: "Scholarship application opportunity for accepted student",
          confidence: 0.75,
          matched_rules: ["scholarship_application_opportunity"]
        };
      }
    }

    // Negative indicators: not actually awarded - check these before awarded patterns
    const notAwardedPatterns = [
      /\bscholarship\b.*\b(held|reserved)\s+for\s+you\b/,
      /\b(held|reserved)\s+for\s+you\b/,
      /\bconsider(ed|ation)\b.*\bscholarship\b/,
      /\bscholarship\b.*\bconsider(ed|ation)\b/,
      /\beligible\s+for\b.*\bscholarship\b/,
      /\bscholarship\b.*\beligible\b/,
      /\bmay\s+qualify\b.*\bscholarship\b/,
      /\bguaranteed\s+admission\b/,
      /\bpriority\s+consideration\b/,
      // Scholarship events/days (attend to get scholarship = not awarded)
      /\b(attend|register\s+for).*\bscholarship\s+(day|event|award\s+event)\b/,
      /\bscholarship\s+(day|event).*\b(attend|register)\b/,
      /\bsoar\s+(scholarship\s+award\s+)?event\b/,
      // Direct admission/scholarship forms to submit (not awarded yet)
      /\bdirect\s+admission\b.*\bscholarship\s+form\b/,
      /\bscholarship\s+form\b.*\bdirect\s+admission\b/,
      /\bsubmit\s+(your\s+)?.*\bscholarship\s+form\b/,
      // "Want to make sure you're ready" deadline pressure with scholarship mention
      /\b(want|wanted)\s+to\s+make\s+sure\s+you'?re\s+ready\b.*\bscholarship\b/,
      // Scholarship estimate (not actual award)
      /\bscholarship\s+estimate\b/,
      /\byou\s+have\s+not\s+(yet\s+)?seen\s+your.*\bscholarship\b/,
      /\bacademic\s+scholarship\s+estimate\b/,
      // "You've earned a scholarship" but says "pre-admission" (not actually awarded)
      /\bpre[- ]admission\b/,
      // Scholarship deadline approaching (apply for it, not awarded)
      /\bscholarship\s+deadline\s+(approaching|soon)\b/,
      // "upon admission" means not awarded yet
      /\bscholarship\b.*\bupon\s+admission\b|\bupon\s+admission\b.*\bscholarship\b/,
    ];

    // Check if scholarship is mentioned but not awarded
    const hasScholarshipMention = /\bscholarship\b/.test(combined);
    if (hasScholarshipMention) {
      for (const pattern of notAwardedPatterns) {
        if (pattern.test(combined)) {
          return {
            pertains: false,
            reason: "Scholarship mentioned but not actually awarded (held/eligible/apply)",
            confidence: 0.9,
            matched_rules: ["scholarship_not_awarded"]
          };
        }
      }
    }

    // Positive indicators: actually awarded
    const awardedPatterns = [
      /\bcongratulations\b.*\bscholarship\b/,
      /\byou\s+(have|received|are\s+awarded|won)\b.*\bscholarship\b/,
      /\bwe\s+(are\s+)?(pleased\s+to\s+)?award(ing)?\b.*\bscholarship\b/,
      /\bscholarship\s+(offer|award)\b/,
      /\breceived\s+a\s+scholarship\b/,
    ];

    for (const pattern of awardedPatterns) {
      if (pattern.test(combined)) {
        return {
          pertains: true,
          reason: "Scholarship actually awarded",
          confidence: 0.95,
          matched_rules: ["scholarship_awarded"]
        };
      }
    }

    return null;
  }

  private checkFinancialAid(subject: string, body: string, combined: string): ClassificationResult | null {
    // Positive: aid is ready
    const readyPatterns = [
      /\bfinancial\s+aid\b.*\boffer\b.*\b(ready|available)\b/,
      /\b(ready|available)\b.*\bfinancial\s+aid\b.*\boffer\b/,
      /\baward\s+letter\b.*\b(ready|available|posted|view)\b/,
      /\b(view|review)\s+(your\s+)?award\s+letter\b/,
      /\bfinancial\s+aid\s+package\b.*\b(ready|available|posted)\b/,
      /\byour\s+aid\s+is\s+ready\b/,
    ];

    // Negative: aid applications, FAFSA reminders
    const notReadyPatterns = [
      /\blearn\s+more\s+about\b.*\bfinancial\s+aid\b/,
      /\bapply\b.*\b(for\s+)?financial\s+aid\b/,
      /\bfinancial\s+aid\b.*\bapplication\b/,
      /\bcomplete\s+(your\s+)?fafsa\b/,
      /\bconsidered\s+for\b.*\baid\b/,
      /\bpriority\s+(deadline|consideration)\b.*\bfinancial\s+aid\b/,
    ];

    for (const pattern of readyPatterns) {
      if (pattern.test(combined)) {
        // Check for negative indicators
        for (const negPattern of notReadyPatterns) {
          if (negPattern.test(combined)) {
            return null; // Just application info
          }
        }
        return {
          pertains: true,
          reason: "Financial aid offer ready to review",
          confidence: 0.95,
          matched_rules: ["financial_aid_ready"]
        };
      }
    }

    return null;
  }

  private checkIrrelevant(subject: string, body: string, combined: string, from: string): ClassificationResult | null {
    // Strong indicators of marketing/spam
    const irrelevantPatterns = [
      // Newsletter/blog content
      /\bstudent\s+life\s+blog\b/,
      /\b(student\s+life\s+)?blog\s+(post|update)\b/,
      /\bnew\s+student\s+life\s+blog\b/,
      /\bnewsletter\b/,
      /\bweekly\s+(digest|update)\b/,
      
      // Marketing events
      /\bupcoming\s+events\b/,
      /\bjoin\s+us\s+(for|at|on\s+zoom)\b/,
      /\bopen\s+house\b/,
      /\bvirtual\s+tour\b/,
      /\bcampus\s+(visit|tour|event)\b/,
      /\bmeet\s+(the|our)\s+(students|faculty)\b/,
      
      // Generic outreach (not applied yet)
      /\bhaven'?t\s+applied.*yet\b/,
      /\bstill\s+time\s+to\s+apply\b/,
      /\bhow\s+is\s+your\s+college\s+search\b/,
      /\bstart\s+(your\s+)?college\s+search\b/,
      /\bexplore\s+(our\s+)?(programs|campus)\b/,
      
      // Unsolicited outreach patterns
      /\bi\s+hope\s+you\s+have\s+been\s+receiving\s+my\s+emails\b/,
      /\bam\s+i\s+reaching\b/,
      /\byou\s+are\s+on\s+.*\s+(radar|list)\b/,
      /\byou'?re\s+on\s+(our|my)\s+radar\b/,
      /\bi\s+want\s+to\s+make\s+sure\s+you\s+know\b/,
      /\byou'?re\s+invited\s+to\s+submit\b/,
      /\bi'?m\s+eager\s+to\s+consider\s+you\b/,
      /\bsubmit\s+your\s+.*\s+application\b/,
      /\bpriority\s+status\b.*\bsubmit.*application\b/,
      /\btop\s+candidate\b.*\binvite\s+you\s+to\s+apply\b/,
      /\binvite\s+you\s+to\s+apply\b/,
      
      // Priority deadline extensions (spam)
      /\bextended.*\bpriority\s+deadline\b/,
      /\bpriority\s+deadline.*\bextended\b/,
      
      // Summer camps/programs
      /\bsummer\s+(academy|camp|program)\b/,
      /\bsave\s+the\s+date\b/,
      
      // Ugly sweaters and other fluff
      /\bugly\s+sweater\b/,
      /\bit'?s\s+.+\s+season\b/,
      
      // FAFSA/scholarship info sessions (not actual aid offers)
      /\bjoin\s+us.*\b(virtual\s+program|zoom)\b.*\b(scholarship|financial\s+aid)\b/,
      /\blearn\s+more\b.*\b(scholarship|financial\s+aid)\s+(opportunities|options)\b/,
      /\b(scholarship|financial\s+aid)\s+(opportunities|options)\b.*\blearn\s+more\b/,
    ];

    for (const pattern of irrelevantPatterns) {
      if (pattern.test(combined)) {
        return {
          pertains: false,
          reason: "Marketing/newsletter/unsolicited outreach",
          confidence: 0.95,
          matched_rules: ["irrelevant_marketing"]
        };
      }
    }

    // Haven't applied yet = not relevant
    if (/\bhaven'?t\s+applied\b/.test(combined)) {
      return {
        pertains: false,
        reason: "Unsolicited email where student has not applied",
        confidence: 0.95,
        matched_rules: ["not_applied"]
      };
    }

    return null;
  }
}

// Convenience function
export function classifyEmail(email: EmailInput): ClassificationResult {
  const classifier = new EmailClassifier();
  return classifier.classify(email);
}
