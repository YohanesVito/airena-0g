"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, LineStyle, LineSeries, AreaSeries } from "lightweight-charts";

export interface BotPrediction {
  botId: number;
  name: string;
  priceLow: number;
  priceHigh: number;
  color: string;
  won?: boolean;
}

interface BtcChartProps {
  predictions?: BotPrediction[];
  settlementPrice?: number;
  height?: number;
  question?: string;
}

function generateMockPriceData(basePrice: number, points: number) {
  const data: { time: number; value: number }[] = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  for (let i = points; i >= 0; i--) {
    price += (Math.random() - 0.48) * 200;
    data.push({ time: (now - i * 300) as number, value: Math.round(price * 100) / 100 });
  }
  return data;
}

const BOT_COLORS = ["#00F0FF", "#FF2D78", "#39FF14", "#B44DFF", "#FF6B2B"];

// Convert hex + alpha to rgba
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function BtcChart({ predictions = [], settlementPrice, height = 400, question }: BtcChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const chartInstanceRef = useRef<any>(null);
  const mainSeriesRef = useRef<any>(null);

  // Draw range overlays using chart coordinate conversion
  const updateOverlays = useCallback(() => {
    if (!overlayRef.current || !mainSeriesRef.current || predictions.length === 0) return;

    const series = mainSeriesRef.current;
    let html = "";

    predictions.forEach((pred, idx) => {
      const color = pred.color || BOT_COLORS[idx % BOT_COLORS.length];
      const y1 = series.priceToCoordinate(pred.priceHigh);
      const y2 = series.priceToCoordinate(pred.priceLow);

      if (y1 === null || y2 === null) return;

      const top = Math.min(y1, y2);
      const h = Math.abs(y2 - y1);
      const alpha = pred.won === false ? 0.06 : 0.12;
      const borderAlpha = pred.won === false ? 0.15 : 0.35;

      html += `<div style="
        position:absolute; left:0; right:60px; top:${top}px; height:${h}px;
        background:${hexToRgba(color, alpha)};
        border-top:1px solid ${hexToRgba(color, borderAlpha)};
        border-bottom:1px solid ${hexToRgba(color, borderAlpha)};
        pointer-events:none; z-index:1;
      ">
        <span style="
          position:absolute; left:8px; top:50%; transform:translateY(-50%);
          font-family:'Space Mono',monospace; font-size:9px;
          color:${hexToRgba(color, pred.won === false ? 0.4 : 0.8)};
          letter-spacing:0.5px; white-space:nowrap;
        ">${pred.name}</span>
      </div>`;
    });

    // Settlement price line
    if (settlementPrice) {
      const sy = series.priceToCoordinate(settlementPrice);
      if (sy !== null) {
        html += `<div style="
          position:absolute; left:0; right:60px; top:${sy}px; height:2px;
          background:linear-gradient(90deg, transparent, #39FF14, #39FF14, transparent);
          box-shadow:0 0 8px rgba(57,255,20,0.5);
          pointer-events:none; z-index:2;
        ">
          <span style="
            position:absolute; right:4px; top:-14px;
            font-family:'Orbitron',monospace; font-size:9px; font-weight:700;
            color:#39FF14; letter-spacing:1px;
          ">SETTLED</span>
        </div>`;
      }
    }

    overlayRef.current.innerHTML = html;
  }, [predictions, settlementPrice]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const basePrice = 94500 + Math.random() * 1000;
    const priceData = generateMockPriceData(basePrice, 48);
    setCurrentPrice(priceData[priceData.length - 1].value);

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.5)",
        fontFamily: "'Space Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(0,240,255,0.04)" },
        horzLines: { color: "rgba(0,240,255,0.04)" },
      },
      width: chartContainerRef.current.clientWidth,
      height,
      crosshair: {
        vertLine: { color: "rgba(0,240,255,0.3)", labelBackgroundColor: "#0a0e1a" },
        horzLine: { color: "rgba(0,240,255,0.3)", labelBackgroundColor: "#0a0e1a" },
      },
      rightPriceScale: {
        borderColor: "rgba(0,240,255,0.1)",
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderColor: "rgba(0,240,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: false,
      handleScale: false,
    });
    chartInstanceRef.current = chart;

    // Main price line
    const mainSeries = chart.addSeries(LineSeries, {
      color: "#00F0FF",
      lineWidth: 2,
      priceLineVisible: true,
      priceLineColor: "rgba(0,240,255,0.4)",
      priceLineStyle: LineStyle.Dashed,
      lastValueVisible: true,
    });
    mainSeries.setData(priceData as any);
    mainSeriesRef.current = mainSeries;

    chart.timeScale().fitContent();

    // Initial overlay draw (after chart renders)
    setTimeout(updateOverlays, 100);

    // Redraw overlays on crosshair move / scale change
    chart.subscribeCrosshairMove(updateOverlays);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        setTimeout(updateOverlays, 50);
      }
    };
    window.addEventListener("resize", handleResize);

    // Live updates
    const interval = setInterval(() => {
      const last = priceData[priceData.length - 1];
      const newPrice = last.value + (Math.random() - 0.49) * 80;
      const newPoint = { time: (last.time + 300) as number, value: Math.round(newPrice * 100) / 100 };
      priceData.push(newPoint);
      mainSeries.update(newPoint as any);
      setCurrentPrice(newPoint.value);
      updateOverlays();
    }, 3000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [predictions, settlementPrice, height, updateOverlays]);

  return (
    <div className="glass-card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 3 }}>
        <div>
          <span className="font-mono text-xs text-muted" style={{ letterSpacing: 1 }}>BTC / USD</span>
          <div className="font-display" style={{ fontSize: 22, color: "var(--neon-cyan)", textShadow: "0 0 20px rgba(0,240,255,0.3)" }}>
            ${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {question ? (
            <div className="font-mono" style={{ fontSize: 11, color: "var(--neon-pink)", marginBottom: 4 }}>{question}</div>
          ) : null}
          <div className="badge badge-cyan" style={{ fontSize: 10 }}>
            <span className="status-dot live" />
            LIVE
          </div>
        </div>
      </div>

      {/* Bot Legend */}
      {predictions.length > 0 ? (
        <div style={{ padding: "4px 20px 8px", display: "flex", gap: 16, flexWrap: "wrap", position: "relative", zIndex: 3 }}>
          {predictions.map((pred, idx) => {
            const color = pred.color || BOT_COLORS[idx % BOT_COLORS.length];
            return (
              <span key={pred.botId} className="font-mono" style={{
                fontSize: 10,
                color,
                opacity: pred.won === false ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}>
                <span style={{ display: "inline-block", width: 12, height: 8, background: hexToRgba(color, 0.3), border: `1px solid ${hexToRgba(color, 0.5)}`, borderRadius: 2 }} />
                {pred.name}
                <span style={{ opacity: 0.6 }}>
                  (${pred.priceLow.toLocaleString()} – ${pred.priceHigh.toLocaleString()})
                </span>
              </span>
            );
          })}
        </div>
      ) : null}

      {/* Chart + Range overlays */}
      <div style={{ position: "relative" }}>
        <div ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }} />
        <div ref={chartContainerRef} style={{ width: "100%", position: "relative", zIndex: 0 }} />
      </div>
    </div>
  );
}
