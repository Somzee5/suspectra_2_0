export type FeatureCategory = 'face' | 'eyes' | 'eyebrows' | 'nose' | 'lips' | 'ears' | 'hair'

export interface SketchLayer {
  id: string
  type: FeatureCategory
  asset: string          // URL in /public/assets/features/{type}/{name}.svg
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
