import React, { useCallback, useState, useEffect, memo } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { auth } from './firebase';

const PlaidLinkButton = memo(({ linkToken, onSuccess, onError, buttonText, buttonClassName }) => {
  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    console.log('✅ Plaid success!', metadata);
    try {
      const idToken = await auth.currentUser.getIdToken();
      
      const response = await fetch('/api/exchangePlaidToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ publicToken })
      });
      
      const data = await response.json();
      
      // Pass metadata back to parent so it can store brokerage info
      // Include the item_id from the exchange response if available
      onSuccess({
        item_id: data.item_id || metadata.link_session_id, // Use item_id from backend or fallback
        institution: metadata.institution, // { name, institution_id }
        accounts: metadata.accounts,
        link_session_id: metadata.link_session_id
      });
    } catch (error) {
      console.error('Error exchanging token:', error);
      onError(error);
    }
  }, [onSuccess, onError]);

  const onPlaidExit = useCallback((err, metadata) => {
    console.log('🚪 Plaid exited', { err, metadata });
    if (err) {
      console.error('Exit error:', err);
    }
  }, []);

  const config = {
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  };

  const { open, ready, error } = usePlaidLink(config);

  useEffect(() => {
    console.log('Plaid Link state:', { ready, error, linkToken: linkToken?.substring(0, 20) + '...' });
  }, [ready, error, linkToken]);

  // Use custom className if provided, otherwise use default
  const defaultClassName = "bg-[#00ff4e] hover:opacity-90 disabled:opacity-50 text-black font-black px-6 py-3 rounded-lg text-sm uppercase tracking-tight transition-all";

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Opening Plaid, ready:', ready);
        open();
      }}
      disabled={!ready}
      className={buttonClassName || defaultClassName}
    >
      {buttonText || 'Connect Brokerage Account'}
    </button>
  );
});

PlaidLinkButton.displayName = 'PlaidLinkButton';

const PlaidLink = ({ user, onSuccess, onError, buttonText, buttonClassName }) => {
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    const createToken = async () => {
      try {
        console.log('🔑 Creating link token...');
        const idToken = await auth.currentUser.getIdToken(true);
        
        const response = await fetch('/api/createLinkToken', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Cache-Control': 'no-cache'
          }
        });
        
        const data = await response.json();
        console.log('📥 Link token response:', data);
        
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
      setLinkToken(null);
      createToken();
    }
  }, [user, onError]);

  if (!linkToken) {
    // Use custom className for loading state too, but with disabled styling
    const loadingClassName = buttonClassName 
      ? `${buttonClassName} opacity-50 cursor-not-allowed`
      : "bg-zinc-900 text-zinc-600 font-black px-6 py-3 rounded-lg text-sm uppercase tracking-tight cursor-not-allowed";
    
    return (
      <button
        disabled
        className={loadingClassName}
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
      buttonText={buttonText}
      buttonClassName={buttonClassName}
    />
  );
};

export default PlaidLink;