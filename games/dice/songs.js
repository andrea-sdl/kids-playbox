// Background tunes, one per mascot, written like a tiny MIDI score.
// All tunes are original.
//
// Each track is a string of steps separated by spaces ("|" marks bars and
// is ignored):
//   C5, F#4, Bb3  play a note (MIDI-style name and octave)
//   -             hold the previous note one more step
//   .             rest
// Drum tracks use one letter per step:
//   k kick  s snare  h hi-hat  x shaker  w/W high/low woodblock  t/T high/low tom
//
// Tracks loop on their own, so a one-bar drum pattern repeats under an
// eight-bar melody.

const NOTE_OFFSETS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const DRUMS = { k: 'kick', s: 'snare', h: 'hat', x: 'shaker', w: 'wood', W: 'woodLow', t: 'tom', T: 'tomLow' };

export function noteToMidi(name) {
  const match = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!match) {
    return null;
  }
  let midi = 12 * (Number(match[3]) + 1) + NOTE_OFFSETS[match[1]];
  if (match[2] === '#') {
    midi += 1;
  }
  if (match[2] === 'b') {
    midi -= 1;
  }
  return midi;
}

function tokens(pattern) {
  return pattern.split(/\s+/).filter((token) => token && token !== '|');
}

// Turns a note pattern into [{ step, midi, steps }].
export function parseNotes(pattern) {
  const events = [];
  tokens(pattern).forEach((token, step) => {
    if (token === '-') {
      const last = events[events.length - 1];
      if (last && last.step + last.steps === step) {
        last.steps += 1;
      }
      return;
    }
    if (token === '.') {
      return;
    }
    const midi = noteToMidi(token);
    if (midi === null) {
      throw new Error(`Unknown note "${token}" at step ${step}`);
    }
    events.push({ step, midi, steps: 1 });
  });
  return { events, length: tokens(pattern).length };
}

// Turns a drum pattern into [{ step, drum }].
export function parseDrums(pattern) {
  const events = [];
  tokens(pattern).forEach((token, step) => {
    if (token === '.') {
      return;
    }
    const drum = DRUMS[token];
    if (!drum) {
      throw new Error(`Unknown drum "${token}" at step ${step}`);
    }
    events.push({ step, drum });
  });
  return { events, length: tokens(pattern).length };
}

/* ---------------- Princess: music-box waltz in C major, 3/4 ---------------- */
// Steps are eighth notes: 6 per bar, 8 bars.

const princess = {
  bpm: 104,
  stepsPerBeat: 2,
  stepsPerBar: 6,
  tracks: [
    {
      instrument: 'musicbox',
      volume: 1,
      notes: `
        E5 - G5 - C6 - | B5 - A5 - E5 - | F5 - A5 - C6 - | B5 - - - D6 - |
        E6 - D6 - C6 - | A5 - C6 - E5 - | D5 - F5 - B5 - | C6 - - - - . `,
    },
    {
      instrument: 'harp',
      volume: 0.9,
      notes: `
        C3 - . . . . | A2 - . . . . | F2 - . . . . | G2 - . . . . |
        C3 - . . . . | A2 - . . . . | G2 - . . . . | C3 - . . . . `,
    },
    {
      instrument: 'harp',
      volume: 0.5,
      notes: `
        . . E4 . E4 . | . . C4 . C4 . | . . A3 . A3 . | . . B3 . B3 . |
        . . E4 . E4 . | . . C4 . C4 . | . . B3 . B3 . | . . E4 . E4 . `,
    },
    {
      instrument: 'harp',
      volume: 0.5,
      notes: `
        . . G4 . G4 . | . . E4 . E4 . | . . C4 . C4 . | . . D4 . D4 . |
        . . G4 . G4 . | . . E4 . E4 . | . . F4 . F4 . | . . G4 . G4 . `,
    },
  ],
};

/* ---------------- Cowboy: easy-going western shuffle in G major ---------------- */
// Steps are swung eighth notes: 8 per bar, 8 bars.

const cowboy = {
  bpm: 112,
  stepsPerBeat: 2,
  stepsPerBar: 8,
  swing: 0.64,
  tracks: [
    {
      instrument: 'whistle',
      volume: 1,
      notes: `
        D5 - - B4 D5 - G5 - | E5 - - - C5 - - . | D5 - B4 - G4 - B4 - | A4 - - - - - . . |
        D5 - - B4 D5 - G5 - | A5 - G5 - E5 - C5 - | D5 - F#5 - A5 - F#5 - | G5 - - - - - . . `,
    },
    {
      instrument: 'bass',
      volume: 1,
      notes: `
        G2 - . . D2 - . . | C2 - . . G2 - . . | G2 - . . D2 - . . | D2 - . . A2 - . . |
        G2 - . . D2 - . . | C2 - . . G2 - . . | D2 - . . A2 - . . | G2 - . . G2 - . . `,
    },
    {
      instrument: 'pluck',
      volume: 0.8,
      notes: `
        . . B3 . . . B3 . | . . E4 . . . E4 . | . . B3 . . . B3 . | . . A3 . . . A3 . |
        . . B3 . . . B3 . | . . E4 . . . E4 . | . . F#4 . . . F#4 . | . . B3 . . . B3 . `,
    },
    {
      instrument: 'pluck',
      volume: 0.8,
      notes: `
        . . D4 . . . D4 . | . . G4 . . . G4 . | . . D4 . . . D4 . | . . D4 . . . D4 . |
        . . D4 . . . D4 . | . . G4 . . . G4 . | . . A4 . . . A4 . | . . D4 . . . D4 . `,
    },
    { drums: 'w . W . w . W .', volume: 1 },
  ],
};

/* ---------------- Explorer: jungle adventure in D minor ---------------- */
// Steps are sixteenth notes: 16 per bar, 8 bars.

const arpeggios = `
  D4 . A4 . D5 . A4 . F4 . A4 . D5 . A4 . |
  C4 . G4 . C5 . G4 . E4 . G4 . C5 . G4 . |
  Bb3 . F4 . Bb4 . F4 . D4 . F4 . Bb4 . F4 . |
  A3 . E4 . A4 . E4 . C#4 . E4 . A4 . E4 . |`;

const explorer = {
  bpm: 96,
  stepsPerBeat: 4,
  stepsPerBar: 16,
  tracks: [
    {
      instrument: 'flute',
      volume: 1,
      notes: `
        D5 - - - - - F5 - E5 - - - D5 - - - | E5 - - - - - G5 - C5 - - - - - - - |
        D5 - - - F5 - - - Bb5 - - - A5 - G5 - | A5 - - - - - - - - - - - . . . . |
        A5 - - - G5 - F5 - E5 - - - D5 - - - | C5 - - - E5 - G5 - E5 - - - - - - - |
        F5 - - - E5 - D5 - Bb4 - - - D5 - - - | C#5 - - - E5 - - - A4 - - - - - . . `,
    },
    { instrument: 'marimba', volume: 0.8, notes: arpeggios + arpeggios },
    {
      instrument: 'bass',
      volume: 1,
      notes: `
        D2 - - - - - - - - - - - D2 - - - | C2 - - - - - - - - - - - C2 - - - |
        Bb1 - - - - - - - - - - - Bb1 - - - | A1 - - - - - - - - - - - A1 - - - | `,
    },
    { drums: 'T . . . t . . . T . T . t . . .', volume: 1 },
    { drums: 'x . x . x . x . x . x . x . x .', volume: 1 },
  ],
};

/* ---------------- Pixel Hero: bouncy chiptune in C major ---------------- */
// Steps are sixteenth notes: 16 per bar, 8 bars.

const pixelBass = `
  C2 . C3 . C2 . C3 . C2 . C3 . C2 . C3 . |
  A1 . A2 . A1 . A2 . A1 . A2 . A1 . A2 . |
  F1 . F2 . F1 . F2 . F1 . F2 . F1 . F2 . |
  G1 . G2 . G1 . G2 . G1 . G2 . G1 . G2 . |`;

const pixelArp = `
  C5 E5 G5 E5 C5 E5 G5 E5 C5 E5 G5 E5 C5 E5 G5 E5 |
  A4 C5 E5 C5 A4 C5 E5 C5 A4 C5 E5 C5 A4 C5 E5 C5 |
  F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 F4 A4 C5 A4 |
  G4 B4 D5 B4 G4 B4 D5 B4 G4 B4 D5 B4 G4 B4 D5 B4 |`;

const pixel = {
  bpm: 138,
  stepsPerBeat: 4,
  stepsPerBar: 16,
  tracks: [
    {
      instrument: 'pulse',
      volume: 1,
      notes: `
        E5 - G5 - C6 - - - G5 - E5 - G5 - - - | A5 - - - G5 - E5 - C5 - - - E5 - - - |
        F5 - A5 - C6 - A5 - F5 - - - A5 - C6 - | B5 - - - A5 - G5 - D5 - - - . . . . |
        C6 - . C6 B5 - C6 - G5 - - - E5 - - - | A5 - . A5 G5 - A5 - E5 - - - C5 - - - |
        F5 - G5 - A5 - C6 - D6 - C6 - A5 - - - | G5 - - - B5 - - - C6 - - - - - . . `,
    },
    { instrument: 'blip', volume: 0.5, notes: pixelArp },
    { instrument: 'tri', volume: 1, notes: pixelBass },
    { drums: 'k . h . s . h . k . k h s . h .', volume: 1 },
  ],
};

/* ---------------- Mage: mysterious celesta in A minor, 6/8 ---------------- */
// Steps are eighth notes: 6 per bar (two beats of three), 8 bars.

const mage = {
  bpm: 62,
  stepsPerBeat: 3,
  stepsPerBar: 6,
  tracks: [
    {
      instrument: 'celesta',
      volume: 1,
      notes: `
        A5 - C6 B5 - A5 | C6 - A5 F5 - A5 | D6 - F6 E6 - D6 | B5 - - G#5 - . |
        E6 - D6 C6 - B5 | A5 - C6 F6 - E6 | D6 - C6 B5 - G#5 | A5 - - - - . `,
    },
    {
      instrument: 'marimba',
      volume: 0.45,
      notes: `
        A3 C4 E4 A4 E4 C4 | F3 A3 C4 F4 C4 A3 | D3 F3 A3 D4 A3 F3 | E3 G#3 B3 E4 B3 G#3 |
        A3 C4 E4 A4 E4 C4 | F3 A3 C4 F4 C4 A3 | D3 F3 A3 E3 G#3 B3 | A3 C4 E4 A4 E4 C4 `,
    },
    {
      instrument: 'pizz',
      volume: 1,
      notes: `
        A2 . . E2 . . | F2 . . C3 . . | D2 . . A2 . . | E2 . . B2 . . |
        A2 . . E2 . . | F2 . . C3 . . | D2 . . E2 . . | A2 . . E2 . . `,
    },
    { drums: 'x . . x . .', volume: 0.8 },
  ],
};

export const SONGS = { princess, cowboy, explorer, pixel, mage };
