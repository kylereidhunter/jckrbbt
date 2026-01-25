const discoveryPrompt = `
          Using Google Search, identify 50 US stocks under $50 with MAJOR BULLISH catalysts reported in ${currentMonthName} ${currentYear} (specifically between ${yDate} and ${fDate}).
          
          You MUST perform multi-step research covering these 3 distinct catalyst pillars:

          PILLAR 1: FUNDAMENTAL
          - Search for: "${currentMonthName} ${currentYear} Forward Guidance raises", "New M&A buyout rumors", "FDA Phase 3 Approval results for ${currentMonthName}".
          
          PILLAR 2: MACRO & LEGISLATIVE
          - Search for: "Current ${currentMonthName} legislative winners", "OBBBA tax cut beneficiary stocks", "${currentYear} deregulation shifts".
          
          PILLAR 3: TECHNICAL & SENTIMENT
          - Search for: "Highest short interest stocks ${currentMonthName} ${currentYear}", "Stocks breaking resistance this week", "Tier-1 bank Strong Buy upgrades".

          SEARCH INSTRUCTIONS:
          - Focus on these sources: ${sourceString}.
          - Search for: "major stock upgrades this week", "M&A rumors 2026", "FDA approval calendar ${currentMonthName} 2026".
          - Return ONLY a comma-separated list of symbols.
          ${excludeStr}
        `;


        const analysis = await aiModel.generateContent(`
            TICKER: ${ticker}
            WINDOW: ${yDate} to ${fDate}
            NEWS: ${headlines}

            TASK: Determine if ${ticker} has a specific 2026 catalyst from these categories:
            - FUNDAMENTAL: Earnings/Guidance, M&A, FDA, Product Launch, Management Change.
            - MACRO: Interest Rate impact, Inflation hedge, OBBBA Tax Cut benefits, Geopolitical supply chain wins.
            - TECHNICAL: Short Squeezes, Resistance Breakouts, Analyst Upgrades.

            CRITICAL RULES:
            1. IGNORE any news from 2023-2025.
            2. If the "Catalyst" is just general market sentiment, set [SIG] NEUTRAL [/SIG].
            3. Identify the EXACT type from the list above.

            CRITICAL SOURCE RULES:
            1. Every insight MUST cite one of the whitelisted domains above.
            2. If a headline comes from a source NOT on this list (like a blog or unknown site), DISREGARD it.
            3. PRIORITIZE: Bloomberg, Reuters, and WSJ for the "Catalyst" section.
            
            1. PREDICTED RANGE: CALCULATE a closing range (1.5% - 2.5% width). Shift based on BULLISH/BEARISH sentiment.
            2. INSIGHTS: Provide 3 specific, 2-sentence insights. Format: Each starts with "|".
            3. SIGNAL: Bullish or Bearish based on current analyst consensus. 

            [CONF] LOGIC: Base 20. +12.45 (Tier 1 Source), +/- 25.00 (Consistency), +5.12 (Price Align).
            [VOLATILITY]: 100 * sqrt(σ²). Base σ² = [($${q.h} - $${q.l}) / $${q.c}]. 2.5x multiplier for major catalysts.
            [CAT]: Identify a concrete event (e.g., "FDA Phase 3 Approval" or "Morgan Stanley Upgrade"). Do not accept "Positive Sentiment" as a catalyst. Should be short, no more than 10 words.
            IF NO HARD CATALYST IS FOUND: You MUST set [SIG] NEUTRAL [/SIG] and [CAT] No Significant Catalyst [/CAT]

            FORMAT:
            NAME: ${p.name || 'Unknown'}
            [RANGE] $XX.XX - $XX.XX [/RANGE]
            [SIG] BEARISH or BULLISH [/SIG]
            [MOM] Positive, Steady, or Uncertain [/MOM]
            [CAT] Detailed Event [/CAT]
            [CONF] XX.XX [/CONF]
            [VOLATILITY] XX.XX [/VOLATILITY]
            [INSIGHTS] 
            | Insight one 
            | Insight two 
            | Insight three 
            [/INSIGHTS]
          `);
