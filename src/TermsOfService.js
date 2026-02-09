import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
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
          Terms of Service
        </h1>
        <p className="text-zinc-500 text-sm mb-8">Last Updated: February 9, 2026</p>

        <div className="space-y-8 text-zinc-300 leading-relaxed">
          <section>
            <p>
              Welcome to jckrbbt ("we," "our," or "the Service"). By accessing or using jckrbbt.io, you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Description of Service</h2>
            <p>
              jckrbbt is a stock market research and discovery platform that provides AI-powered stock scanning, analysis, news aggregation, and portfolio tracking tools. The Service is provided for informational and educational purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Not Financial Advice</h2>
            <p className="mb-3">
              Nothing on jckrbbt constitutes financial advice, investment advice, trading advice, or any other sort of professional advice. The AI-generated reports, stock analysis, price data, analyst ratings, and all other information provided through the Service are for informational purposes only.
            </p>
            <p>
              You should not make any investment decision based solely on information from this Service. Always consult with a qualified financial advisor before making investment decisions. Past performance does not guarantee future results. Trading stocks involves substantial risk of loss.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Accuracy of Information</h2>
            <p className="mb-3">While we strive to provide accurate and timely information, we make no guarantees regarding the accuracy, completeness, or timeliness of any data displayed on the Service, including but not limited to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Stock prices and market data (which may be delayed)</li>
              <li>AI-generated analysis, summaries, and research reports</li>
              <li>News articles and headlines sourced from third-party providers</li>
              <li>Analyst ratings and price targets</li>
              <li>Financial metrics and company data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Account Registration</h2>
            <p>
              To access certain features, you may be required to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You agree to provide accurate information and to notify us immediately of any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Brokerage Connections</h2>
            <p>
              The Service may allow you to connect third-party brokerage accounts through Plaid Inc. for portfolio tracking purposes. By connecting a brokerage account, you authorize Plaid to access your account information on your behalf. We do not store your brokerage login credentials. We are not responsible for the actions of third-party services including Plaid or any connected brokerage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">AI-Generated Content</h2>
            <p>
              The Service uses artificial intelligence to generate stock analysis, research reports, summaries, and other content. AI-generated content may contain errors, inaccuracies, or hallucinated information. You acknowledge that AI outputs should not be relied upon as the sole basis for any decision, financial or otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">User Conduct</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Use the Service for any unlawful purpose or in violation of any applicable law or regulation</li>
              <li>Attempt to access, scrape, or collect data from the Service through automated means</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Impersonate another person or misrepresent your identity</li>
              <li>Use the Service to manipulate markets or engage in any form of market manipulation</li>
              <li>Share your account credentials with others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Watchlists and Social Features</h2>
            <p>
              When you create public watchlists or engage with social features such as the activity feed, the information you share (including your username, watchlist names, and stock selections) may be visible to other users. You are responsible for the content you choose to make public.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Intellectual Property</h2>
            <p>
              All content, design, code, logos, and trademarks associated with jckrbbt are our property or used under license. You may not copy, modify, distribute, or create derivative works from any part of the Service without our written consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Third-Party Services and Data</h2>
            <p>
              The Service integrates with third-party APIs and data providers including but not limited to Polygon.io, Google Gemini, Plaid, and Firebase. We are not responsible for the availability, accuracy, or reliability of these third-party services. Their use may be subject to their own terms and conditions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, jckrbbt and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to financial losses resulting from investment decisions made using information from the Service. The Service is provided "as is" and "as available" without warranties of any kind.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Disclaimer of Warranties</h2>
            <p>
              We disclaim all warranties, express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless jckrbbt and its creators from any claims, damages, losses, or expenses arising from your use of the Service or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time, for any reason, without prior notice. Upon termination, your right to access the Service will immediately cease.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Changes to Terms</h2>
            <p>
              We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms. We encourage you to review this page periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without regard to conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Contact Us</h2>
            <p className="mb-3">For questions about these Terms of Service:</p>
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
