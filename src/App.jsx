
import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';

const VOLS = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];
const MAX_HISTORY = 10000;

export default function OverUnderSniper() {
  const [vol, setVol] = useState('R_25');
  const [digits, setDigits] = useState([]);
  const [socket, setSocket] = useState(null);
  const [strategy, setStrategy] = useState({
    direction: 'over',
    thresholdDigit: 5,
    streak: 4
  });
  const [signal, setSignal] = useState(null);
  const [historyStats, setHistoryStats] = useState({});
  const [mode, setMode] = useState('live');
  const [winStats, setWinStats] = useState({ total: 0, wins: 0, losses: 0 });
  const audioRef = useRef(null);

  useEffect(() => {
    if (socket) socket.close();
    const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
    ws.onopen = () => {
      ws.send(JSON.stringify({ ticks: vol, subscribe: 1 }));
    };
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.tick) {
        const digit = parseInt(data.tick.quote.toString().slice(-1));
        setDigits(prev => {
          const updated = [...prev, digit];
          if (updated.length > MAX_HISTORY) updated.shift();
          return updated;
        });
      }
    };
    setSocket(ws);
    return () => ws.close();
  }, [vol]);

  useEffect(() => {
    if (digits.length < strategy.streak + 1) return;
    const lastDigits = digits.slice(-(strategy.streak + 1));
    const match = lastDigits.slice(0, strategy.streak);
    const next = lastDigits[strategy.streak];
    let conditionMet = false;

    if (strategy.direction === 'over') {
      conditionMet = match.every(d => d <= strategy.thresholdDigit);
      if (conditionMet) {
        if (next > strategy.thresholdDigit) {
          setWinStats(prev => ({ ...prev, wins: prev.wins + 1, total: prev.total + 1 }));
        } else {
          setWinStats(prev => ({ ...prev, losses: prev.losses + 1, total: prev.total + 1 }));
        }
      }
    } else {
      conditionMet = match.every(d => d >= strategy.thresholdDigit);
      if (conditionMet) {
        if (next < strategy.thresholdDigit) {
          setWinStats(prev => ({ ...prev, wins: prev.wins + 1, total: prev.total + 1 }));
        } else {
          setWinStats(prev => ({ ...prev, losses: prev.losses + 1, total: prev.total + 1 }));
        }
      }
    }

    if (conditionMet) {
      setSignal(strategy.direction.toUpperCase());
      if (audioRef.current) audioRef.current.play();
    } else {
      setSignal(null);
    }
  }, [digits, strategy]);

  useEffect(() => {
    const counts = Array(10).fill(0);
    digits.forEach(d => counts[d]++);
    const freq = counts.map((count, digit) => ({ digit, freq: count / digits.length }));
    setHistoryStats({ freq });
  }, [digits]);

  const toggleMode = () => {
    const modes = ['live', 'signal', 'stats'];
    const currentIdx = modes.indexOf(mode);
    setMode(modes[(currentIdx + 1) % modes.length]);
  };

  return (
    <div className="p-6 space-y-4">
      <audio ref={audioRef} src="/sniper-alert.mp3" preload="auto" />

      <h1 className="text-xl font-bold">📈 Over/Under Sniper - Deriv</h1>

      <Select onValueChange={setVol} value={vol}>
        {VOLS.map(v => (
          <SelectItem key={v} value={v}>{v}</SelectItem>
        ))}
      </Select>

      <Button onClick={toggleMode}>Toggle View Mode ({mode})</Button>

      {mode !== 'signal' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between">
              <span>Last 30 Digits:</span>
              <span>{digits.slice(-30).join(' ')}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {mode !== 'stats' && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div>
              Strategy: {strategy.direction.toUpperCase()} if digits are {strategy.direction === 'over' ? '<=' : '>='} {strategy.thresholdDigit} for {strategy.streak} ticks
            </div>
            {signal && (
              <div className="text-green-600 font-bold">
                ✅ SNIPER ALERT: {signal} Opportunity Detected on {vol}
              </div>
            )}
            <div>
              📊 Win Rate: {winStats.total > 0 ? ((winStats.wins / winStats.total) * 100).toFixed(2) : '0.00'}% ({winStats.wins}W / {winStats.losses}L)
            </div>
          </CardContent>
        </Card>
      )}

      {mode === 'stats' && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-md font-semibold mb-2">📊 Digit Frequency (Last {digits.length})</h2>
            <div className="grid grid-cols-5 gap-2">
              {historyStats.freq?.map(f => (
                <div key={f.digit} className="text-sm">
                  Digit {f.digit}: {(f.freq * 100).toFixed(2)}%
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={() => setStrategy({ ...strategy, direction: strategy.direction === 'over' ? 'under' : 'over' })}>
        Switch to {strategy.direction === 'over' ? 'UNDER' : 'OVER'} Strategy
      </Button>
    </div>
  );
}
