// Card sets. Pictures for animals and space live in art/<theme>/<key>.webp.
// Countries use SVG flags (flags.js). Photos come from the player.
// Names and facts are translated (see strings.js), so they are read when
// shown, in the current language.

import { FLAGS } from './flags.js';
import { t } from '../../shared/i18n.js';
import './strings.js';

const ANIMALS = [
  'lion', 'elephant', 'giraffe', 'zebra', 'panda', 'koala', 'kangaroo', 'tiger', 'monkey',
  'penguin', 'polar-bear', 'fox', 'owl', 'rabbit', 'hedgehog', 'squirrel', 'deer', 'raccoon',
  'dolphin', 'whale', 'octopus', 'sea-turtle', 'crab', 'flamingo', 'parrot', 'frog', 'butterfly',
];

const SPACE = [
  'sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'phobos', 'deimos', 'ceres',
  'jupiter', 'io', 'europa', 'ganymede', 'callisto', 'saturn', 'titan', 'enceladus', 'mimas',
  'rhea', 'iapetus', 'uranus', 'miranda', 'titania', 'neptune', 'triton', 'pluto', 'charon',
];

const COUNTRIES = Object.keys(FLAGS);

// Every item: { key, name, fact?, image?, flag? }
export const THEME_INFO = {
  animals: {
    get label() {
      return t('memory.theme.animals');
    },
    items: ANIMALS.map((key) => ({
      key,
      get name() {
        return t(`animal.${key}`);
      },
      image: `art/animals/${key}.webp`,
    })),
  },
  space: {
    get label() {
      return t('memory.theme.space');
    },
    items: SPACE.map((key) => ({
      key,
      get name() {
        return t(`space.${key}.name`);
      },
      get fact() {
        return t(`space.${key}.fact`);
      },
      image: `art/space/${key}.webp`,
    })),
  },
  countries: {
    get label() {
      return t('memory.theme.countries');
    },
    items: COUNTRIES.map((key) => ({
      key,
      get name() {
        return t(`country.${key}.name`);
      },
      get fact() {
        return t(`country.${key}.fact`);
      },
      flag: FLAGS[key],
    })),
  },
  photos: {
    get label() {
      return t('memory.theme.photos');
    },
    items: [],
  },
};
