import React, { useMemo } from 'react';

const BAR_COUNT = 28;

interface VoiceWaveformProps {
  active: boolean;
  audioLevel?: number;
  variant?: 'compact' | 'wide';
}

const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  active,
  audioLevel = 0,
  variant = 'compact',
}) => {
  const bars = useMemo(() => {
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const center = (BAR_COUNT - 1) / 2;
      const dist = Math.abs(i - center) / center;
      const envelope = 1 - dist * 0.55;
      const wobble = Math.sin(i * 0.85) * 0.12;
      const level = active ? Math.min(1, audioLevel * 1.35 + wobble + 0.08) : 0.12;
      const height = 0.2 + envelope * level * 0.8;
      return Math.max(0.15, Math.min(1, height));
    });
  }, [active, audioLevel]);

  return (
    <div
      className={`voice-waveform voice-waveform--${variant} ${active && audioLevel < 0.05 ? 'voice-waveform--idle-animate' : ''}`}
      aria-hidden="true"
    >
      {bars.map((height, i) => (
        <span
          key={i}
          className="voice-waveform__bar"
          style={{
            transform: `scaleY(${height})`,
            animationDelay: active && audioLevel < 0.05 ? `${i * 0.04}s` : undefined,
            opacity: active ? 0.45 + height * 0.55 : 0.25,
          }}
        />
      ))}
    </div>
  );
};

export default VoiceWaveform;
