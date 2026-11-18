import { THREE } from './model-kit.js';
import { road, pitch } from './world.js';

export const tileWidth = 28;
export const span = tileWidth * pitch;
export const startX = (room) => Math.max(0, road.indexOf(room)) * span;
export const worldX = (room, x) => startX(room) + x * tileWidth;
export const laneDepth = (y) => (y - 0.82) * 34;
const bridge = worldX('viaduct', 0.5);
const station = worldX('marsh', 0.47);

export function height(x, z) {
  // Far banks fall away below the skyline. The traveller stays on a level
  // tread across the bridge while the stream cuts through its stone arches.
  const far = Math.max(0, -z - 5);
  const ridge = (Math.sin(x * 0.23) + Math.cos(x * 0.097 + z * 0.15) * 0.8) * Math.min(far * 0.15, 1.5);
  const gorge = 1 - THREE.MathUtils.smoothstep(Math.abs(x - worldX('gorge', 0.5)), 10, 14);
  const channel = gorge * THREE.MathUtils.smoothstep(-z, 4.4, 6.2) * 1.6;
  const valley = Math.max(0, 1 - Math.pow(Math.abs(x - bridge) / 12.7, 4));
  const bank = -0.1 - far * 0.105 + ridge - valley * 6.2 - channel;
  const pool =
    (1 - THREE.MathUtils.smoothstep(Math.abs(x - station), 12, 18)) *
    THREE.MathUtils.smoothstep(-z, 4.3, 6.5) *
    (1 - THREE.MathUtils.smoothstep(-z, 13, 17));
  return THREE.MathUtils.lerp(bank, -0.88, pool);
}

export function valleyFloor() {
  const section = new THREE.PlaneGeometry(span * (road.length + 3), 55, 480, 38);
  section.rotateX(-Math.PI / 2);
  section.translate((span * road.length) / 2, 0, -8);
  const pos = section.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  section.computeVertexNormals();
  const ground = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, bridge: { value: bridge }, marsh: { value: station } },
    vertexShader: `
      varying vec3 world;
      void main(){world=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader: `
      varying vec3 world;
      uniform float t,bridge,marsh;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.543);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){
        vec2 p=world.xz;
        float coarse = noise(p*vec2(.2,.44));
        float tuft = noise(p*vec2(2.,4.7));
        float stipple = noise(p*vec2(8.,18.));
        float fleck = noise(p*vec2(38.,33.));
        float variation=coarse*.50+tuft*.27+stipple*.18+fleck*.05;
        float edge = sin(p.x*.31)*.78 + sin(p.x*.07)*.75;
        float road = abs(p.y-edge) - 2.1 - coarse*.7 - tuft*.35;
        vec3 grass=mix(vec3(.19,.28,.205),vec3(.64,.65,.34),smoothstep(.16,.85,variation));
        grass += vec3(.10,.069,.018)*smoothstep(.62,.8,stipple)*step(.50,coarse);
        vec3 path=mix(vec3(.46,.40,.31),vec3(.75,.67,.49),variation);
        path += vec3(.045,.036,.023)*step(.65,stipple);
        vec3 col=mix(path,grass,smoothstep(-.33,.53,road+.87*(stipple-.5)));
        float mottling=noise(vec2(p.x*.23-p.y*.54,p.y*.66))+tuft*.25;
        float sunlight=smoothstep(.40,.70,mottling);
        col*=mix(vec3(.79,.87,.88),vec3(1.075,1.045,.95),sunlight);
        float streamMask = (1.-smoothstep(12.,17.,abs(p.x-marsh))) * smoothstep(4.8,6.5,-p.y) * (1.-smoothstep(12.8,15.,-p.y));
        streamMask=max(streamMask,(1.-smoothstep(6.,12.,abs(p.x-bridge)))*smoothstep(.8,3.,-world.y));
        float wave=noise(p*vec2(1.9,13.)+vec2(t*.18,t*.28));
        col=mix(col,mix(vec3(.34,.53,.52),vec3(.67,.76,.65),smoothstep(.45,.79,wave)),streamMask);
        col=mix(col,vec3(.58,.66,.58),smoothstep(7.,32.,-p.y)*.42);
        gl_FragColor=vec4(col,1.);
      }`,
    side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(section, ground);
  return {
    group: floor,
    update(time) {
      ground.uniforms.t.value = time;
    },
  };
}
