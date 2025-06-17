import React from 'react';

interface OddsCardProps {
  title: string;
  probability: number; // expressed as 0-1
  accentColor: 'green' | 'red' | 'blue' | 'yellow';
  onClick?: () => void;
  selected?: boolean;
}

const accentMap = {
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    bar: 'bg-green-500'
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    bar: 'bg-red-500'
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    bar: 'bg-blue-500'
  },
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    bar: 'bg-yellow-500'
  }
};

export default function OddsCard({ title, probability, accentColor, onClick, selected }: OddsCardProps) {
  const accent = accentMap[accentColor];
  const percentage = (probability * 100).toFixed(1);

  return (
    <button
      onClick={onClick}
      className={`relative p-4 rounded-xl border-2 shadow-sm transition-all w-full text-left ${accent.bg} ${accent.border} ${accent.text} ${selected ? 'ring-2 ring-offset-2 ring-blue-500' : 'hover:border-blue-300'}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-lg">{title}</span>
        <span className="text-xl font-bold">{percentage}%</span>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`${accent.bar} h-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </button>
  );
} 