// Card sets. Pictures for animals and space live in art/<theme>/<key>.webp.
// Countries use SVG flags (flags.js). Photos come from the player.

import { FLAGS } from './flags.js';

const ANIMALS = [
  'lion', 'elephant', 'giraffe', 'zebra', 'panda', 'koala', 'kangaroo', 'tiger', 'monkey',
  'penguin', 'polar bear', 'fox', 'owl', 'rabbit', 'hedgehog', 'squirrel', 'deer', 'raccoon',
  'dolphin', 'whale', 'octopus', 'sea turtle', 'crab', 'flamingo', 'parrot', 'frog', 'butterfly',
];

const SPACE = [
  ['sun', 'The Sun', 'The Sun is a star. About 1.3 million Earths could fit inside it.'],
  ['mercury', 'Mercury', 'Mercury is the smallest planet and the closest one to the Sun.'],
  ['venus', 'Venus', 'Venus is the hottest planet, even hotter than Mercury.'],
  ['earth', 'Earth', 'Earth is the only planet we know of that has life.'],
  ['moon', 'The Moon', 'People first walked on the Moon in 1969.'],
  ['mars', 'Mars', 'Mars looks red because of rusty iron in its dust.'],
  ['phobos', 'Phobos', 'Phobos, a moon of Mars, goes around Mars about three times a day.'],
  ['deimos', 'Deimos', 'Deimos is the smaller moon of Mars, only about 12 km across.'],
  ['ceres', 'Ceres', 'Ceres is a dwarf planet in the asteroid belt between Mars and Jupiter.'],
  ['jupiter', 'Jupiter', 'Jupiter is the biggest planet. Its Great Red Spot is a storm bigger than Earth.'],
  ['io', 'Io', 'Io, a moon of Jupiter, has hundreds of active volcanoes.'],
  ['europa', 'Europa', 'Europa, a moon of Jupiter, has a salty ocean hidden under its ice.'],
  ['ganymede', 'Ganymede', 'Ganymede, a moon of Jupiter, is the biggest moon in the solar system.'],
  ['callisto', 'Callisto', 'Callisto, a moon of Jupiter, is covered in craters.'],
  ['saturn', 'Saturn', 'Saturn’s rings are made of chunks of ice and rock.'],
  ['titan', 'Titan', 'Titan, a moon of Saturn, has lakes of liquid methane.'],
  ['enceladus', 'Enceladus', 'Enceladus, a moon of Saturn, shoots jets of water into space.'],
  ['mimas', 'Mimas', 'Mimas, a moon of Saturn, has one giant crater called Herschel.'],
  ['rhea', 'Rhea', 'Rhea is the second-biggest moon of Saturn.'],
  ['iapetus', 'Iapetus', 'Iapetus, a moon of Saturn, is dark on one side and bright on the other.'],
  ['uranus', 'Uranus', 'Uranus spins on its side, like a rolling ball.'],
  ['miranda', 'Miranda', 'Miranda, a moon of Uranus, has cliffs about 20 km high.'],
  ['titania', 'Titania', 'Titania is the biggest moon of Uranus.'],
  ['neptune', 'Neptune', 'Neptune has the fastest winds in the solar system.'],
  ['triton', 'Triton', 'Triton, the biggest moon of Neptune, goes around it backwards.'],
  ['pluto', 'Pluto', 'Pluto is a dwarf planet with a big heart-shaped plain of ice.'],
  ['charon', 'Charon', 'Charon, the biggest moon of Pluto, is about half as wide as Pluto.'],
];

const COUNTRIES = [
  ['japan', 'Japan', 'Japan is made of thousands of islands. Mount Fuji is its tallest mountain.'],
  ['france', 'France', 'The Eiffel Tower in Paris was built in 1889.'],
  ['italy', 'Italy', 'Pizza as we know it comes from Naples, a city in Italy.'],
  ['germany', 'Germany', 'Germany is famous for its forests, like the Black Forest.'],
  ['ireland', 'Ireland', 'Ireland is called the Emerald Isle because it is so green.'],
  ['belgium', 'Belgium', 'Belgium is famous for its chocolate and waffles.'],
  ['netherlands', 'Netherlands', 'The Netherlands has more bicycles than people.'],
  ['austria', 'Austria', 'Mozart, a famous composer, was born in Salzburg, Austria.'],
  ['poland', 'Poland', 'Marie Curie, who won two Nobel Prizes, was born in Warsaw, Poland.'],
  ['ukraine', 'Ukraine', 'Ukraine grows huge fields of sunflowers.'],
  ['sweden', 'Sweden', 'Sweden has a hotel made of ice that is built again every winter.'],
  ['norway', 'Norway', 'In the north of Norway, the sun does not set for weeks in summer.'],
  ['denmark', 'Denmark', 'LEGO toy bricks were invented in Denmark.'],
  ['finland', 'Finland', 'Finland has about 188,000 lakes.'],
  ['switzerland', 'Switzerland', 'Switzerland has four official languages.'],
  ['greece', 'Greece', 'The first Olympic Games were held in ancient Greece.'],
  ['bangladesh', 'Bangladesh', 'Bengal tigers live in the Sundarbans, a mangrove forest in Bangladesh.'],
  ['nigeria', 'Nigeria', 'Nigeria has more people than any other country in Africa.'],
  ['colombia', 'Colombia', 'Colombia has more kinds of birds than almost any other country.'],
  ['indonesia', 'Indonesia', 'Indonesia is made of more than 17,000 islands.'],
  ['thailand', 'Thailand', 'The full name of Bangkok, Thailand’s capital, is one of the longest city names in the world.'],
  ['estonia', 'Estonia', 'About half of Estonia is covered by forest.'],
  ['hungary', 'Hungary', 'The Rubik’s Cube was invented in Hungary.'],
  ['lithuania', 'Lithuania', 'Lithuania has a Hill of Crosses with more than 100,000 crosses.'],
  ['chile', 'Chile', 'Chile is very long and thin: more than 4,000 km from north to south.'],
  ['vietnam', 'Vietnam', 'Vietnam has Son Doong, one of the biggest caves in the world.'],
  ['turkiye', 'Türkiye', 'Istanbul, a city in Türkiye, is on two continents: Europe and Asia.'],
  ['china', 'China', 'The Great Wall of China is thousands of kilometers long.'],
  ['india', 'India', 'India has more people than any other country.'],
  ['usa', 'United States', 'The United States has 50 states, one for each star on its flag.'],
  ['uk', 'United Kingdom', 'The United Kingdom is made of England, Scotland, Wales and Northern Ireland.'],
  ['brazil', 'Brazil', 'Most of the Amazon rainforest is in Brazil.'],
  ['argentina', 'Argentina', 'Argentina has Aconcagua, the tallest mountain in the Americas.'],
  ['jamaica', 'Jamaica', 'Jamaica is the home of reggae music.'],
  ['peru', 'Peru', 'Machu Picchu, an old Inca city, sits high in the mountains of Peru.'],
];

function slug(name) {
  return name.replace(/\s+/g, '-');
}

function capitalize(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Every item: { key, name, fact?, image? , flag? }
export const THEME_INFO = {
  animals: {
    label: 'Animals',
    items: ANIMALS.map((name) => ({ key: slug(name), name: capitalize(name), image: `art/animals/${slug(name)}.webp` })),
  },
  space: {
    label: 'Space',
    items: SPACE.map(([key, name, fact]) => ({ key, name, fact, image: `art/space/${key}.webp` })),
  },
  countries: {
    label: 'Countries',
    items: COUNTRIES.map(([key, name, fact]) => ({ key, name, fact, flag: FLAGS[key] })),
  },
  photos: {
    label: 'My photos',
    items: [],
  },
};
