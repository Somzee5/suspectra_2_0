import type { FeatureCategory } from '@/types/sketch'

export interface FeatureDef {
  id: string
  name: string
  asset: string
}

export interface CategoryDef {
  id: FeatureCategory
  label: string
  icon: string
  defaultProps: { width: number; height: number; x: number; y: number }
  features: FeatureDef[]
}

const f = (cat: FeatureCategory, id: string, name: string): FeatureDef => ({
  id: `${cat}_${id}`,
  name,
  asset: `/assets/features/${cat}/${cat}_${id}.svg`,
})

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'face',
    label: 'Face Shape',
    icon: '◯',
    defaultProps: { width: 280, height: 360, x: 110, y: 70 },
    features: [
      f('face', '1', 'Round'),
      f('face', '2', 'Oval'),
      f('face', '3', 'Square'),
      f('face', '4', 'Heart'),
      f('face', '5', 'Diamond'),
      f('face', '6', 'Long'),
    ],
  },
  {
    id: 'hair',
    label: 'Hair',
    icon: '〜',
    defaultProps: { width: 300, height: 180, x: 100, y: 35 },
    features: [
      f('hair', '1', 'Short Crop'),
      f('hair', '2', 'Medium'),
      f('hair', '3', 'Wavy'),
      f('hair', '4', 'Bald'),
      f('hair', '5', 'Long'),
      f('hair', '6', 'Spiky'),
    ],
  },
  {
    id: 'eyes',
    label: 'Eyes',
    icon: '◉',
    defaultProps: { width: 220, height: 70, x: 140, y: 215 },
    features: [
      f('eyes', '1', 'Almond'),
      f('eyes', '2', 'Wide Round'),
      f('eyes', '3', 'Narrow'),
      f('eyes', '4', 'Upturned'),
      f('eyes', '5', 'Downturned'),
      f('eyes', '6', 'Deep Set'),
    ],
  },
  {
    id: 'eyebrows',
    label: 'Eyebrows',
    icon: '⌒',
    defaultProps: { width: 220, height: 45, x: 140, y: 185 },
    features: [
      f('eyebrows', '1', 'Arched Thin'),
      f('eyebrows', '2', 'Straight Thick'),
      f('eyebrows', '3', 'Bushy'),
      f('eyebrows', '4', 'Curved'),
      f('eyebrows', '5', 'Angular'),
      f('eyebrows', '6', 'Flat'),
    ],
  },
  {
    id: 'nose',
    label: 'Nose',
    icon: '∧',
    defaultProps: { width: 90, height: 110, x: 205, y: 270 },
    features: [
      f('nose', '1', 'Button'),
      f('nose', '2', 'Roman'),
      f('nose', '3', 'Wide'),
      f('nose', '4', 'Narrow'),
      f('nose', '5', 'Upturned'),
      f('nose', '6', 'Flat Broad'),
    ],
  },
  {
    id: 'lips',
    label: 'Lips',
    icon: '◡',
    defaultProps: { width: 160, height: 70, x: 170, y: 368 },
    features: [
      f('lips', '1', 'Thin'),
      f('lips', '2', 'Full'),
      f('lips', '3', 'Bow-shaped'),
      f('lips', '4', 'Wide'),
      f('lips', '5', 'Pouty'),
      f('lips', '6', 'Closed'),
    ],
  },
  {
    id: 'ears',
    label: 'Ears',
    icon: '⊃',
    defaultProps: { width: 60, height: 90, x: 92, y: 230 },
    features: [
      f('ears', '1', 'Standard'),
      f('ears', '2', 'Protruding'),
      f('ears', '3', 'Small'),
      f('ears', '4', 'Pointed'),
      f('ears', '5', 'Flat'),
      f('ears', '6', 'Long Lobe'),
    ],
  },
]
