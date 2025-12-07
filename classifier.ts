// Email classifier using rule-based approach learned from labeled data

import type { EmailInput, ClassificationResult } from "./types";

export class EmailClassifier {
  classify(email: EmailInput): ClassificationResult {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    const from = email.from.toLowerCase();
    const combined = `${subject} ${body}`;

    // CRITICAL RULES: Always relevant (security, passwords, account issues)
    const securityResult = this.checkSecurity(subject, body, combined);
    if (securityResult) return securityResult;

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
        // Exclude marketing about future admission decisions
        if (/\byou\s+will\s+(also\s+)?receive\s+(an?\s+)?(accelerated\s+)?admission\s+decision\b/.test(combined)) {
          return null;
        }
        if (/\breceive\s+an\s+admission\s+decision\s+within\b/.test(combined)) {
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
      /\bjoin\s+us\s+(for|at)\b/,
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
      /\bi\s+want\s+to\s+make\s+sure\s+you\s+know\b/,
      /\byou'?re\s+invited\s+to\s+submit\b/,
      /\bi'?m\s+eager\s+to\s+consider\s+you\b/,
      /\bsubmit\s+your\s+.*\s+application\b/,
      /\bpriority\s+status\b.*\bsubmit.*application\b/,
      
      // Priority deadline extensions (spam)
      /\bextended.*\bpriority\s+deadline\b/,
      /\bpriority\s+deadline.*\bextended\b/,
      
      // Summer camps/programs
      /\bsummer\s+(academy|camp|program)\b/,
      /\bsave\s+the\s+date\b/,
      
      // Ugly sweaters and other fluff
      /\bugly\s+sweater\b/,
      /\bit'?s\s+.+\s+season\b/,
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
