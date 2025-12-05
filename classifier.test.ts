import { describe, test, expect } from "bun:test";
import { EmailClassifier } from "./classifier";
import type { EmailInput } from "./types";

const classifier = new EmailClassifier();

function createEmail(subject: string, body: string = "", from: string = "test@college.edu"): EmailInput {
  return {
    subject,
    body,
    from,
    to: "student@example.com",
    cc: ""
  };
}

describe("EmailClassifier - Security", () => {
  test("should flag password reset as relevant", () => {
    const email = createEmail("Password Reset Required", "Your password needs to be reset immediately");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
    expect(result.matched_rules).toContain("security_alert");
  });

  test("should flag account locked as relevant", () => {
    const email = createEmail("Account Locked", "Your account has been locked due to suspicious activity");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
  });

  test("should flag verification code as relevant", () => {
    const email = createEmail("Your verification code", "Here is your verification code: 123456");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
  });
});

describe("EmailClassifier - Student Actions", () => {
  test("should flag application received as relevant", () => {
    const email = createEmail("Application Received", "Thank you for submitting your application");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
    expect(result.matched_rules).toContain("student_action_confirmation");
  });

  test("should flag enrollment confirmation as relevant", () => {
    const email = createEmail("Enrollment Confirmation", "Your enrollment has been confirmed");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
  });

  test("should NOT flag 'how to apply' as relevant", () => {
    const email = createEmail("How to Apply", "Learn how to apply to our university");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
  });
});

describe("EmailClassifier - Accepted Students", () => {
  test("should flag accepted portal as relevant", () => {
    const email = createEmail("Your Accepted Portal Is Ready", "Access your personalized accepted student portal");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
    expect(result.matched_rules).toContain("accepted_student");
  });

  test("should flag deposit reminder as relevant", () => {
    const email = createEmail("Deposit Today To Reserve Your Place", "Submit your enrollment deposit");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
  });
});

describe("EmailClassifier - Dual Enrollment", () => {
  test("should flag course registration as relevant", () => {
    const email = createEmail("Spring 2026 Course Registration", "How to register for your dual enrollment courses");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
    expect(result.matched_rules).toContain("dual_enrollment");
  });

  test("should flag course deletion as relevant", () => {
    const email = createEmail("Course Deletion Notice", "Your Spring 2026 course has been deleted", "cedarville.edu");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
  });

  test("should NOT flag dual enrollment marketing as relevant", () => {
    const email = createEmail("Interested in Dual Enrollment?", "Learn more about our dual enrollment program");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
  });
});

describe("EmailClassifier - Scholarships", () => {
  test("should flag awarded scholarship as relevant", () => {
    const email = createEmail("Congratulations! Scholarship Awarded", "You have received a $5000 scholarship");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
    expect(result.matched_rules).toContain("scholarship_awarded");
  });

  test("should NOT flag scholarship held/reserved as relevant", () => {
    const email = createEmail("Scholarship Reserved For You", "A scholarship is being held for you. Apply now!");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
    expect(result.matched_rules).toContain("scholarship_not_awarded");
  });

  test("should NOT flag scholarship consideration as relevant", () => {
    const email = createEmail("Scholarship Consideration", "You are eligible for scholarship consideration");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
  });

  test("should flag specific scholarship application as relevant", () => {
    const email = createEmail("Apply for the President's Ministry Impact Scholarship", "");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
  });
});

describe("EmailClassifier - Financial Aid", () => {
  test("should flag aid offer ready as relevant", () => {
    const email = createEmail("Financial Aid Offer Ready", "Your award letter is available to view");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(true);
    expect(result.matched_rules).toContain("financial_aid_ready");
  });

  test("should NOT flag FAFSA reminder as relevant", () => {
    const email = createEmail("Complete Your FAFSA", "Don't forget to complete your FAFSA application");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
  });

  test("should NOT flag aid application info as relevant", () => {
    const email = createEmail("Learn More About Financial Aid", "Apply for financial aid today");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
  });
});

describe("EmailClassifier - Irrelevant Marketing", () => {
  test("should flag blog posts as not relevant", () => {
    const email = createEmail("Student Life Blog: K9s at the Ville", "Discover one of Cedarville's student ministries!");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
    expect(result.matched_rules).toContain("irrelevant_marketing");
  });

  test("should flag newsletters as not relevant", () => {
    const email = createEmail("Weekly Newsletter", "Check out what's happening on campus");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
  });

  test("should flag unsolicited outreach as not relevant", () => {
    const email = createEmail("How Is Your College Search Going?", "Even though you haven't applied to our university yet...");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
  });

  test("should flag priority deadline extensions as not relevant", () => {
    const email = createEmail("We've extended our priority deadline!", "The priority deadline has been extended to January 15");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
  });

  test("should flag summer camps as not relevant", () => {
    const email = createEmail("Summer Academy: Save the Date", "Join us for Wildcat Summer Academy!");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
  });

  test("should flag ugly sweater emails as not relevant", () => {
    const email = createEmail("⛷️ It's ugly sweater season!", "");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
  });
});

describe("EmailClassifier - Edge Cases", () => {
  test("should default to not relevant for unclear emails", () => {
    const email = createEmail("Hello", "Just saying hi");
    const result = classifier.classify(email);
    expect(result.pertains).toBe(false);
    expect(result.confidence).toBeLessThan(0.5);
  });

  test("should handle empty body", () => {
    const email = createEmail("Test Subject", "");
    const result = classifier.classify(email);
    expect(result).toBeDefined();
  });

  test("should handle empty subject", () => {
    const email = createEmail("", "Test body content");
    const result = classifier.classify(email);
    expect(result).toBeDefined();
  });
});
