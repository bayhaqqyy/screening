import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const AdvancedChart = ({ data = [], theme = 'dark' }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const isDark = theme === 'dark';
    const backgroundColor = isDark ? 'transparent' : '#ffffff';
    const textColor = isDark ? '#9ca3af' : '#4b5563';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: 'solid', color: backgroundColor },
        textColor: textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981', // green (primary)
      downColor: '#ef4444', // red (error)
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    if (data && data.length > 0) {
      candlestickSeries.setData(data);
    }

    // Add Volume histogram
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // set as an overlay by setting a blank priceScaleId
    });

    chart.priceScale('').applyOptions({
      scaleMargins: {
        top: 0.8, // highest point of the series will be 80% away from the top
        bottom: 0,
      },
    });

    if (data && data.length > 0) {
      const volumeData = data.map(item => ({
        time: item.time,
        value: item.volume,
        color: item.close >= item.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
      }));
      volumeSeries.setData(volumeData);
    }

    chartRef.current = chart;
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, theme]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-surface-container-low rounded-xl border border-outline-variant/10">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-surface-variant mb-2 animate-pulse">query_stats</span>
          <p className="text-on-surface-variant font-bold">Loading chart data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl overflow-hidden border border-outline-variant/10 bg-surface-container-low p-4">
      <div ref={chartContainerRef} className="w-full h-[400px]" />
    </div>
  );
};

export default AdvancedChart;
