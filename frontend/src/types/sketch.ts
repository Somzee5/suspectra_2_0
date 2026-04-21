export type FeatureCategory =
  | 'face' | 'eyes' | 'eyebrows' | 'nose'
  | 'lips' | 'hair' | 'mustache' | 'extras'

export interface SketchLayer {
  id: string
  type: FeatureCategory
  asset: string
  label: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  zIndex: number
}

export interface SketchState {
  id: string
  createdAt: string
  layers: SketchLayer[]
}

export type LayerUpdate = Partial<Omit<SketchLayer, 'id' | 'type' | 'asset'>>
