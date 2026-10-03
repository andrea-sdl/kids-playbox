// Tilt steering: hold the phone like a steering wheel. Uses the device
// orientation sensor; iPhones ask for permission first, and it has to be
// asked from a tap.

const DEAD_ZONE = 2.5;
const FULL_LOCK = 24;

// How far the phone is turned like a wheel, in degrees (right is positive),
// from the sensor's beta and gamma and the screen's rotation. Held upright,
// a sideways tilt is gamma; on its side, the wheel-like turn shows up in
// beta, with the sign depending on which way the phone was turned.
export function wheelAngle({ beta, gamma }, screenAngle) {
  const angle = ((screenAngle % 360) + 360) % 360;
  if (angle === 90) {
    return beta;
  }
  if (angle === 270) {
    return -beta;
  }
  if (angle === 180) {
    return -gamma;
  }
  return gamma;
}

// Steering from -1 (full left) to 1 (full right), measured from where the
// phone was when the drive started, with a little dead zone in the middle.
export function steerFromTilt(angle, center) {
  const offset = angle - center;
  if (Math.abs(offset) < DEAD_ZONE) {
    return 0;
  }
  const amount = (Math.abs(offset) - DEAD_ZONE) / (FULL_LOCK - DEAD_ZONE);
  return Math.sign(offset) * Math.min(1, amount);
}

function screenAngle() {
  if (screen.orientation && typeof screen.orientation.angle === 'number') {
    return screen.orientation.angle;
  }
  return Number(window.orientation) || 0;
}

export function tiltAvailable() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && window.matchMedia('(pointer: coarse)').matches;
}

export function createTilt() {
  let listening = false;
  let latest = null;
  let center = 0;

  function onOrientation(event) {
    if (event.beta === null || event.gamma === null) {
      return;
    }
    latest = wheelAngle(event, screenAngle());
  }

  function listen() {
    if (listening) {
      return;
    }
    listening = true;
    window.addEventListener('deviceorientation', onOrientation);
  }

  return {
    // Call from a tap. Resolves true when the sensor can be used.
    async enable() {
      const Orientation = window.DeviceOrientationEvent;
      if (Orientation && typeof Orientation.requestPermission === 'function') {
        try {
          const answer = await Orientation.requestPermission();
          if (answer !== 'granted') {
            return false;
          }
        } catch {
          return false;
        }
      }
      listen();
      return true;
    },
    disable() {
      listening = false;
      latest = null;
      window.removeEventListener('deviceorientation', onOrientation);
    },
    // Wherever the phone is now counts as straight ahead.
    recenter() {
      if (latest !== null) {
        center = latest;
      }
    },
    get ready() {
      return latest !== null;
    },
    steer() {
      if (latest === null) {
        return 0;
      }
      return steerFromTilt(latest, center);
    },
  };
}
