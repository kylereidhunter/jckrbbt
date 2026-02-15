// components/CurrentTime.js
import React, { useState, useEffect } from 'react';

function CurrentTime() {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <>
      <p className="text-[#00ff4e] font-black tabular-nums text-lg md:text-xl tracking-tighter">
        {time.toLocaleTimeString([], { hour12: true })}
      </p>
      <p className="text-zinc-500 text-[8px] md:text-[10px] font-black uppercase tracking-wider md:tracking-widest">
        {time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
      </p>
    </>
  );
}

export default CurrentTime;
