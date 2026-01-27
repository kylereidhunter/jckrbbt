import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-mono">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 border-b-2 border-zinc-900 pb-6">
        <button 
          onClick={() => navigate('/')}
          className="cursor-pointer hover:opacity-80 transition-opacity"
        >
          <img src="/jckrbbt_logo.png" alt="Logo" className="h-12 md:h-16 w-auto object-contain" />
        </button>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight mb-4">
          Privacy Policy
        </h1>
        <p className="text-zinc-500 text-sm mb-8">Last Updated: January 27, 2026</p>

        <div className="space-y-8 text-zinc-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Introduction</h2>
            <p>
              jckrbbt ("we," "our," or "us") operates jckrbbt.io (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Information We Collect</h2>
            
            <h3 className="text-lg font-bold text-[#00ff4e] uppercase mt-6 mb-3">Personal Information</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Account Information</strong>: Email address, username, profile picture</li>
              <li><strong>Financial Data</strong>: Stock watchlists, portfolio positions, brokerage account information (via Plaid)</li>
              <li><strong>Usage Data</strong>: IP address, browser type, pages visited, timestamps</li>
            </ul>

            <h3 className="text-lg font-bold text-[#00ff4e] uppercase mt-6 mb-3">Information from Third Parties</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Plaid</strong>: When you connect your brokerage account, we receive account balances, holdings, and transaction data through Plaid's secure API. We never see or store your brokerage login credentials.</li>
              <li><strong>Market Data Providers</strong>: Stock prices, company information, and financial news from Finnhub, Twelve Data, and other market data APIs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">How We Use Your Information</h2>
            <p className="mb-3">We use collected information to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide and maintain the Service</li>
              <li>Track your investment portfolio and watchlists</li>
              <li>Analyze stocks and provide trading insights</li>
              <li>Communicate with you about your account</li>
              <li>Improve and optimize our Service</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Data Storage and Security</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>All data is encrypted in transit using HTTPS/TLS</li>
              <li>Data at rest is encrypted using AES-256 encryption via Google Cloud Platform</li>
              <li>Access tokens from Plaid are securely stored and never exposed to the client application</li>
              <li>We implement Firebase Security Rules to ensure users can only access their own data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Data Sharing and Third Parties</h2>
            <p className="mb-3">We share data with:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Plaid</strong>: To connect your brokerage accounts and retrieve financial data</li>
              <li><strong>Firebase/Google Cloud</strong>: Our hosting and database provider</li>
              <li><strong>Market Data Providers</strong>: To fetch real-time stock prices and news</li>
            </ul>
            <p className="mt-4 mb-3">We do NOT:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Sell your personal information to third parties</li>
              <li>Share your financial data with advertisers</li>
              <li>Use your data for purposes other than providing the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Disconnect your brokerage accounts at any time</li>
              <li>Opt out of non-essential communications</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact us at privacy@jckrbbt.io
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Data Retention</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Account data is retained while your account is active</li>
              <li>Deleted accounts are purged within 30 days</li>
              <li>Brokerage connections can be disconnected immediately</li>
              <li>Anonymized usage analytics may be retained indefinitely</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Third-Party Links</h2>
            <p>
              Our Service may contain links to third-party websites (news sources, financial institutions). We are not responsible for the privacy practices of these external sites.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Children's Privacy</h2>
            <p>
              Our Service is not intended for users under 18 years of age. We do not knowingly collect information from minors.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">International Users</h2>
            <p>
              Your information may be transferred to and processed in the United States where our servers are located. By using the Service, you consent to this transfer.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. Changes will be posted on this page with an updated "Last Updated" date. Continued use of the Service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">California Privacy Rights (CCPA)</h2>
            <p className="mb-3">California residents have additional rights under the CCPA:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Right to know what personal information is collected</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of the sale of personal information (we do not sell data)</li>
              <li>Right to non-discrimination for exercising these rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Contact Us</h2>
            <p className="mb-3">For questions about this Privacy Policy or to exercise your rights:</p>
            <p><strong>Email</strong>: privacy@jckrbbt.io</p>
            <p><strong>Website</strong>: https://jckrbbt.io</p>
          </section>
        </div>

        {/* Back Button */}
        <div className="mt-12 pt-8 border-t-2 border-zinc-900">
          <button
            onClick={() => navigate('/')}
            className="bg-[#00ff4e] hover:opacity-90 text-black font-black px-6 py-3 rounded-lg text-sm uppercase tracking-tight transition-all"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}