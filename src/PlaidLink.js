import React, { useCallback, useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { getFunctions, httpsCallable } from 'firebase/functions';

const PlaidLink = ({ user, onSuccess, onError }) => {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const functions = getFunctions();

  useEffect(() => {
    const createToken = async () => {
      try {
        const createLinkToken = httpsCallable(functions, 'createLinkToken');
        const result = await createLinkToken();
        setLinkToken(result.data.link_token);
        setLoading(false);
      } catch (error) {
        console.error('Error creating link token:', error);
        onError(error);
        setLoading(false);
      }
    };

    if (user) {
      createToken();
    }
  }, [user, functions, onError]);

  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    try {
      const exchangeToken = httpsCallable(functions, 'exchangePlaidToken');
      await exchangeToken({ publicToken });
      onSuccess();
    } catch (error) {
      console.error('Error exchanging token:', error);
      onError(error);
    }
  }, [functions, onSuccess, onError]);

  const config = {
    token: linkToken,
    onSuccess: onPlaidSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  if (loading) {
    return (
      <button
        disabled
        className="bg-zinc-900 text-zinc-600 font-black px-6 py-3 rounded-lg text-sm uppercase tracking-tight cursor-not-allowed"
      >
        Loading...
      </button>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="bg-[#00ff4e] hover:opacity-90 disabled:opacity-50 text-black font-black px-6 py-3 rounded-lg text-sm uppercase tracking-tight transition-all"
    >
      Connect Brokerage Account
    </button>
  );
};

export default PlaidLink;