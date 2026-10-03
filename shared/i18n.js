// Translations. Each page adds its own texts with addStrings(); shared
// texts (home page, game titles, common buttons) live at the bottom here.
//
// Texts can use {placeholders}. A text with { one, other } picks the right
// form for vars.count. Missing texts fall back to English.

import { readJSON, writeJSON } from './store.js';

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italiano' },
  { code: 'es', name: 'Español' },
  { code: 'pt-BR', name: 'Português (BR)' },
  { code: 'de', name: 'Deutsch' },
];

const CODES = LANGUAGES.map((language) => language.code);
const dictionaries = Object.fromEntries(CODES.map((code) => [code, {}]));

// Match a browser language like "pt-PT" or "de-CH" to one we have.
export function matchLanguage(requested) {
  if (typeof requested !== 'string') {
    return null;
  }
  const exact = CODES.find((code) => code.toLowerCase() === requested.toLowerCase());
  if (exact) {
    return exact;
  }
  const base = requested.split('-')[0].toLowerCase();
  return CODES.find((code) => code.split('-')[0] === base) || null;
}

function detectLanguage() {
  const saved = matchLanguage(readJSON('lang', null));
  if (saved) {
    return saved;
  }
  const preferred = globalThis.navigator?.languages || [globalThis.navigator?.language];
  for (const requested of preferred) {
    const match = matchLanguage(requested);
    if (match) {
      return match;
    }
  }
  return 'en';
}

let current = detectLanguage();

export function getLanguage() {
  return current;
}

export function setLanguage(code) {
  const match = matchLanguage(code);
  if (!match) {
    return;
  }
  current = match;
  writeJSON('lang', match);
}

// { en: { key: text }, it: { ... }, ... }
export function addStrings(byLanguage) {
  Object.entries(byLanguage).forEach(([code, strings]) => {
    Object.assign(dictionaries[code], strings);
  });
}

function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    if (vars[name] === undefined) {
      return match;
    }
    return String(vars[name]);
  });
}

export function t(key, vars = {}) {
  let entry = dictionaries[current][key];
  if (entry === undefined) {
    entry = dictionaries.en[key];
  }
  if (entry === undefined) {
    return key;
  }
  if (typeof entry === 'object') {
    const form = new Intl.PluralRules(current).select(Number(vars.count));
    entry = entry[form] ?? entry.other;
  }
  return fill(entry, vars);
}

// Fill in static page text:
//   data-i18n="key"               → text content
//   data-i18n-html="key"          → HTML (only for our own trusted texts)
//   data-i18n-attr="aria-label:key title:key"
export function translatePage(root = document) {
  document.documentElement.lang = current;
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((element) => {
    element.innerHTML = t(element.dataset.i18nHtml);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((element) => {
    element.dataset.i18nAttr.split(/\s+/).forEach((pair) => {
      const [attribute, key] = pair.split(':');
      element.setAttribute(attribute, t(key));
    });
  });
}

const GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

// A language menu in every element with class "lang-slot". Changing it
// reloads the page in the new language.
export function mountLanguagePicker() {
  document.querySelectorAll('.lang-slot').forEach((slot) => {
    const label = document.createElement('label');
    label.className = 'lang-picker';
    label.innerHTML = `${GLOBE}<span class="visually-hidden"></span><select></select>`;
    label.querySelector('span').textContent = t('common.language');
    const select = label.querySelector('select');
    LANGUAGES.forEach((language) => {
      const option = document.createElement('option');
      option.value = language.code;
      option.textContent = language.name;
      option.lang = language.code;
      option.selected = language.code === current;
      select.append(option);
    });
    select.addEventListener('change', () => {
      setLanguage(select.value);
      location.reload();
    });
    slot.replaceChildren(label);
  });
}

/* ---------- Shared texts ---------- */

addStrings({
  en: {
    'common.language': 'Language',
    'common.back': 'Back to all games',
    'common.allGames': 'All games',
    'common.footer': 'Brought to you by Andrea Grassi,',
    'common.soundOn': 'Sound is on. Turn sound off',
    'common.soundOff': 'Sound is off. Turn sound on',
    'common.sound': 'Sound',
    'common.clear': 'Clear',
    'common.tapAgain': 'Tap again to clear',
    'common.zoomIn': 'Zoom in',
    'common.zoomOut': 'Zoom out',
    'common.favoriteAdd': 'Add {title} to favorites',
    'common.favoriteRemove': 'Remove {title} from favorites',
    'home.hello': 'Pick a game. Tap the <span class="inline-star" aria-hidden="true">★</span> to keep your best ones at the top.',
    'home.showGames': 'Show games',
    'home.all': 'All games',
    'home.favorites': '★ Favorites',
    'home.noFavorites': 'No favorites yet. Tap a star to add one!',
    'home.comingSoon': 'More games coming soon!',
    'home.notPlayed': 'Not played yet',
    'home.played': { one: 'Played {count} time', other: 'Played {count} times' },
    'home.worksOffline': '✓ Works offline',
    'home.allOffline': 'All games work offline.',
    'home.someOffline': '{saved} of {total} games work offline. Games are saved when you open them.',
    'home.saveAll': 'Save all games for offline',
    'home.saving': 'Saving…',
    'home.saveFailed': 'Could not save right now. Try again when you are online.',
    'home.someFailed': 'Some games could not be saved. Try again when you are online.',
    'game.dice.title': 'Dice Thrower',
    'game.dice.blurb': 'Pick a buddy and roll the dice!',
    'game.memory.title': 'Memory',
    'game.memory.blurb': 'Flip the cards and find the pairs!',
    'game.blocks.title': 'Blocks',
    'game.blocks.blurb': 'Build anything you like in 3D!',
    'game.molecules.title': 'Molecules',
    'game.molecules.blurb': 'Join atoms to build real molecules!',
    'game.drive.title': 'Turbo Drive',
    'game.drive.blurb': 'Race through the city, the jungle and the wasteland!',
    'progress.dice': 'Last roll: {total}',
    'progress.memory': 'Won {size}×{size} in {moves} moves',
    'progress.blocks': 'Building',
    'progress.molecules': { one: 'Built {count} molecule', other: 'Built {count} molecules' },
    'progress.drive': { one: 'Collected {count} point in {time}', other: 'Collected {count} points in {time}' },
  },
  it: {
    'common.language': 'Lingua',
    'common.back': 'Torna a tutti i giochi',
    'common.allGames': 'Tutti i giochi',
    'common.footer': 'Offerto da Andrea Grassi,',
    'common.soundOn': 'Suoni attivi. Spegni i suoni',
    'common.soundOff': 'Suoni spenti. Accendi i suoni',
    'common.sound': 'Suoni',
    'common.clear': 'Cancella',
    'common.tapAgain': 'Tocca ancora per cancellare',
    'common.zoomIn': 'Ingrandisci',
    'common.zoomOut': 'Rimpicciolisci',
    'common.favoriteAdd': 'Aggiungi {title} ai preferiti',
    'common.favoriteRemove': 'Togli {title} dai preferiti',
    'home.hello': 'Scegli un gioco. Tocca la <span class="inline-star" aria-hidden="true">★</span> per tenere i tuoi preferiti in cima.',
    'home.showGames': 'Mostra giochi',
    'home.all': 'Tutti i giochi',
    'home.favorites': '★ Preferiti',
    'home.noFavorites': 'Ancora nessun preferito. Tocca una stella per aggiungerne uno!',
    'home.comingSoon': 'Altri giochi in arrivo!',
    'home.notPlayed': 'Non ancora giocato',
    'home.played': { one: 'Giocato {count} volta', other: 'Giocato {count} volte' },
    'home.worksOffline': '✓ Funziona offline',
    'home.allOffline': 'Tutti i giochi funzionano offline.',
    'home.someOffline': '{saved} giochi su {total} funzionano offline. I giochi si salvano quando li apri.',
    'home.saveAll': 'Salva tutti i giochi per l’uso offline',
    'home.saving': 'Salvataggio…',
    'home.saveFailed': 'Non riesco a salvare adesso. Riprova quando sei online.',
    'home.someFailed': 'Alcuni giochi non sono stati salvati. Riprova quando sei online.',
    'game.dice.title': 'Lancia i dadi',
    'game.dice.blurb': 'Scegli un amico e lancia i dadi!',
    'game.memory.title': 'Memory',
    'game.memory.blurb': 'Gira le carte e trova le coppie!',
    'game.blocks.title': 'Mattoncini',
    'game.blocks.blurb': 'Costruisci quello che vuoi in 3D!',
    'game.molecules.title': 'Molecole',
    'game.molecules.blurb': 'Unisci gli atomi e costruisci vere molecole!',
    'game.drive.title': 'Turbo Drive',
    'game.drive.blurb': 'Sfreccia in città, nella giungla e nelle terre desolate!',
    'progress.dice': 'Ultimo lancio: {total}',
    'progress.memory': 'Vinto {size}×{size} in {moves} mosse',
    'progress.blocks': 'Costruzione in corso',
    'progress.molecules': { one: '{count} molecola costruita', other: '{count} molecole costruite' },
    'progress.drive': { one: '{count} punto raccolto in {time}', other: '{count} punti raccolti in {time}' },
  },
  es: {
    'common.language': 'Idioma',
    'common.back': 'Volver a todos los juegos',
    'common.allGames': 'Todos los juegos',
    'common.footer': 'Hecho por Andrea Grassi,',
    'common.soundOn': 'Sonido activado. Quitar el sonido',
    'common.soundOff': 'Sonido desactivado. Poner el sonido',
    'common.sound': 'Sonido',
    'common.clear': 'Borrar',
    'common.tapAgain': 'Toca otra vez para borrar',
    'common.zoomIn': 'Acercar',
    'common.zoomOut': 'Alejar',
    'common.favoriteAdd': 'Añadir {title} a favoritos',
    'common.favoriteRemove': 'Quitar {title} de favoritos',
    'home.hello': 'Elige un juego. Toca la <span class="inline-star" aria-hidden="true">★</span> para dejar tus favoritos arriba.',
    'home.showGames': 'Mostrar juegos',
    'home.all': 'Todos los juegos',
    'home.favorites': '★ Favoritos',
    'home.noFavorites': 'Aún no hay favoritos. ¡Toca una estrella para añadir uno!',
    'home.comingSoon': '¡Pronto habrá más juegos!',
    'home.notPlayed': 'Aún no jugado',
    'home.played': { one: 'Jugado {count} vez', other: 'Jugado {count} veces' },
    'home.worksOffline': '✓ Funciona sin conexión',
    'home.allOffline': 'Todos los juegos funcionan sin conexión.',
    'home.someOffline': '{saved} de {total} juegos funcionan sin conexión. Los juegos se guardan al abrirlos.',
    'home.saveAll': 'Guardar todos los juegos para usar sin conexión',
    'home.saving': 'Guardando…',
    'home.saveFailed': 'No se pudo guardar ahora. Inténtalo cuando tengas conexión.',
    'home.someFailed': 'Algunos juegos no se guardaron. Inténtalo cuando tengas conexión.',
    'game.dice.title': 'Lanzadados',
    'game.dice.blurb': '¡Elige un amigo y lanza los dados!',
    'game.memory.title': 'Memoria',
    'game.memory.blurb': '¡Da la vuelta a las cartas y encuentra las parejas!',
    'game.blocks.title': 'Bloques',
    'game.blocks.blurb': '¡Construye lo que quieras en 3D!',
    'game.molecules.title': 'Moléculas',
    'game.molecules.blurb': '¡Une átomos y construye moléculas de verdad!',
    'game.drive.title': 'Turbo Drive',
    'game.drive.blurb': '¡Corre por la ciudad, la selva y la tierra baldía!',
    'progress.dice': 'Última tirada: {total}',
    'progress.memory': 'Ganado {size}×{size} en {moves} movimientos',
    'progress.blocks': 'Construyendo',
    'progress.molecules': { one: '{count} molécula construida', other: '{count} moléculas construidas' },
    'progress.drive': { one: '{count} punto recogido en {time}', other: '{count} puntos recogidos en {time}' },
  },
  'pt-BR': {
    'common.language': 'Idioma',
    'common.back': 'Voltar para todos os jogos',
    'common.allGames': 'Todos os jogos',
    'common.footer': 'Feito por Andrea Grassi,',
    'common.soundOn': 'Som ligado. Desligar o som',
    'common.soundOff': 'Som desligado. Ligar o som',
    'common.sound': 'Som',
    'common.clear': 'Limpar',
    'common.tapAgain': 'Toque de novo para limpar',
    'common.zoomIn': 'Aproximar',
    'common.zoomOut': 'Afastar',
    'common.favoriteAdd': 'Adicionar {title} aos favoritos',
    'common.favoriteRemove': 'Tirar {title} dos favoritos',
    'home.hello': 'Escolha um jogo. Toque na <span class="inline-star" aria-hidden="true">★</span> para deixar seus favoritos no topo.',
    'home.showGames': 'Mostrar jogos',
    'home.all': 'Todos os jogos',
    'home.favorites': '★ Favoritos',
    'home.noFavorites': 'Nenhum favorito ainda. Toque em uma estrela para adicionar!',
    'home.comingSoon': 'Mais jogos em breve!',
    'home.notPlayed': 'Ainda não jogado',
    'home.played': { one: 'Jogado {count} vez', other: 'Jogado {count} vezes' },
    'home.worksOffline': '✓ Funciona offline',
    'home.allOffline': 'Todos os jogos funcionam offline.',
    'home.someOffline': '{saved} de {total} jogos funcionam offline. Os jogos são salvos quando você os abre.',
    'home.saveAll': 'Salvar todos os jogos para usar offline',
    'home.saving': 'Salvando…',
    'home.saveFailed': 'Não deu para salvar agora. Tente de novo quando estiver online.',
    'home.someFailed': 'Alguns jogos não foram salvos. Tente de novo quando estiver online.',
    'game.dice.title': 'Lança Dados',
    'game.dice.blurb': 'Escolha um amigo e jogue os dados!',
    'game.memory.title': 'Jogo da Memória',
    'game.memory.blurb': 'Vire as cartas e encontre os pares!',
    'game.blocks.title': 'Blocos',
    'game.blocks.blurb': 'Construa o que quiser em 3D!',
    'game.molecules.title': 'Moléculas',
    'game.molecules.blurb': 'Ligue átomos e monte moléculas de verdade!',
    'game.drive.title': 'Turbo Drive',
    'game.drive.blurb': 'Acelere pela cidade, pela selva e pela terra devastada!',
    'progress.dice': 'Última jogada: {total}',
    'progress.memory': 'Venceu {size}×{size} em {moves} jogadas',
    'progress.blocks': 'Construindo',
    'progress.molecules': { one: '{count} molécula montada', other: '{count} moléculas montadas' },
    'progress.drive': { one: '{count} ponto coletado em {time}', other: '{count} pontos coletados em {time}' },
  },
  de: {
    'common.language': 'Sprache',
    'common.back': 'Zurück zu allen Spielen',
    'common.allGames': 'Alle Spiele',
    'common.footer': 'Gemacht von Andrea Grassi,',
    'common.soundOn': 'Ton ist an. Ton ausschalten',
    'common.soundOff': 'Ton ist aus. Ton einschalten',
    'common.sound': 'Ton',
    'common.clear': 'Löschen',
    'common.tapAgain': 'Nochmal tippen zum Löschen',
    'common.zoomIn': 'Vergrößern',
    'common.zoomOut': 'Verkleinern',
    'common.favoriteAdd': '{title} zu den Favoriten hinzufügen',
    'common.favoriteRemove': '{title} aus den Favoriten entfernen',
    'home.hello': 'Such dir ein Spiel aus. Tippe auf den <span class="inline-star" aria-hidden="true">★</span>, damit deine Lieblingsspiele oben stehen.',
    'home.showGames': 'Spiele zeigen',
    'home.all': 'Alle Spiele',
    'home.favorites': '★ Favoriten',
    'home.noFavorites': 'Noch keine Favoriten. Tippe auf einen Stern!',
    'home.comingSoon': 'Bald gibt es mehr Spiele!',
    'home.notPlayed': 'Noch nicht gespielt',
    'home.played': { one: '{count}-mal gespielt', other: '{count}-mal gespielt' },
    'home.worksOffline': '✓ Geht auch offline',
    'home.allOffline': 'Alle Spiele gehen auch offline.',
    'home.someOffline': '{saved} von {total} Spielen gehen offline. Spiele werden gespeichert, wenn du sie öffnest.',
    'home.saveAll': 'Alle Spiele für offline speichern',
    'home.saving': 'Wird gespeichert…',
    'home.saveFailed': 'Speichern geht gerade nicht. Versuch es nochmal, wenn du online bist.',
    'home.someFailed': 'Einige Spiele wurden nicht gespeichert. Versuch es nochmal, wenn du online bist.',
    'game.dice.title': 'Würfelwerfer',
    'game.dice.blurb': 'Such dir einen Freund aus und würfle!',
    'game.memory.title': 'Memo-Spiel',
    'game.memory.blurb': 'Dreh die Karten um und finde die Paare!',
    'game.blocks.title': 'Bausteine',
    'game.blocks.blurb': 'Bau in 3D, was du willst!',
    'game.molecules.title': 'Moleküle',
    'game.molecules.blurb': 'Verbinde Atome zu echten Molekülen!',
    'game.drive.title': 'Turbo Drive',
    'game.drive.blurb': 'Rase durch die Stadt, den Dschungel und das Ödland!',
    'progress.dice': 'Letzter Wurf: {total}',
    'progress.memory': '{size}×{size} in {moves} Zügen geschafft',
    'progress.blocks': 'Am Bauen',
    'progress.molecules': { one: '{count} Molekül gebaut', other: '{count} Moleküle gebaut' },
    'progress.drive': { one: '{count} Punkt in {time} gesammelt', other: '{count} Punkte in {time} gesammelt' },
  },
});

/* ---------- What's new, badges and the update notice ---------- */

addStrings({
  en: {
    'whatsNew.button': '✨ What’s new',
    'whatsNew.title': 'What’s new',
    'whatsNew.version': 'Version {version}',
    'whatsNew.close': 'Close',
    'whatsNew.type.new': 'New',
    'whatsNew.type.updated': 'Updated',
    'whatsNew.type.fixed': 'Fixed',
    'badge.new': 'New!',
    'badge.updated': 'Updated',
    'update.ready': 'Playbox has an update.',
    'update.refresh': 'Refresh',
    'update.later': 'Later',
    'common.fullscreen': 'Full screen',
    'common.exitFullscreen': 'Exit full screen',
    'changes.v6.fullscreen': 'Every game has a full-screen button, to use the whole phone or tablet screen.',
    'changes.v12.installedTop': 'When Playbox is added to the iPhone Home Screen, the top of the screen no longer looks blurry.',
    'changes.v13.molecules': 'A brand-new game! Join atoms to build molecules, from water to benzene. Easy mode shows the picture; hard mode only the name.',
    'changes.v14.drive': 'A brand-new game! Drive shiny supercars through a neon city, a jungle and a snowy wasteland that turns into desert, and collect all the points. Harder levels put them at the edges and in the bends.',
    'changes.v15.driveLooks': 'Turbo Drive looks like a console game now: sharper textures, real shadows, glowing neon and lights, a sky with sun, clouds and stars, shiny cars that reflect it, and smoke, dust, snow and sparks from the wheels.',
    'changes.v16.fastUpdate': 'After an update, games open right away again, instead of waiting until every saved game has downloaded. Games that got new files stay saved for offline, too.',
    'changes.v16.driveMusic': 'Every track has its own music (with a button to turn it off), the engine is quieter, and the pads moved: steering at the edges, with brake and nitro in the middle on a tall screen, or next to the steering on a wide one.',
    'changes.v17.steerYourself': 'No more self-steering: the car only turns when you steer, so staying on the road is up to you.',
    'changes.v17.rotate': 'Turning the phone in the installed app no longer leaves part of the screen under the notch, and in landscape everything stays clear of it.',
    'changes.v18.trackBuilder': 'Build your own tracks! Add straights and curves, pick the city, jungle or wasteland, and drive them. The end joins back to the start by itself, tracks can be as long as you like, and you can share them as a file or a code.',
    'changes.v18.barriers': 'Barriers no longer turn the car along the road: scraping one slows you to a crawl until you steer away.',
    'changes.v11.versionSpace': 'More space above the version number at the bottom of the page.',
    'changes.v10.iosTop': 'On iPhone, nothing slides under the clock anymore, so the top of the screen stays clear.',
    'changes.v10.footer': 'More room at the bottom of the page, so the version number isn’t hidden.',
    'changes.v10.firefox': 'Rounded corners on the 3D view in Firefox.',
    'changes.v9.iosBlur': 'On iPhone, full screen keeps the game from sliding under the blurry area behind the clock.',
    'changes.v8.version': 'The bottom of every page shows the version number, so you can tell if you have the latest.',
    'changes.v7.focus': 'Full screen now uses the whole screen: the top bar goes away and its buttons move into the game.',
    'changes.v7.blocksPhones': 'Fits phones better: one palette at a time, a small time-of-day button, and tools on the side when the phone is sideways.',
    'changes.v6.whatsNew': '“What’s new” shows which games were added or updated.',
    'changes.v6.updateNotice': 'Playbox tells you when an update is ready.',
    'changes.v5.languages': 'Playbox now speaks English, Italian, Spanish, Brazilian Portuguese and German.',
    'changes.v4.memory': 'A brand-new game! Flip cards with animals, planets, flags or your own photos.',
    'changes.v4.blocks': 'A brand-new game! Build anything in 3D, from sunrise to a starry night.',
    'changes.v4.offline': 'Faster first visit. Games are saved for offline use when you open them.',
    'changes.v4.mageDice': 'The witch’s and wizard’s dice are 3D again.',
    'changes.v3.looks': 'Every buddy has a second look, each with its own scene: Prince, Cowgirl, Adventurer and Pixel Girl.',
    'changes.v3.mage': 'A new buddy: the Witch, or the Wizard.',
    'changes.v2.music': 'Every buddy has its own music, with a button to turn it off.',
    'changes.v1.dice': 'The very first game, with four buddies to throw the dice.',
  },
  it: {
    'whatsNew.button': '✨ Novità',
    'whatsNew.title': 'Novità',
    'whatsNew.version': 'Versione {version}',
    'whatsNew.close': 'Chiudi',
    'whatsNew.type.new': 'Nuovo',
    'whatsNew.type.updated': 'Aggiornato',
    'whatsNew.type.fixed': 'Sistemato',
    'badge.new': 'Nuovo!',
    'badge.updated': 'Aggiornato',
    'update.ready': 'C’è un aggiornamento di Playbox.',
    'update.refresh': 'Aggiorna',
    'update.later': 'Dopo',
    'common.fullscreen': 'Schermo intero',
    'common.exitFullscreen': 'Esci dallo schermo intero',
    'changes.v6.fullscreen': 'Ogni gioco ha un pulsante per lo schermo intero, per usare tutto lo schermo di telefono o tablet.',
    'changes.v12.installedTop': 'Con Playbox aggiunto alla schermata Home dell’iPhone, la parte alta dello schermo non è più sfocata.',
    'changes.v13.molecules': 'Un gioco tutto nuovo! Unisci gli atomi per costruire molecole, dall’acqua al benzene. In modalità facile vedi il disegno, in quella difficile solo il nome.',
    'changes.v14.drive': 'Un gioco tutto nuovo! Guida supercar lucenti in una città al neon, nella giungla e in terre desolate innevate che diventano deserto, e raccogli tutti i punti. Nei livelli più difficili sono sui bordi e nelle curve.',
    'changes.v15.driveLooks': 'Turbo Drive ora sembra un gioco da console: texture più nitide, ombre vere, neon e luci che brillano, un cielo con sole, nuvole e stelle, auto lucide che lo riflettono, e fumo, polvere, neve e scintille dalle ruote.',
    'changes.v16.fastUpdate': 'Dopo un aggiornamento i giochi si aprono subito, senza aspettare che tutti i giochi salvati siano scaricati. Anche i giochi con file nuovi restano salvati per l’uso offline.',
    'changes.v16.driveMusic': 'Ogni pista ha la sua musica (con un pulsante per spegnerla), il motore è più silenzioso e i comandi si sono spostati: sterzo ai lati, con freno e nitro al centro sullo schermo verticale, o accanto allo sterzo su quello orizzontale.',
    'changes.v17.steerYourself': 'Niente più sterzo automatico: l’auto gira solo quando sterzi tu, quindi restare in strada dipende da te.',
    'changes.v17.rotate': 'Girando il telefono nell’app installata, parte dello schermo non resta più sotto la tacca, e in orizzontale tutto resta lontano da lì.',
    'changes.v18.trackBuilder': 'Costruisci le tue piste! Aggiungi rettilinei e curve, scegli città, giungla o terre desolate e guidaci sopra. La fine si ricollega da sola all’inizio, le piste possono essere lunghe quanto vuoi e puoi condividerle come file o codice.',
    'changes.v18.barriers': 'Le barriere non girano più l’auto lungo la strada: se ne strisci una rallenti tantissimo finché non sterzi via.',
    'changes.v11.versionSpace': 'Più spazio sopra il numero di versione in fondo alla pagina.',
    'changes.v10.iosTop': 'Su iPhone niente scivola più sotto l’orologio, così la parte alta dello schermo resta pulita.',
    'changes.v10.footer': 'Più spazio in fondo alla pagina, così il numero di versione non resta nascosto.',
    'changes.v10.firefox': 'Angoli arrotondati per la vista 3D su Firefox.',
    'changes.v9.iosBlur': 'Su iPhone, lo schermo intero non fa più scivolare il gioco sotto la zona sfocata dietro l’orologio.',
    'changes.v8.version': 'In fondo a ogni pagina c’è il numero di versione, così vedi se hai l’ultima.',
    'changes.v7.focus': 'Lo schermo intero ora usa tutto lo schermo: la barra in alto sparisce e i suoi pulsanti passano dentro il gioco.',
    'changes.v7.blocksPhones': 'Va meglio sui telefoni: una tavolozza alla volta, un pulsante piccolo per l’ora del giorno e gli strumenti di lato col telefono in orizzontale.',
    'changes.v6.whatsNew': '“Novità” mostra quali giochi sono stati aggiunti o aggiornati.',
    'changes.v6.updateNotice': 'Playbox ti avvisa quando c’è un aggiornamento.',
    'changes.v5.languages': 'Playbox ora parla inglese, italiano, spagnolo, portoghese brasiliano e tedesco.',
    'changes.v4.memory': 'Un gioco tutto nuovo! Gira le carte con animali, pianeti, bandiere o le tue foto.',
    'changes.v4.blocks': 'Un gioco tutto nuovo! Costruisci in 3D, dall’alba alla notte stellata.',
    'changes.v4.offline': 'Prima visita più veloce. I giochi si salvano per l’uso offline quando li apri.',
    'changes.v4.mageDice': 'I dadi della strega e del mago sono di nuovo in 3D.',
    'changes.v3.looks': 'Ogni amico ha un secondo aspetto, con la sua scena: Principe, Cowgirl, Avventuriera e Ragazza Pixel.',
    'changes.v3.mage': 'Un nuovo amico: la Strega, o il Mago.',
    'changes.v2.music': 'Ogni amico ha la sua musica, con un pulsante per spegnerla.',
    'changes.v1.dice': 'Il primissimo gioco, con quattro amici che lanciano i dadi.',
  },
  es: {
    'whatsNew.button': '✨ Novedades',
    'whatsNew.title': 'Novedades',
    'whatsNew.version': 'Versión {version}',
    'whatsNew.close': 'Cerrar',
    'whatsNew.type.new': 'Nuevo',
    'whatsNew.type.updated': 'Actualizado',
    'whatsNew.type.fixed': 'Arreglado',
    'badge.new': '¡Nuevo!',
    'badge.updated': 'Actualizado',
    'update.ready': 'Hay una actualización de Playbox.',
    'update.refresh': 'Actualizar',
    'update.later': 'Luego',
    'common.fullscreen': 'Pantalla completa',
    'common.exitFullscreen': 'Salir de pantalla completa',
    'changes.v6.fullscreen': 'Cada juego tiene un botón de pantalla completa, para usar toda la pantalla del teléfono o la tableta.',
    'changes.v12.installedTop': 'Con Playbox añadido a la pantalla de inicio del iPhone, la parte de arriba ya no se ve borrosa.',
    'changes.v13.molecules': '¡Un juego nuevo! Une átomos para construir moléculas, del agua al benceno. En modo fácil ves el dibujo; en modo difícil, solo el nombre.',
    'changes.v14.drive': '¡Un juego nuevo! Conduce superdeportivos brillantes por una ciudad neón, la selva y una tierra baldía nevada que se convierte en desierto, y recoge todos los puntos. En los niveles difíciles están en los bordes y en las curvas.',
    'changes.v15.driveLooks': 'Turbo Drive ahora parece un juego de consola: texturas más nítidas, sombras de verdad, neones y luces que brillan, un cielo con sol, nubes y estrellas, coches brillantes que lo reflejan, y humo, polvo, nieve y chispas en las ruedas.',
    'changes.v16.fastUpdate': 'Después de una actualización, los juegos se abren enseguida, sin esperar a que se descarguen todos los juegos guardados. Los juegos con archivos nuevos también siguen guardados para usar sin conexión.',
    'changes.v16.driveMusic': 'Cada pista tiene su propia música (con un botón para apagarla), el motor suena más bajo y los botones cambiaron: el volante en los bordes, con freno y nitro en el centro en pantalla vertical, o junto al volante en horizontal.',
    'changes.v17.steerYourself': 'Se acabó el volante automático: el coche solo gira cuando tú giras, así que seguir en la carretera depende de ti.',
    'changes.v17.rotate': 'Al girar el teléfono en la app instalada, ya no queda parte de la pantalla bajo la muesca, y en horizontal todo queda lejos de ella.',
    'changes.v18.trackBuilder': '¡Construye tus propias pistas! Añade rectas y curvas, elige la ciudad, la selva o la tierra baldía y conduce por ellas. El final se une solo con la salida, pueden ser tan largas como quieras y puedes compartirlas como archivo o código.',
    'changes.v18.barriers': 'Las barreras ya no giran el coche a lo largo de la carretera: si rozas una, vas muy despacio hasta que te apartes.',
    'changes.v11.versionSpace': 'Más espacio encima del número de versión al final de la página.',
    'changes.v10.iosTop': 'En iPhone ya nada se desliza bajo el reloj, así que la parte de arriba de la pantalla queda limpia.',
    'changes.v10.footer': 'Más espacio al final de la página, para que el número de versión no quede oculto.',
    'changes.v10.firefox': 'Esquinas redondeadas en la vista 3D en Firefox.',
    'changes.v9.iosBlur': 'En iPhone, la pantalla completa ya no deja que el juego se deslice bajo la zona borrosa detrás del reloj.',
    'changes.v8.version': 'Al final de cada página aparece el número de versión, para saber si tienes la última.',
    'changes.v7.focus': 'La pantalla completa ahora usa toda la pantalla: la barra de arriba desaparece y sus botones pasan al juego.',
    'changes.v7.blocksPhones': 'Se ve mejor en teléfonos: una paleta a la vez, un botón pequeño para la hora del día y las herramientas a un lado con el teléfono en horizontal.',
    'changes.v6.whatsNew': '“Novedades” muestra qué juegos se añadieron o actualizaron.',
    'changes.v6.updateNotice': 'Playbox te avisa cuando hay una actualización.',
    'changes.v5.languages': 'Playbox ahora habla inglés, italiano, español, portugués de Brasil y alemán.',
    'changes.v4.memory': '¡Un juego totalmente nuevo! Da la vuelta a cartas con animales, planetas, banderas o tus fotos.',
    'changes.v4.blocks': '¡Un juego totalmente nuevo! Construye en 3D, del amanecer a la noche estrellada.',
    'changes.v4.offline': 'Primera visita más rápida. Los juegos se guardan para usar sin conexión al abrirlos.',
    'changes.v4.mageDice': 'Los dados de la bruja y del mago vuelven a ser 3D.',
    'changes.v3.looks': 'Cada amigo tiene un segundo aspecto, con su propio escenario: Príncipe, Vaquera, Aventurera y Chica Píxel.',
    'changes.v3.mage': 'Un amigo nuevo: la Bruja, o el Mago.',
    'changes.v2.music': 'Cada amigo tiene su propia música, con un botón para apagarla.',
    'changes.v1.dice': 'El primer juego, con cuatro amigos que lanzan los dados.',
  },
  'pt-BR': {
    'whatsNew.button': '✨ Novidades',
    'whatsNew.title': 'Novidades',
    'whatsNew.version': 'Versão {version}',
    'whatsNew.close': 'Fechar',
    'whatsNew.type.new': 'Novo',
    'whatsNew.type.updated': 'Atualizado',
    'whatsNew.type.fixed': 'Corrigido',
    'badge.new': 'Novo!',
    'badge.updated': 'Atualizado',
    'update.ready': 'O Playbox tem uma atualização.',
    'update.refresh': 'Atualizar',
    'update.later': 'Depois',
    'common.fullscreen': 'Tela cheia',
    'common.exitFullscreen': 'Sair da tela cheia',
    'changes.v6.fullscreen': 'Cada jogo tem um botão de tela cheia, para usar a tela toda do celular ou tablet.',
    'changes.v12.installedTop': 'Com o Playbox na tela de início do iPhone, o topo da tela não fica mais borrado.',
    'changes.v13.molecules': 'Um jogo novinho! Ligue átomos para montar moléculas, da água ao benzeno. No modo fácil você vê o desenho; no difícil, só o nome.',
    'changes.v14.drive': 'Um jogo novinho! Dirija supercarros brilhantes por uma cidade neon, pela selva e por uma terra devastada com neve que vira deserto, e pegue todos os pontos. Nos níveis difíceis eles ficam nas beiradas e nas curvas.',
    'changes.v15.driveLooks': 'Turbo Drive agora parece jogo de console: texturas mais nítidas, sombras de verdade, neons e luzes que brilham, um céu com sol, nuvens e estrelas, carros brilhantes que refletem tudo, e fumaça, poeira, neve e faíscas nas rodas.',
    'changes.v16.fastUpdate': 'Depois de uma atualização, os jogos abrem na hora, sem esperar todos os jogos salvos baixarem. Jogos com arquivos novos também continuam salvos para usar offline.',
    'changes.v16.driveMusic': 'Cada pista tem sua própria música (com um botão para desligar), o motor ficou mais baixo e os botões mudaram: direção nas bordas, com freio e nitro no meio na tela em pé, ou ao lado da direção na tela deitada.',
    'changes.v17.steerYourself': 'Chega de direção automática: o carro só vira quando você vira, então ficar na pista depende de você.',
    'changes.v17.rotate': 'Ao girar o celular no app instalado, parte da tela não fica mais embaixo do entalhe, e na horizontal tudo fica longe dele.',
    'changes.v18.trackBuilder': 'Monte suas próprias pistas! Adicione retas e curvas, escolha a cidade, a selva ou a terra devastada e dirija nelas. O fim se liga sozinho ao começo, as pistas podem ser tão longas quanto você quiser e dá para compartilhar como arquivo ou código.',
    'changes.v18.barriers': 'As barreiras não viram mais o carro ao longo da pista: raspar numa deixa você bem devagar até você se afastar.',
    'changes.v11.versionSpace': 'Mais espaço acima do número da versão no fim da página.',
    'changes.v10.iosTop': 'No iPhone nada mais desliza para baixo do relógio, então o topo da tela fica limpo.',
    'changes.v10.footer': 'Mais espaço no fim da página, para o número da versão não ficar escondido.',
    'changes.v10.firefox': 'Cantos arredondados na visão 3D no Firefox.',
    'changes.v9.iosBlur': 'No iPhone, a tela cheia não deixa mais o jogo deslizar para baixo da área borrada atrás do relógio.',
    'changes.v8.version': 'O fim de cada página mostra o número da versão, para você saber se tem a mais nova.',
    'changes.v7.focus': 'A tela cheia agora usa a tela toda: a barra de cima some e os botões dela vão para dentro do jogo.',
    'changes.v7.blocksPhones': 'Fica melhor no celular: uma paleta por vez, um botão pequeno para a hora do dia e as ferramentas de lado com o celular deitado.',
    'changes.v6.whatsNew': '“Novidades” mostra quais jogos foram adicionados ou atualizados.',
    'changes.v6.updateNotice': 'O Playbox avisa quando há uma atualização.',
    'changes.v5.languages': 'O Playbox agora fala inglês, italiano, espanhol, português do Brasil e alemão.',
    'changes.v4.memory': 'Um jogo novinho! Vire cartas com animais, planetas, bandeiras ou suas fotos.',
    'changes.v4.blocks': 'Um jogo novinho! Construa em 3D, do nascer do sol a uma noite estrelada.',
    'changes.v4.offline': 'Primeira visita mais rápida. Os jogos são salvos para usar offline quando você os abre.',
    'changes.v4.mageDice': 'Os dados da bruxa e do mago voltaram a ser 3D.',
    'changes.v3.looks': 'Cada amigo tem um segundo visual, com seu próprio cenário: Príncipe, Vaqueira, Aventureira e Menina Pixel.',
    'changes.v3.mage': 'Um amigo novo: a Bruxa, ou o Mago.',
    'changes.v2.music': 'Cada amigo tem sua própria música, com um botão para desligar.',
    'changes.v1.dice': 'O primeiro jogo, com quatro amigos que jogam os dados.',
  },
  de: {
    'whatsNew.button': '✨ Neuigkeiten',
    'whatsNew.title': 'Neuigkeiten',
    'whatsNew.version': 'Version {version}',
    'whatsNew.close': 'Schließen',
    'whatsNew.type.new': 'Neu',
    'whatsNew.type.updated': 'Aktualisiert',
    'whatsNew.type.fixed': 'Behoben',
    'badge.new': 'Neu!',
    'badge.updated': 'Aktualisiert',
    'update.ready': 'Für Playbox gibt es ein Update.',
    'update.refresh': 'Neu laden',
    'update.later': 'Später',
    'common.fullscreen': 'Vollbild',
    'common.exitFullscreen': 'Vollbild beenden',
    'changes.v6.fullscreen': 'Jedes Spiel hat einen Vollbild-Knopf, um den ganzen Bildschirm von Handy oder Tablet zu nutzen.',
    'changes.v12.installedTop': 'Wenn Playbox auf dem iPhone-Home-Bildschirm liegt, ist der obere Bildschirmrand nicht mehr verschwommen.',
    'changes.v13.molecules': 'Ein ganz neues Spiel! Verbinde Atome zu Molekülen, von Wasser bis Benzol. Im leichten Modus siehst du das Bild, im schweren nur den Namen.',
    'changes.v14.drive': 'Ein ganz neues Spiel! Fahr glänzende Supersportwagen durch eine Neonstadt, den Dschungel und ein verschneites Ödland, das zur Wüste wird, und sammle alle Punkte. In schweren Stufen liegen sie am Rand und in den Kurven.',
    'changes.v15.driveLooks': 'Turbo Drive sieht jetzt wie ein Konsolenspiel aus: schärfere Texturen, echte Schatten, leuchtende Neonlichter, ein Himmel mit Sonne, Wolken und Sternen, glänzende Autos, die ihn spiegeln, und Rauch, Staub, Schnee und Funken an den Rädern.',
    'changes.v16.fastUpdate': 'Nach einem Update öffnen sich Spiele wieder sofort, statt zu warten, bis alle gespeicherten Spiele geladen sind. Spiele mit neuen Dateien bleiben auch offline gespeichert.',
    'changes.v16.driveMusic': 'Jede Strecke hat ihre eigene Musik (mit einem Knopf zum Ausschalten), der Motor ist leiser, und die Tasten sind umgezogen: Lenken am Rand, Bremse und Nitro in der Mitte bei hohem Bildschirm, oder neben dem Lenken bei breitem.',
    'changes.v17.steerYourself': 'Kein automatisches Lenken mehr: Das Auto fährt nur Kurven, wenn du lenkst, also liegt es an dir, auf der Straße zu bleiben.',
    'changes.v17.rotate': 'Wenn du das Handy in der installierten App drehst, bleibt kein Teil mehr unter der Kerbe, und im Querformat bleibt alles frei davon.',
    'changes.v18.trackBuilder': 'Bau deine eigenen Strecken! Füg Geraden und Kurven hinzu, wähl Stadt, Dschungel oder Ödland und fahr los. Das Ende verbindet sich von selbst mit dem Start, Strecken können so lang sein, wie du willst, und du kannst sie als Datei oder Code teilen.',
    'changes.v18.barriers': 'Die Absperrungen lenken das Auto nicht mehr an der Straße entlang: Wer daran schrammt, wird ganz langsam, bis er weglenkt.',
    'changes.v11.versionSpace': 'Mehr Platz über der Versionsnummer am Seitenende.',
    'changes.v10.iosTop': 'Auf dem iPhone rutscht nichts mehr unter die Uhr, der obere Rand bleibt sauber.',
    'changes.v10.footer': 'Mehr Platz am Seitenende, damit die Versionsnummer nicht verdeckt wird.',
    'changes.v10.firefox': 'Abgerundete Ecken der 3D-Ansicht in Firefox.',
    'changes.v9.iosBlur': 'Auf dem iPhone rutscht das Spiel im Vollbild nicht mehr unter den verschwommenen Bereich hinter der Uhr.',
    'changes.v8.version': 'Unten auf jeder Seite steht die Versionsnummer, damit du siehst, ob du die neueste hast.',
    'changes.v7.focus': 'Vollbild nutzt jetzt den ganzen Bildschirm: Die obere Leiste verschwindet und ihre Knöpfe wandern ins Spiel.',
    'changes.v7.blocksPhones': 'Passt besser aufs Handy: immer nur eine Palette, ein kleiner Knopf für die Tageszeit und die Werkzeuge an der Seite, wenn das Handy quer liegt.',
    'changes.v6.whatsNew': '„Neuigkeiten“ zeigt, welche Spiele neu sind oder aktualisiert wurden.',
    'changes.v6.updateNotice': 'Playbox sagt dir, wenn ein Update bereit ist.',
    'changes.v5.languages': 'Playbox spricht jetzt Englisch, Italienisch, Spanisch, brasilianisches Portugiesisch und Deutsch.',
    'changes.v4.memory': 'Ein ganz neues Spiel! Dreh Karten mit Tieren, Planeten, Flaggen oder deinen Fotos um.',
    'changes.v4.blocks': 'Ein ganz neues Spiel! Bau in 3D, vom Sonnenaufgang bis zur Sternennacht.',
    'changes.v4.offline': 'Schnellerer erster Besuch. Spiele werden fürs Offline-Spielen gespeichert, wenn du sie öffnest.',
    'changes.v4.mageDice': 'Die Würfel der Hexe und des Zauberers sind wieder 3D.',
    'changes.v3.looks': 'Jeder Freund hat ein zweites Aussehen mit eigener Kulisse: Prinz, Cowgirl, Abenteurerin und Pixel-Mädchen.',
    'changes.v3.mage': 'Ein neuer Freund: die Hexe oder der Zauberer.',
    'changes.v2.music': 'Jeder Freund hat seine eigene Musik, mit einem Knopf zum Ausschalten.',
    'changes.v1.dice': 'Das allererste Spiel, mit vier Freunden, die würfeln.',
  },
});

// For tests: every language's texts, merged.
export function allStrings() {
  return dictionaries;
}
