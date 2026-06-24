/**
 * Contact-form handler for the website.
 *
 * Receives POSTs from the "Ready to get started?" form (script.js), logs
 * every submission to a Google Sheet in the same Google account (labeled
 * "real" or "BOT" via a hidden honeypot field), and emails the real ones.
 *
 * The form sends these fields: name, business, email, message,
 * plus company_website (the honeypot — real users leave it blank).
 *
 * See SETUP.md in this folder for deployment steps.
 */

// Where inquiry emails are sent.
var NOTIFY_EMAIL = 'johannxsteinhoff@gmail.com';

// Name of the spreadsheet that gets auto-created in your Drive on first use.
var SHEET_NAME = 'Website Contact Form Submissions';

function doPost(e) {
  try {
    var data = (e && e.parameter) || {};

    // If the hidden honeypot field is filled, it's a bot.
    var isBot = !!data.company_website;

    var name     = data.name     || '(no name)';
    var business = data.business || '(not provided)';
    var email    = data.email    || '(no email)';
    var message  = data.message  || '(no message)';
    var when     = new Date();

    // For bots, tack the honeypot value onto the message so you can see
    // exactly what they tried to inject.
    if (isBot) {
      message += '\n[honeypot company_website: ' + data.company_website + ']';
    }

    // --- Save every submission to the spreadsheet, labeled real or BOT ---
    var sheet = getSheet_();
    sheet.appendRow([when, isBot ? 'BOT' : 'real', name, business, email, message]);

    // --- Email only real inquiries (bots are logged but not emailed) ---
    if (!isBot) {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: 'New website inquiry from ' + name,
        body:
          'Name:     ' + name + '\n' +
          'Business: ' + business + '\n' +
          'Email:    ' + email + '\n\n' +
          'Message:\n' + message + '\n',
        replyTo: email   // hit "Reply" to answer the customer directly
      });
    }

    return jsonOutput_({ ok: true });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}

/**
 * Returns the logging sheet, creating the spreadsheet (with a header row) the
 * first time and remembering its ID so we reuse the same one every time.
 */
function getSheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');

  var ss;
  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (err) {
      ss = null; // stored sheet was deleted — fall through and make a new one
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    ss.getActiveSheet().appendRow(['Timestamp', 'Type', 'Name', 'Business', 'Email', 'Message']);
    props.setProperty('SHEET_ID', ss.getId());
  }

  return ss.getActiveSheet();
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Lets you open the /exec URL in a browser to confirm it deployed.
function doGet() {
  return ContentService.createTextOutput('Contact form endpoint is live.');
}
