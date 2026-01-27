import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PlaidConsent = ({ onAccept, onDecline }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleAccept = () => {
    setIsOpen(false);
    onAccept();
  };

  const handleDecline = () => {
    setIsOpen(false);
    onDecline();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={handleDecline}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-lg bg-[#0a0a0a] border-2 border-zinc-800 rounded-xl p-6 z-50 max-h-[80vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
              Connect Your Brokerage
            </h2>

            <div className="space-y-4 text-sm text-zinc-300 mb-6">
              <p>
                By connecting your brokerage account through Plaid, you authorize Jackrabbit to:
              </p>

              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Access your account balances and holdings</li>
                <li>View your transaction history</li>
                <li>Retrieve basic account information</li>
                <li>Display your portfolio performance</li>
              </ul>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mt-4">
                <p className="text-xs text-zinc-400">
                  <strong className="text-[#00ff4e]">Important:</strong> We never see or store your brokerage login credentials. 
                  All connections are securely managed by Plaid. You can disconnect your account at any time from your settings.
                </p>
              </div>

              <p className="text-xs text-zinc-500 mt-4">
                By continuing, you agree to share this information with Jackrabbit as described in our{' '}
                <a href="/privacy" target="_blank" className="text-[#00ff4e] hover:underline">
                  Privacy Policy
                </a>.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDecline}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-black py-3 rounded-lg text-sm uppercase tracking-tight transition-all border border-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 bg-[#00ff4e] hover:opacity-90 text-black font-black py-3 rounded-lg text-sm uppercase tracking-tight transition-all"
              >
                Connect Account
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PlaidConsent;