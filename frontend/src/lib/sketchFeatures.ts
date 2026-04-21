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
  /** only one layer of this category allowed on canvas at a time */
  singleInstance: boolean
  defaultProps: { width: number; height: number; x: number; y: number }
  features: FeatureDef[]
}

const f = (cat: FeatureCategory, num: string, name: string): FeatureDef => ({
  id: `${cat}_${num}`,
  name,
  asset: `/assets/features/${cat}/${cat}_${num}.png`,
})

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'face',
    label: 'Face Shape',
    icon: '◯',
    singleInstance: true,
    defaultProps: { width: 320, height: 400, x: 90, y: 60 },
    features: [
      f('face','01','Oval'),   f('face','02','Round'),
      f('face','03','Square'), f('face','04','Heart'),
      f('face','05','Long'),   f('face','06','Diamond'),
      f('face','07','Wide'),   f('face','08','Soft'),
      f('face','09','Narrow'), f('face','10','Angular'),
    ],
  },
  {
    id: 'hair',
    label: 'Hair',
    icon: '〜',
    singleInstance: true,
    defaultProps: { width: 340, height: 200, x: 80, y: 25 },
    features: [
      f('hair','01','Short Straight'), f('hair','02','Medium'),
      f('hair','03','Long Straight'),  f('hair','04','Curly'),
      f('hair','05','Wavy'),           f('hair','06','Bald'),
      f('hair','07','Spiky'),          f('hair','08','Side Part'),
      f('hair','09','Crew Cut'),       f('hair','10','Afro'),
      f('hair','11','Ponytail'),       f('hair','12','Buzz Cut'),
      f('hair','13','Bowl Cut'),
    ],
  },
  {
    id: 'eyes',
    label: 'Eyes',
    icon: '◉',
    singleInstance: true,
    defaultProps: { width: 260, height: 80, x: 120, y: 210 },
    features: [
      f('eyes','01','Almond'),      f('eyes','02','Round'),
      f('eyes','03','Narrow'),      f('eyes','04','Wide'),
      f('eyes','05','Upturned'),    f('eyes','06','Downturned'),
      f('eyes','07','Deep Set'),    f('eyes','08','Hooded'),
      f('eyes','09','Monolid'),     f('eyes','10','Close Set'),
      f('eyes','11','Wide Set'),    f('eyes','12','Heavy Lid'),
    ],
  },
  {
    id: 'eyebrows',
    label: 'Eyebrows',
    icon: '⌒',
    singleInstance: true,
    defaultProps: { width: 260, height: 55, x: 120, y: 178 },
    features: [
      f('eyebrows','01','Thin Arch'),    f('eyebrows','02','Thick Flat'),
      f('eyebrows','03','Bushy'),        f('eyebrows','04','Curved'),
      f('eyebrows','05','Angular'),      f('eyebrows','06','Straight'),
      f('eyebrows','07','High Arch'),    f('eyebrows','08','Low Arch'),
      f('eyebrows','09','Unibrow'),      f('eyebrows','10','Pencil Thin'),
      f('eyebrows','11','Full Natural'), f('eyebrows','12','Tapered'),
    ],
  },
  {
    id: 'nose',
    label: 'Nose',
    icon: '∧',
    singleInstance: true,
    defaultProps: { width: 110, height: 130, x: 195, y: 268 },
    features: [
      f('nose','01','Button'),    f('nose','02','Roman'),
      f('nose','03','Wide'),      f('nose','04','Narrow'),
      f('nose','05','Upturned'),  f('nose','06','Flat'),
      f('nose','07','Hooked'),    f('nose','08','Bulbous'),
      f('nose','09','Straight'),  f('nose','10','Snub'),
      f('nose','11','Greek'),     f('nose','12','Fleshy'),
    ],
  },
  {
    id: 'lips',
    label: 'Lips',
    icon: '◡',
    singleInstance: true,
    defaultProps: { width: 180, height: 75, x: 160, y: 368 },
    features: [
      f('lips','01','Thin'),      f('lips','02','Full'),
      f('lips','03','Bow-shape'), f('lips','04','Wide'),
      f('lips','05','Pouty'),     f('lips','06','Closed'),
      f('lips','07','Cupid Bow'), f('lips','08','Downturned'),
      f('lips','09','Upturned'),  f('lips','10','Medium'),
      f('lips','11','Asymmetric'),f('lips','12','Compressed'),
    ],
  },
  {
    id: 'mustache',
    label: 'Facial Hair',
    icon: '∫',
    singleInstance: true,
    defaultProps: { width: 180, height: 80, x: 160, y: 330 },
    features: [
      f('mustache','01','Clean'),       f('mustache','02','Stubble'),
      f('mustache','03','Thin'),        f('mustache','04','Chevron'),
      f('mustache','05','Full Beard'),  f('mustache','06','Goatee'),
      f('mustache','07','Handlebar'),   f('mustache','08','Fu Manchu'),
      f('mustache','09','Circle'),      f('mustache','10','Sideburns'),
      f('mustache','11','Mutton Chop'), f('mustache','12','Long Beard'),
    ],
  },
  {
    id: 'extras',
    label: 'Marks / Extras',
    icon: '+',
    singleInstance: false,   // multiple marks allowed (scars, glasses etc.)
    defaultProps: { width: 120, height: 80, x: 190, y: 280 },
    features: [
      f('extras','01','Glasses'),  f('extras','02','Scar'),
      f('extras','03','Mole'),     f('extras','04','Tattoo'),
      f('extras','05','Freckles'), f('extras','06','Wrinkles'),
    ],
  },
]
