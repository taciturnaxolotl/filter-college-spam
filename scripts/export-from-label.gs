// filename: ExportEmails.gs
// Export all College/Auto emails to JSON for model training/testing

const AUTO_LABEL_NAME = "College/Auto";
const MAX_EMAILS_TO_EXPORT = 500; // Adjust as needed

function exportEmailsToJSON() {
  const autoLabel = GmailApp.getUserLabelByName(AUTO_LABEL_NAME);
  
  if (!autoLabel) {
    Logger.log(`Label "${AUTO_LABEL_NAME}" not found`);
    return;
  }

  const threads = autoLabel.getThreads(0, MAX_EMAILS_TO_EXPORT);
  Logger.log(`Found ${threads.length} threads to export`);

  const emails = [];

  threads.forEach((thread, idx) => {
    try {
      const msg = thread.getMessages().slice(-1)[0]; // Get latest message in thread
      
      const email = {
        thread_id: thread.getId(),
        subject: msg.getSubject() || "",
        from: msg.getFrom() || "",
        to: msg.getTo() || "",
        cc: msg.getCc() || "",
        date: msg.getDate().toISOString(),
        body: msg.getPlainBody() || "",
        // Optional: include labels for context
        labels: thread.getLabels().map(l => l.getName()),
        is_in_inbox: thread.isInInbox()
      };
      
      emails.push(email);
      
      if ((idx + 1) % 50 === 0) {
        Logger.log(`Processed ${idx + 1}/${threads.length} threads`);
      }
    } catch (e) {
      Logger.log(`Error processing thread ${thread.getId()}: ${e}`);
    }
  });

  const output = {
    exported_at: new Date().toISOString(),
    total_count: emails.length,
    label: AUTO_LABEL_NAME,
    emails: emails
  };

  const json = JSON.stringify(output, null, 2);
  
  // Log first 1000 chars to verify structure
  Logger.log("JSON structure:");
  Logger.log(json.slice(0, 1000));
  Logger.log(`\nTotal JSON size: ${json.length} characters`);
  Logger.log(`\nExported ${emails.length} emails`);
  
  // Return the JSON string for manual copy/paste from logs
  // OR save to Drive (see below)
  return json;
}

// Optional: Save to Google Drive instead of logging
function exportEmailsToDrive() {
  const json = exportEmailsToJSON();
  
  const fileName = `college_emails_export_${new Date().toISOString().slice(0,10)}.json`;
  const file = DriveApp.createFile(fileName, json, MimeType.PLAIN_TEXT);
  
  Logger.log(`Saved to Google Drive: ${fileName}`);
  Logger.log(`File ID: ${file.getId()}`);
  Logger.log(`Direct link: ${file.getUrl()}`);
  
  return file.getUrl();
}

// Optional: Export in batches if you have a lot of emails
function exportEmailsInBatches() {
  const autoLabel = GmailApp.getUserLabelByName(AUTO_LABEL_NAME);
  if (!autoLabel) {
    Logger.log(`Label "${AUTO_LABEL_NAME}" not found`);
    return;
  }

  const BATCH_SIZE = 100;
  const MAX_BATCHES = 5; // Max 500 emails
  
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const threads = autoLabel.getThreads(batch * BATCH_SIZE, BATCH_SIZE);
    
    if (threads.length === 0) {
      Logger.log(`No more threads. Exported ${batch} batches.`);
      break;
    }

    const emails = threads.map(thread => {
      const msg = thread.getMessages().slice(-1)[0];
      return {
        thread_id: thread.getId(),
        subject: msg.getSubject() || "",
        from: msg.getFrom() || "",
        to: msg.getTo() || "",
        cc: msg.getCc() || "",
        date: msg.getDate().toISOString(),
        body: msg.getPlainBody() || "",
        labels: thread.getLabels().map(l => l.getName()),
        is_in_inbox: thread.isInInbox()
      };
    });

    const output = {
      batch: batch + 1,
      exported_at: new Date().toISOString(),
      count: emails.length,
      emails: emails
    };

    const json = JSON.stringify(output, null, 2);
    const fileName = `college_emails_batch_${batch + 1}.json`;
    const file = DriveApp.createFile(fileName, json, MimeType.PLAIN_TEXT);
    
    Logger.log(`Batch ${batch + 1}: Saved ${emails.length} emails to ${fileName}`);
    Logger.log(`Link: ${file.getUrl()}`);
    
    // Small delay between batches
    if (batch < MAX_BATCHES - 1) {
      Utilities.sleep(1000);
    }
  }
}