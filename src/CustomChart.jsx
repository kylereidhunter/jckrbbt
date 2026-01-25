import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

const CustomChart = ({ symbol, FINNHUB_KEY }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current || !symbol) return;

    let isMounted = true;

    // Create chart with custom styling
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 220,
      layout: {
        background: { color: '#000000' },
        textColor: '#666666',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#00ff4e',
          width: 1,
          style: 3,
          labelBackgroundColor: '#00ff4e',
        },
        horzLine: {
          color: '#00ff4e',
          width: 1,
          style: 3,
          labelBackgroundColor: '#00ff4e',
        },
      },
      timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
      },
    });

    chartRef.current = chart;

    // Add area series
    const areaSeries = chart.addAreaSeries({
      lineColor: '#00ff4e',
      topColor: 'rgba(0, 255, 78, 0.4)',
      bottomColor: 'rgba(0, 255, 78, 0.0)',
      lineWidth: 2,
    });

    seriesRef.current = areaSeries;

    // Fetch historical data
    const fetchData = async () => {
      if (!isMounted) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=YOUR_API_KEY_HERE&outputsize=compact`
        );
        const data = await response.json();

        if (!isMounted) return;

        console.log('Chart data response:', data);

        if (data['Time Series (Daily)']) {
          const timeSeries = data['Time Series (Daily)'];
          const chartData = Object.keys(timeSeries)
            .map(date => ({
              time: new Date(date).getTime() / 1000,
              value: parseFloat(timeSeries[date]['4. close'])
            }))
            .sort((a, b) => a.time - b.time);

          console.log(`Chart has ${chartData.length} data points`);
          
          if (isMounted && seriesRef.current) {
            areaSeries.setData(chartData);
            setHasData(true);
            
            // Force chart to fit content after data is loaded
            setTimeout(() => {
              if (isMounted && chartRef.current) {
                chart.timeScale().fitContent();
              }
            }, 100);
          }
        } else {
          if (isMounted) setHasData(false);
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        if (isMounted) setHasData(false);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      
      // Safe cleanup
      try {
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      } catch (e) {
        // Chart already disposed, ignore
      }
      
      seriesRef.current = null;
    };
  }, [symbol]);

  return (
    <div style={{ width: '100%', height: '220px', position: 'relative' }}>
      <div 
        ref={chartContainerRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute',
          top: 0,
          left: 0,
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#000'
        }}
      />
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#00ff4e',
          fontSize: '10px',
          fontWeight: 'bold',
          letterSpacing: '0.2em',
          zIndex: 10,
        }}>
          LOADING CHART...
        </div>
      )}
      {!isLoading && !hasData && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#666',
          fontSize: '10px',
          fontWeight: 'bold',
          letterSpacing: '0.2em',
          zIndex: 10,
        }}>
          NO DATA AVAILABLE
        </div>
      )}
    </div>
  );
};

export default CustomChart;