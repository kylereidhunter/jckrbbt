import React, { useCallback, useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { auth } from './firebase';

const PlaidLinkButton = ({ linkToken, onSuccess, onError }) => {
  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    console.log('Plaid success! Public token:', publicToken);
    try {
      const idToken = await auth.currentUser.getIdToken();
      
      await fetch('/api/exchangePlaidToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ publicToken })
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error exchanging token:', error);
      onError(error);
    }
  }, [onSuccess, onError]);

  const config = {
    token: linkToken,
    onSuccess: onPlaidSuccess,
  };

  const { open, ready } = usePlaidLink(config);

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

const PlaidLink = ({ user, onSuccess, onError }) => {
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    const createToken = async () => {
      try {
        const idToken = await auth.currentUser.getIdToken();
        
        const response = await fetch('/api/createLinkToken', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        const data = await response.json();
        
        if (!data.link_token) {
          throw new Error('No link token in response');
        }
        
        setLinkToken(data.link_token);
      } catch (error) {
        console.error('Error creating link token:', error);
        onError(error);
      }
    };

    if (user) {
      createToken();
    }
  }, [user, onError]);

  if (!linkToken) {
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
    <PlaidLinkButton 
      linkToken={linkToken} 
      onSuccess={onSuccess} 
      onError={onError} 
    />
  );
};

export default PlaidLink;
