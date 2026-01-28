# Data Retention and Disposal Policy

**Company:** Jackrabbit  
**Website:** https://jckrbbt.io  
**Effective Date:** January 27, 2026  
**Last Updated:** January 27, 2026

---

## 1. Purpose

This policy defines how Jackrabbit retains and disposes of user data to protect user privacy, comply with applicable regulations, and maintain data security throughout the data lifecycle.

---

## 2. Scope

This policy applies to all personal data collected, processed, and stored by Jackrabbit, including:
- User account information
- Financial data accessed via Plaid
- Usage data and analytics
- Communication records

---

## 3. Data Retention Periods

### 3.1 Active User Data

**Account Information**
- Email address, username, profile picture
- **Retention Period:** While account is active
- **Purpose:** Service delivery and authentication

**Financial Data (via Plaid)**
- Brokerage account balances, holdings, transactions
- Plaid access tokens
- **Retention Period:** While brokerage connection is active
- **Purpose:** Portfolio tracking and analysis

**Watchlists and User Preferences**
- Stock watchlists, settings, customizations
- **Retention Period:** While account is active
- **Purpose:** Service personalization

**Usage Logs and Analytics**
- Session data, feature usage, performance metrics
- **Retention Period:** 90 days
- **Purpose:** Service improvement and debugging

### 3.2 Inactive Accounts

- Accounts with no login activity for 24+ months are considered inactive
- Users receive email notification 30 days before data deletion
- If no response within 30 days, account and associated data are permanently deleted
- Users may reactivate accounts before deletion deadline

### 3.3 Deleted Accounts

**User-Requested Deletion:**
- Complete deletion processed within 30 days of request
- User receives confirmation email upon completion
- Plaid access tokens revoked immediately
- All personal data permanently removed from production systems

**Data Removed:**
- Account credentials and authentication data
- Personal information (email, username, profile)
- Financial data and Plaid connections
- Watchlists and preferences
- Usage logs older than 7 days

**Data Retained (if applicable):**
- Anonymized analytics (no personally identifiable information)
- Legal compliance records (if required by law)

---

## 4. Data Disposal Methods

### 4.1 Secure Deletion

**Primary Storage (Google Cloud Firestore):**
- All user data permanently deleted using Google Cloud Platform's secure deletion protocols
- Data rendered unrecoverable through cryptographic erasure
- Compliant with industry standards (NIST 800-88)

**Plaid Access Tokens:**
- Immediately revoked via Plaid API upon disconnection or account deletion
- Removed from all Jackrabbit systems within 24 hours
- Plaid notified to delete associated financial data

**Backups:**
- Deleted user data purged from backup systems within 30 days
- Automated backup retention: 30 days rolling window
- Backups encrypted at rest (AES-256)

### 4.2 Third-Party Data

**Plaid Financial Data:**
- Access tokens revoked immediately upon user request
- Request sent to Plaid to delete all associated data per their retention policy
- No financial credentials stored by Jackrabbit

**Market Data Providers:**
- No personal user data shared with market data APIs
- Only stock symbols and public market data accessed
- No deletion required

---

## 5. Legal and Regulatory Exceptions

### 5.1 Legal Hold

Data may be retained beyond standard periods if:
- Required by law or regulation
- Subject to valid legal process (subpoena, court order)
- Necessary for ongoing litigation or investigation
- Required for audit or tax purposes

### 5.2 Financial Records

- Transaction logs related to billing retained for 7 years (IRS requirement)
- Anonymized usage statistics may be retained indefinitely
- No personally identifiable information retained beyond standard periods

---

## 6. User Rights

Users have the right to:

**Access:**
- Request copy of all personal data stored (provided within 30 days)
- View current data retention status

**Correction:**
- Update inaccurate or incomplete data via account settings

**Deletion:**
- Request complete account deletion (processed within 30 days)
- Disconnect brokerage accounts immediately at any time

**Portability:**
- Export data in machine-readable format (JSON)

**Contact:** privacy@jckrbbt.io

---

## 7. Data Breach Response

In the event of a data breach:
- Affected users notified within 72 hours
- Compromised data identified and secured
- Law enforcement and regulators notified as required
- Forensic investigation conducted
- Remediation measures implemented

Breached data disposal:
- Compromised systems isolated and sanitized
- Affected data securely deleted per NIST guidelines
- Users provided with guidance and support

---

## 8. Employee Access and Training

**Access Controls:**
- Data access limited to authorized personnel only
- Role-based access control (RBAC) enforced
- All access logged and monitored

**Training:**
- Annual data privacy and security training required
- Data disposal procedures included in onboarding
- Regular policy reviews and updates

---

## 9. Third-Party Vendors

**Vendor Requirements:**
- Must comply with this retention policy
- Data Processing Agreements (DPA) required
- Regular vendor security audits

**Current Vendors:**
- Google Cloud Platform (hosting, database)
- Plaid (financial data access)
- Firebase (authentication, storage)

---

## 10. Policy Review and Updates

**Review Cycle:**
- Policy reviewed annually (minimum)
- Updated as needed for regulatory changes
- Users notified of material changes via email

**Version Control:**
- Current version: 1.0
- Last review: January 27, 2026
- Next scheduled review: January 27, 2027

---

## 11. Contact Information

**Data Privacy Inquiries:**
- Email: privacy@jckrbbt.io
- Response time: Within 5 business days

**Data Deletion Requests:**
- Email: privacy@jckrbbt.io
- Processing time: Within 30 days

**Security Concerns:**
- Email: security@jckrbbt.io
- Urgent issues: Immediate response within 24 hours

---

## 12. Acknowledgment

By using Jackrabbit's services, users acknowledge:
- Understanding of this Data Retention and Disposal Policy
- Acceptance of retention periods and disposal methods
- Right to request deletion at any time

This policy is incorporated into our Privacy Policy and Terms of Service.

---

**Document Control:**
- Document Owner: Jackrabbit, Inc.
- Classification: Public
- Distribution: Available at https://jckrbbt.io/privacy