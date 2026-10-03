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
    'common.promise': 'No ads. No tracking: your games and scores stay on this device.',
    'common.openSource': 'Open source on GitHub',
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
    'common.promise': 'Niente pubblicità. Nessun tracciamento: giochi e punteggi restano su questo dispositivo.',
    'common.openSource': 'Open source su GitHub',
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
    'common.promise': 'Sin anuncios. Sin rastreo: tus juegos y puntuaciones se quedan en este dispositivo.',
    'common.openSource': 'Código abierto en GitHub',
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
    'common.promise': 'Sem anúncios. Sem rastreamento: seus jogos e pontuações ficam neste aparelho.',
    'common.openSource': 'Código aberto no GitHub',
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
    'common.promise': 'Keine Werbung. Kein Tracking: Deine Spiele und Punkte bleiben auf diesem Gerät.',
    'common.openSource': 'Open Source auf GitHub',
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
    'whatsNew.loading': 'Getting the notes…',
    'whatsNew.offline': 'Connect to the internet to read what’s new.',
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
  },
  it: {
    'whatsNew.button': '✨ Novità',
    'whatsNew.title': 'Novità',
    'whatsNew.version': 'Versione {version}',
    'whatsNew.close': 'Chiudi',
    'whatsNew.loading': 'Sto caricando le novità…',
    'whatsNew.offline': 'Collegati a internet per leggere le novità.',
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
  },
  es: {
    'whatsNew.button': '✨ Novedades',
    'whatsNew.title': 'Novedades',
    'whatsNew.version': 'Versión {version}',
    'whatsNew.close': 'Cerrar',
    'whatsNew.loading': 'Cargando las novedades…',
    'whatsNew.offline': 'Conéctate a internet para leer las novedades.',
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
  },
  'pt-BR': {
    'whatsNew.button': '✨ Novidades',
    'whatsNew.title': 'Novidades',
    'whatsNew.version': 'Versão {version}',
    'whatsNew.close': 'Fechar',
    'whatsNew.loading': 'Carregando as novidades…',
    'whatsNew.offline': 'Conecte-se à internet para ler as novidades.',
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
  },
  de: {
    'whatsNew.button': '✨ Neuigkeiten',
    'whatsNew.title': 'Neuigkeiten',
    'whatsNew.version': 'Version {version}',
    'whatsNew.close': 'Schließen',
    'whatsNew.loading': 'Neuigkeiten werden geladen…',
    'whatsNew.offline': 'Verbinde dich mit dem Internet, um die Neuigkeiten zu lesen.',
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
  },
});

// For tests: every language's texts, merged.
export function allStrings() {
  return dictionaries;
}
