// Starts the game only if this browser can draw 3D.
import './strings.js';
import { startWith3D } from '../../shared/webgl.js';

startWith3D(() => import('./skate.js'));
