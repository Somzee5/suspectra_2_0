'use client'

import { AlertTriangle, User } from 'lucide-react'

export interface SuspectMatch {
  suspectId:      string
  name:           string
  age:            number | null
  gender:         string | null
  crimeType:      string
  description:    string
  imageUrl:       string
  awsSimilarity:  number
  embeddingScore: number
  finalScore:     number
  confidence:     number
}

interface SuspectCardProps {
  match: SuspectMatch
  rank:  number
}

function confidenceColor(score: number): string {
  if (score >= 75) return 'text-red-400 border-red-500/40 bg-red-500/10'
  if (score >= 55) return 'text-amber-400 border-amber-500/40 bg-amber-500/10'
  return 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10'
}

function confidenceLabel(score: number): string {
  if (score >= 80) return 'High Match'
  if (score >= 60) return 'Possible Match'
  return 'Low Match'
}

export default function SuspectCard({ match, rank }: SuspectCardProps) {
  // If finalScore is 0 (no stored ArcFace embeddings yet), fall back to
  // the hybrid formula client-side, or AWS-only if embedding is also 0.
  const displayScore = (match.finalScore ?? 0) > 0
    ? match.finalScore
    : (match.embeddingScore ?? 0) > 0
      ? 0.6 * match.awsSimilarity + 0.4 * match.embeddingScore
      : match.awsSimilarity

  const colorClass = confidenceColor(displayScore)

  return (
    <div className="card flex flex-col overflow-hidden hover:border-slate-600 transition-colors">
      {/* Image */}
      <div className="relative bg-slate-800 h-44 flex items-center justify-center overflow-hidden">
        {match.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={match.imageUrl}
            alt={match.name}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <User className="w-16 h-16 text-slate-600" />
        )}
        {/* Rank badge */}
        <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-slate-900/90 border border-slate-700
                        flex items-center justify-center text-xs font-bold text-slate-300">
          #{rank}
        </div>
        {/* Final score badge */}
        <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}>
          {displayScore.toFixed(1)}%
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div>
          <p className="font-semibold text-white text-sm">{match.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {[match.gender, match.age ? `Age ${match.age}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-400 font-medium truncate">{match.crimeType}</span>
        </div>

        {match.description && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{match.description}</p>
        )}

        {/* Match confidence */}
        <div className={`mt-auto text-center text-sm font-semibold rounded-lg py-1.5 border ${colorClass}`}>
          {confidenceLabel(displayScore)} · {displayScore.toFixed(1)}%
        </div>
      </div>
    </div>
  )
}
