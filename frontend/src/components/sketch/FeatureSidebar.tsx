'use client'

import { useState } from 'react'
import { CATEGORIES, type CategoryDef, type FeatureDef } from '@/lib/sketchFeatures'
import type { FeatureCategory } from '@/types/sketch'

interface FeatureSidebarProps {
  onAddFeature: (cat: CategoryDef, feature: FeatureDef) => void
}

export default function FeatureSidebar({ onAddFeature }: FeatureSidebarProps) {
  const [activeCategory, setActiveCategory] = useState<FeatureCategory>('face')

  const category = CATEGORIES.find((c) => c.id === activeCategory)!

  return (
    <aside className="w-60 flex flex-col border-r border-slate-800 bg-slate-900 overflow-hidden">
      {/* Category tabs */}
      <div className="p-3 border-b border-slate-800">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Feature Library</p>
        <div className="flex flex-col gap-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left
                ${activeCategory === cat.id
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
              `}
            >
              <span className="text-base w-5 text-center">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feature thumbnails */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-xs text-slate-500 mb-3">
          Click to add · Drag to position on canvas
        </p>
        <div className="grid grid-cols-2 gap-2">
          {category.features.map((feature) => (
            <button
              key={feature.id}
              onClick={() => onAddFeature(category, feature)}
              className="
                group flex flex-col items-center gap-1.5 p-2 rounded-xl
                bg-slate-800/60 border border-slate-700
                hover:border-cyan-500/50 hover:bg-slate-800
                active:scale-95 transition-all duration-100
              "
              title={`Add ${feature.name}`}
            >
              {/* Feature preview */}
              <div className="w-full h-14 flex items-center justify-center bg-white rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={feature.asset}
                  alt={feature.name}
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />
              </div>
              <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors text-center leading-tight">
                {feature.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
