import { useEffect, useState, useRef } from 'react';

export default function CountUp({ end, duration = 1000, decimals = 2, prefix = '', suffix = '' }) {
  const [count, setCount] = useState(0);
  const prevEndRef = useRef(null); // null means first render
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    // On first render, animate from 0
    const startValue = isFirstRenderRef.current ? 0 : (prevEndRef.current ?? end);
    const endValue = end;
    
    // Don't animate if the value hasn't changed (and it's not first render)
    if (!isFirstRenderRef.current && startValue === endValue) {
      return;
    }
    
    let startTime;
    let animationFrame;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Easing function for smooth acceleration/deceleration
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      // Animate from startValue to endValue
      const currentCount = startValue + (endValue - startValue) * easeOutQuart;
      setCount(currentCount);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(endValue);
        prevEndRef.current = endValue;
        isFirstRenderRef.current = false;
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [end, duration]);

  const formattedCount = decimals > 0 
    ? count.toFixed(decimals)
    : Math.round(count);

  return <>{prefix}{formattedCount}{suffix}</>;
}