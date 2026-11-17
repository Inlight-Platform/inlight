import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

type RecordData = Record<string, unknown>;
type FakeRequest = {
  method: string;
  headers: { get: (name: string) => string | null };
  json: () => Promise<{ record: RecordData }>;
};
type Handler = (request: FakeRequest) => Promise<Response>;
type SendPayload = { from: string; to: string[]; subject: string; html: string };
type Query = { table: string; selection: string; column: string; value: unknown; terminal: string };

// B28_CAPTURED_BASELINES
const capturedBaselines: Record<string, { subject: string; html: string; builderQueries: Query[]; authLookups: string[] }> = {
  "ordinary message": {
    "subject": "New message from Name sender-1 on Inlight",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n        <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">You got a new message from Name sender-1 on Inlight!</h2>\n        <p style=\"margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;\">\"Hello there\"</p>\n        <a href=\"https://site.example.test/notifications?tab=messages&thread=sender-1\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">View</a>\n      \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [
      {
        "table": "profiles",
        "selection": "display_name, email",
        "column": "user_id",
        "value": "sender-1",
        "terminal": "maybeSingle"
      }
    ],
    "authLookups": []
  },
  "shared message": {
    "subject": "Name sender-1 shared something with you",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n        <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">Name sender-1 shared \"Synthetic item\" with you!</h2>\n        <a href=\"https://site.example.test/notifications?tab=messages&thread=sender-1\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">View</a>\n      \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [
      {
        "table": "profiles",
        "selection": "display_name, email",
        "column": "user_id",
        "value": "sender-1",
        "terminal": "maybeSingle"
      }
    ],
    "authLookups": []
  },
  "application": {
    "subject": "Name applicant-1 applied for Actor",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">Name applicant-1 applied for Actor in Synthetic Project!</h2>\n      <a href=\"https://site.example.test/projects/project-1?application=application-1\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">Review</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [
      {
        "table": "profiles",
        "selection": "display_name, email",
        "column": "user_id",
        "value": "applicant-1",
        "terminal": "maybeSingle"
      },
      {
        "table": "project_roles",
        "selection": "role_name, projects(title)",
        "column": "id",
        "value": "role-1",
        "terminal": "single"
      }
    ],
    "authLookups": []
  },
  "connection request": {
    "subject": "Name sender-1 wants to connect with you!",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">Name sender-1 wants to connect with you!</h2>\n      <a href=\"https://site.example.test/profile/sender-1\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">Respond</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [
      {
        "table": "profiles",
        "selection": "display_name, email",
        "column": "user_id",
        "value": "sender-1",
        "terminal": "maybeSingle"
      }
    ],
    "authLookups": []
  },
  "invitation": {
    "subject": "Name creator-1 invited you to join Synthetic Project!",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">You've been invited!</h2>\n      <p style=\"margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;\">Name creator-1 has invited you to join <strong>Synthetic Project</strong> as <strong>Actor</strong>.</p>\n      <a href=\"https://site.example.test/projects/project-1\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">View Invitation</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [
      {
        "table": "project_roles",
        "selection": "role_name, project_id, projects(title)",
        "column": "id",
        "value": "role-1",
        "terminal": "single"
      },
      {
        "table": "projects",
        "selection": "creator_id",
        "column": "id",
        "value": "project-1",
        "terminal": "maybeSingle"
      },
      {
        "table": "profiles",
        "selection": "display_name, email",
        "column": "user_id",
        "value": "creator-1",
        "terminal": "maybeSingle"
      }
    ],
    "authLookups": []
  },
  "application accepted": {
    "subject": "CONGRATULATIONS! You've just been hired!",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:22px;font-weight:700;\">🎉 CONGRATULATIONS!</h2>\n      <h3 style=\"margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:600;\">You've just been hired!</h3>\n      <p style=\"margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;\">Name sender-1 has offered you the role of <strong>Actor</strong> on <strong>Synthetic Project</strong>.</p>\n      <a href=\"https://site.example.test/projects/project-1\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">Respond</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [
      {
        "table": "profiles",
        "selection": "display_name, email",
        "column": "user_id",
        "value": "sender-1",
        "terminal": "maybeSingle"
      }
    ],
    "authLookups": []
  },
  "job match": {
    "subject": "New opportunity matching your skills: Synthetic Job",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">New opportunity for you!</h2>\n      <p style=\"margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;\">A new job has been posted — <strong>Synthetic Job</strong> — matching your skills: &lt;strong&gt;Actor, Singer&lt;/strong&gt;.</p>\n      <a href=\"https://site.example.test/opportunities\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">View Opportunity</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [],
    "authLookups": []
  },
  "invitation zero role name": {
    "subject": "Name creator-1 invited you to join Synthetic Project!",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">You've been invited!</h2>\n      <p style=\"margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;\">Name creator-1 has invited you to join <strong>Synthetic Project</strong> as <strong>a role</strong>.</p>\n      <a href=\"https://site.example.test/projects/project-1\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">View Invitation</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [
      {
        "table": "projects",
        "selection": "creator_id",
        "column": "id",
        "value": "project-1",
        "terminal": "maybeSingle"
      },
      {
        "table": "profiles",
        "selection": "display_name, email",
        "column": "user_id",
        "value": "creator-1",
        "terminal": "maybeSingle"
      }
    ],
    "authLookups": []
  },
  "accepted false project title": {
    "subject": "CONGRATULATIONS! You've just been hired!",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:22px;font-weight:700;\">🎉 CONGRATULATIONS!</h2>\n      <h3 style=\"margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:600;\">You've just been hired!</h3>\n      <p style=\"margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;\">Name sender-1 has offered you the role of <strong>Actor</strong> on <strong>a project</strong>.</p>\n      <a href=\"https://site.example.test/projects/project-1\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">Respond</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [
      {
        "table": "profiles",
        "selection": "display_name, email",
        "column": "user_id",
        "value": "sender-1",
        "terminal": "maybeSingle"
      }
    ],
    "authLookups": []
  },
  "job match zero roles": {
    "subject": "New opportunity matching your skills: Synthetic Job",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">New opportunity for you!</h2>\n      <p style=\"margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;\">A new job has been posted — <strong>Synthetic Job</strong> — matching your skillset.</p>\n      <a href=\"https://site.example.test/opportunities\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">View Opportunity</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [],
    "authLookups": []
  },
  "job match empty roles": {
    "subject": "New opportunity matching your skills: Synthetic Job",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">New opportunity for you!</h2>\n      <p style=\"margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;\">A new job has been posted — <strong>Synthetic Job</strong> — matching your skillset.</p>\n      <a href=\"https://site.example.test/opportunities\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">View Opportunity</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [],
    "authLookups": []
  },
  "application absent ID": {
    "subject": "Name applicant-1 applied for Actor",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">Name applicant-1 applied for Actor in Synthetic Project!</h2>\n      <a href=\"https://site.example.test/projects/project-1?application=undefined\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">Review</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [
      {
        "table": "profiles",
        "selection": "display_name, email",
        "column": "user_id",
        "value": "applicant-1",
        "terminal": "maybeSingle"
      },
      {
        "table": "project_roles",
        "selection": "role_name, projects(title)",
        "column": "id",
        "value": "role-1",
        "terminal": "single"
      }
    ],
    "authLookups": []
  },
  "application zero ID": {
    "subject": "Name applicant-1 applied for Actor",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">Name applicant-1 applied for Actor in Synthetic Project!</h2>\n      <a href=\"https://site.example.test/projects/project-1?application=0\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">Review</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [
      {
        "table": "profiles",
        "selection": "display_name, email",
        "column": "user_id",
        "value": "applicant-1",
        "terminal": "maybeSingle"
      },
      {
        "table": "project_roles",
        "selection": "role_name, projects(title)",
        "column": "id",
        "value": "role-1",
        "terminal": "single"
      }
    ],
    "authLookups": []
  },
  "unknown type": {
    "subject": "Synthetic notification",
    "html": "\n    <!DOCTYPE html>\n    <html>\n    <head>\n      <meta charset=\"utf-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    </head>\n    <body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\">\n      <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:40px 20px;\">\n        <tr>\n          <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;\">\n              <tr>\n                <td style=\"background-color:#1a1a2e;padding:24px 32px;\">\n                  <h1 style=\"margin:0;color:#ffffff;font-size:20px;font-weight:600;\">Inlight</h1>\n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:32px;\">\n                  \n      <h2 style=\"margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;\">Synthetic notification</h2>\n      <p style=\"margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;\">Synthetic body</p>\n      <a href=\"https://site.example.test\" style=\"display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;\">View on Inlight</a>\n    \n                </td>\n              </tr>\n              <tr>\n                <td style=\"padding:16px 32px;border-top:1px solid #e4e4e7;\">\n                  <p style=\"margin:0;color:#a1a1aa;font-size:12px;\">You received this because you have email notifications enabled. You can change this in your profile settings.</p>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </body>\n    </html>\n  ",
    "builderQueries": [],
    "authLookups": []
  }
};

type Case = { name: string; type: string; body?: string; data: unknown; baseline?: string; applicationIdText?: string; projectsOverride?: { value: unknown }; projectTitleFallback?: string };

const cases: Case[] = [
  { name: 'ordinary message', type: 'message', body: 'Hello there', data: { sender_id: 'sender-1' } },
  { name: 'shared message', type: 'message', body: 'Shared: Synthetic item', data: { sender_id: 'sender-1' } },
  { name: 'application', type: 'application', data: { applicant_id: 'applicant-1', project_id: 'project-1', role_id: 'role-1', application_id: 'application-1' } },
  { name: 'connection request', type: 'connection_request', data: { sender_id: 'sender-1' } },
  { name: 'invitation', type: 'invitation', data: { sender_id: 'sender-1', project_id: 'project-1', role_id: 'role-1', role_name: 'Actor', project_title: 'Synthetic Project' } },
  { name: 'application accepted', type: 'application_accepted', data: { sender_id: 'sender-1', project_id: 'project-1', role_name: 'Actor', project_title: 'Synthetic Project' } },
  { name: 'job match', type: 'job_match', data: { opportunity_id: 'job-1', opportunity_title: 'Synthetic Job', matched_roles: ['Actor', 'Singer'] } },
  { name: 'invitation zero role name', type: 'invitation', data: { sender_id: 'sender-1', project_id: 'project-1', role_name: 0, project_title: 'Synthetic Project' } },
  { name: 'accepted false project title', type: 'application_accepted', data: { sender_id: 'sender-1', project_id: 'project-1', role_name: 'Actor', project_title: false } },
  { name: 'job match zero roles', type: 'job_match', data: { opportunity_id: 'job-1', opportunity_title: 'Synthetic Job', matched_roles: 0 } },
  { name: 'job match empty roles', type: 'job_match', data: { opportunity_id: 'job-1', opportunity_title: 'Synthetic Job', matched_roles: [] } },
  { name: 'application absent ID', type: 'application', data: { applicant_id: 'applicant-1', project_id: 'project-1', role_id: 'role-1' } },
  { name: 'application zero ID', type: 'application', data: { applicant_id: 'applicant-1', project_id: 'project-1', role_id: 'role-1', application_id: 0 } },
  { name: 'unknown type', type: 'synthetic_other', data: { extra: 'synthetic' } },
];

const validData: Record<string, RecordData> = {
  message: { sender_id: 'sender-1' },
  application: { applicant_id: 'applicant-1', project_id: 'project-1', role_id: 'role-1', application_id: 'application-1' },
  connection_request: { sender_id: 'sender-1' },
  invitation: { sender_id: 'sender-1', project_id: 'project-1', role_id: 'role-1', role_name: 'Actor', project_title: 'Synthetic Project' },
  application_accepted: { sender_id: 'sender-1', project_id: 'project-1', role_name: 'Actor', project_title: 'Synthetic Project' },
  job_match: { opportunity_id: 'job-1', opportunity_title: 'Synthetic Job', matched_roles: ['Actor'] },
};
const stringFields: Record<string, string[]> = {
  message: ['sender_id'],
  application: ['applicant_id', 'project_id', 'role_id', 'application_id'],
  connection_request: ['sender_id'],
  invitation: ['sender_id', 'role_id', 'role_name', 'project_title', 'project_id'],
  application_accepted: ['sender_id', 'project_id', 'role_name', 'project_title'],
  job_match: ['opportunity_id', 'opportunity_title'],
};
const policyCases: Case[] = [
  ...Object.entries(stringFields).flatMap(([type, fields]) => fields.map((field) => ({
    name: `malformed ${type}.${field}`,
    type,
    data: { ...validData[type], [field]: type === 'application' && field === 'application_id' ? [1] : 5 },
    baseline: 'unknown type',
  }))),
  ...[[1, 2], ['Actor', 1], 'dev', {}].map((value, index) => ({
    name: `malformed matched_roles ${index}`,
    type: 'job_match',
    data: { ...validData.job_match, matched_roles: value },
    baseline: 'unknown type',
  })),
  ...[[1, 2], 'text', 5, true, null, 0, false].map((value, index) => ({
    name: `non-object data ${index}`,
    type: 'message',
    data: value,
    baseline: 'unknown type',
  })),
  { name: 'unrelated malformed field', type: 'message', body: 'Hello there', data: { sender_id: 'sender-1', role_name: 5 }, baseline: 'ordinary message' },
  { name: 'unknown type ignores fields', type: 'synthetic_other', data: { sender_id: 5, matched_roles: {} }, baseline: 'unknown type' },
  ...[false, null, ''].map((value) => ({
    name: `application ID ${String(value)}`,
    type: 'application',
    data: { ...validData.application, application_id: value },
    baseline: 'application absent ID',
    applicationIdText: String(value),
  })),
];

const relationValues: Array<{ name: string; value: unknown }> = [
  { name: 'object title', value: { title: 'Synthetic Project' } },
  { name: 'array', value: [{ title: 'Array-only title' }] },
  { name: 'null', value: null },
  { name: 'undefined', value: undefined },
  { name: 'empty title', value: { title: '' } },
  { name: 'number title', value: { title: 5 } },
  { name: 'boolean title', value: { title: false } },
  { name: 'number relation', value: 5 },
];
const relationCases: Case[] = ['application', 'invitation'].flatMap((type) =>
  relationValues.map(({ name, value }, index) => ({
    name: `${type} joined project ${name}`,
    type,
    data: type === 'invitation'
      ? { ...validData.invitation, project_title: 'Payload Project' }
      : { ...validData.application },
    baseline: type,
    projectsOverride: { value },
    projectTitleFallback: index === 0 ? undefined : type === 'application' ? 'your project' : 'Payload Project',
  }))
);

describe('notification email handler baseline', () => {
  it('has exact captured baseline case coverage', () => {
    const names = cases.map(({ name }) => name);
    expect(new Set(names).size).toBe(14);
    expect(Object.keys(capturedBaselines).sort()).toEqual([...names].sort());
  });

  it.each([...cases, ...policyCases, ...relationCases])('$name', async ({ name, type, body, data, baseline, applicationIdText, projectsOverride, projectTitleFallback }) => {
    const sends: SendPayload[] = [];
    const recipientQueries: Query[] = [];
    const builderQueries: Query[] = [];
    const authLookups: string[] = [];
    const captured: { handler?: Handler } = {};
    const fakeEnvironment: Record<string, string> = {
      NOTIFICATION_WEBHOOK_SECRET: 'fake-secret',
      NOTIFICATION_EMAILS_ENABLED: 'true',
      SUPABASE_URL: 'https://supabase.example.test',
      SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key',
      RESEND_API_KEY: 'fake-provider-key',
      SITE_URL: 'https://site.example.test',
    };

    const client = {
      from(table: string) {
        let selection = '';
        let column = '';
        let value: unknown;
        const query = {
          select(fields: string) { selection = fields; return query; },
          eq(field: string, input: unknown) { column = field; value = input; return query; },
          async maybeSingle() {
            const entry = { table, selection, column, value, terminal: 'maybeSingle' };
            if (table === 'profiles' && selection === 'email, email_notifications, display_name' && column === 'user_id' && value === 'recipient-1') {
              recipientQueries.push(entry);
              return { data: { email: 'recipient@example.test', email_notifications: true, display_name: 'Recipient' }, error: null };
            }
            builderQueries.push(entry);
            if (table === 'profiles' && selection === 'display_name, email' && column === 'user_id' && typeof value === 'string') {
              return { data: { display_name: `Name ${value}`, email: `${value}@example.test` }, error: null };
            }
            if (table === 'projects' && selection === 'creator_id' && column === 'id' && value === 'project-1') {
              return { data: { creator_id: 'creator-1' }, error: null };
            }
            throw new Error(`Unexpected maybeSingle query: ${JSON.stringify(entry)}`);
          },
          async single() {
            const entry = { table, selection, column, value, terminal: 'single' };
            builderQueries.push(entry);
            if (table === 'project_roles' && column === 'id' && value === 'role-1' &&
              (selection === 'role_name, projects(title)' || selection === 'role_name, project_id, projects(title)')) {
              return { data: { role_name: 'Actor', project_id: 'project-1', projects: projectsOverride ? projectsOverride.value : { title: 'Synthetic Project' } }, error: null };
            }
            throw new Error(`Unexpected single query: ${JSON.stringify(entry)}`);
          },
        };
        return query;
      },
      auth: { admin: { async getUserById(id: string) {
        authLookups.push(id);
        return { data: { user: { email: `${id}@example.test`, user_metadata: {} } }, error: null };
      } } },
    };

    class FakeResend {
      constructor(key: string) {
        if (key !== 'fake-provider-key') throw new Error('Unexpected provider key');
      }
      emails = { send: async (payload: SendPayload) => {
        sends.push(payload);
        return { data: { id: 'fake-email-1' }, error: null };
      } };
    }

    const fakeRequire = (specifier: string) => {
      if (specifier === 'https://esm.sh/@supabase/supabase-js@2') {
        return { createClient: (url: string, key: string) => {
          if (url !== 'https://supabase.example.test' || key !== 'fake-service-key') throw new Error('Unexpected client settings');
          return client;
        } };
      }
      if (specifier === 'npm:resend@4.0.0') return { Resend: FakeResend };
      throw new Error(`Unexpected import: ${specifier}`);
    };

    const source = readFileSync(resolve('supabase/functions/send-notification-email/index.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    runInNewContext(compiled, {
      module,
      exports: module.exports,
      require: fakeRequire,
      Response,
      console,
      fetch: () => { throw new Error('Unexpected fetch'); },
      Deno: {
        serve: (handler: Handler) => { captured.handler = handler; },
        env: { get: (key: string) => {
          if (!(key in fakeEnvironment)) throw new Error(`Unexpected environment key: ${key}`);
          return fakeEnvironment[key];
        } },
      },
    }, { filename: 'send-notification-email/index.ts' });

    expect(captured.handler).toBeTypeOf('function');
    if (!captured.handler) throw new Error('Deno.serve did not capture a handler');
    const response = await captured.handler({
      method: 'POST',
      headers: { get: (header) => header.toLowerCase() === 'x-internal-webhook-secret' ? 'fake-secret' : null },
      json: async () => ({ record: { user_id: 'recipient-1', type, title: 'Synthetic notification', body: body ?? 'Synthetic body', data } }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: 'Email sent', id: 'fake-email-1' });
    expect(recipientQueries).toHaveLength(1);
    expect(sends).toHaveLength(1);
    const sent = sends[0];
    expect(sent.to).toEqual(['recipient@example.test']);
    const expected = capturedBaselines[baseline ?? name];
    expect(expected).toBeDefined();
    let expectedHtml = expected.html;
    let expectedSubject = expected.subject;
    if (applicationIdText !== undefined) {
      const token = 'application=undefined';
      expect(expectedHtml.split(token)).toHaveLength(2);
      expectedHtml = expectedHtml.replace(token, `application=${applicationIdText}`);
    }
    if (projectTitleFallback !== undefined) {
      const token = 'Synthetic Project';
      expect(expectedHtml.split(token)).toHaveLength(2);
      expectedHtml = expectedHtml.replace(token, projectTitleFallback);
      if (type === 'invitation') {
        expect(expectedSubject.split(token)).toHaveLength(2);
        expectedSubject = expectedSubject.replace(token, projectTitleFallback);
      }
    }
    expect(sent.subject).toBe(expectedSubject);
    expect(sent.html).toBe(expectedHtml);
    expect(builderQueries).toEqual(expected.builderQueries);
    expect(authLookups).toEqual(expected.authLookups);
    console.log(JSON.stringify({ case: name, subject: sent.subject, html: sent.html, builderQueries, authLookups }));
  });
});
