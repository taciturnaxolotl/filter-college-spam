// Shared types for email classification

export interface EmailInput {
  subject: string;
  from: string;
  to: string;
  cc: string;
  body: string;
  date?: string;
}

export interface ClassificationResult {
  pertains: boolean;
  reason: string;
  confidence: number; // 0-1
  matched_rules?: string[];
}

export interface LabeledEmail extends EmailInput {
  thread_id: string;
  labels: string[];
  is_in_inbox: boolean;
  pertains?: boolean;
  reason?: string;
  confidence?: "high" | "medium" | "low";
  labeled_at?: string;
  notes?: string;
}

export interface TestCase {
  input: EmailInput;
  expected: {
    pertains: boolean;
    reason: string;
  };
  metadata: {
    thread_id: string;
    date: string;
    confidence: string;
    notes?: string;
    labels: string[];
  };
}

export interface TestResult {
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  false_positives: number; // Said relevant when not
  false_negatives: number; // Said not relevant when is
  precision: number; // Of predicted relevant, how many correct
  recall: number; // Of actual relevant, how many found
  f1_score: number;
  failures: Array<{
    test_case: TestCase;
    actual: ClassificationResult;
    error?: string;
  }>;
}
