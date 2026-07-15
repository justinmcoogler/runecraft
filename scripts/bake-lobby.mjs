// Bake the lobby_red hub schematic into (1) a packed walkable structure asset
// with its trees stripped out, and (2) a list of tree-node placements (local
// x,z + species) that stand in for the removed trees until custom tree models
// replace them. Emits game/src/content/structures/lobby.ts.
//
//   node --max-old-space-size=6000 game/scripts/bake-lobby.mjs <file.schem>
import { build } from "esbuild";
import { gzipSync, gunzipSync } from "zlib";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2];
if (!src) { console.error("usage: bake-lobby.mjs <file.schem>"); process.exit(1); }

const bundled = await build({ stdin: { contents: `
  export { parsePaletteKey } from "./src/structures/formats";
  export { toStructureBlock } from "./src/structures/mapping";
  export { packStructures, cullEnclosedCubes } from "./src/structures/packed";
  export { walkableSurfaces } from "./src/structures/types";
`, resolveDir: gameDir, loader: "ts" }, bundle: true, format: "esm", platform: "node", write: false });
const mod = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
const { parsePaletteKey, toStructureBlock, packStructures, cullEnclosedCubes, walkableSurfaces } = mod;

let buf = readFileSync(src); try { buf = gunzipSync(buf); } catch {}
let pos = 0;
const u8=()=>buf[pos++], i16=()=>{const v=buf.readInt16BE(pos);pos+=2;return v;}, i32=()=>{const v=buf.readInt32BE(pos);pos+=4;return v;};
const rstr=()=>{const n=buf.readUInt16BE(pos);pos+=2;const s=buf.toString("utf8",pos,pos+n);pos+=n;return s;};
function skip(t){switch(t){case 1:pos+=1;break;case 2:pos+=2;break;case 3:pos+=4;break;case 4:pos+=8;break;case 5:pos+=4;break;case 6:pos+=8;break;case 7:{const n=i32();pos+=n;break;}case 8:{const n=buf.readUInt16BE(pos);pos+=2+n;break;}case 9:{const et=u8();const n=i32();for(let i=0;i<n;i++)skip(et);break;}case 10:{for(;;){const tt=u8();if(tt===0)break;const nl=buf.readUInt16BE(pos);pos+=2+nl;skip(tt);}break;}case 11:{const n=i32();pos+=4*n;break;}case 12:{const n=i32();pos+=8*n;break;}default:throw new Error("tag "+t);}}
let W,H,L,palette={},dataOff=-1,dataLen=0;
function walk(){for(;;){const tt=u8();if(tt===0)break;const name=rstr();if(tt===2){const v=i16();if(name==="Width")W=v;else if(name==="Height")H=v;else if(name==="Length")L=v;}else if(tt===10&&(name==="Blocks"||name==="Schematic"))walk();else if(tt===10&&name==="Palette"){for(;;){const pt=u8();if(pt===0)break;const pn=rstr();palette[pn]=i32();}}else if(tt===7&&(name==="Data"||name==="BlockData")){const n=i32();dataOff=pos;dataLen=n;pos+=n;}else skip(tt);}}
u8();rstr();walk();
console.error(`dims ${W}x${H}x${L}, palette ${Object.keys(palette).length}`);
const inv=[]; for(const[n,i]of Object.entries(palette))inv[i]=n.replace("minecraft:","");
const bare=inv.map(n=>n?n.split("[")[0]:n); // strip block-state brackets
const isAir=inv.map((n,i)=>!n||/air$/.test(bare[i]));
const isLeaf=inv.map((n,i)=>n&&(/_leaves$/.test(bare[i])||/^(azalea|flowering_azalea|mangrove_roots)$/.test(bare[i])));
const isLog=inv.map((n,i)=>n&&/(_log|_wood|_stem)$/.test(bare[i]));
const leafSpecies=inv.map((n,i)=>{ const b=bare[i]; if(!b)return null; if(/jungle/.test(b))return "jungle"; if(/acacia/.test(b))return "acacia"; if(/spruce/.test(b))return "spruce"; if(/birch/.test(b))return "birch"; if(/dark_oak/.test(b))return "darkoak"; return "basic"; });
const tpl=inv.map(n=>{ if(!n||/air$/.test(n))return null; const {name,props}=parsePaletteKey("minecraft:"+n); const {block}=toStructureBlock(0,0,0,name,props); return block; });

// pass 1: bbox, leaf columns + species tally, log columns
let mnx=1e9,mxx=-1,mnz=1e9,mxz=-1,minY=1e9;
const leaf=new Uint8Array(W*L), log=new Uint8Array(W*L);
const spCount=new Map();
const decode=(cb)=>{let p=dataOff;const end=dataOff+dataLen;let idx=0;while(p<end){let val=0,shift=0,b;do{b=buf[p++];val|=(b&0x7f)<<shift;shift+=7;}while(b&0x80);if(!isAir[val]){const x=idx%W,z=((idx/W)|0)%L,y=(idx/(W*L))|0;cb(x,y,z,val);}idx++;}};
decode((x,y,z,val)=>{ if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(z<mnz)mnz=z;if(z>mxz)mxz=z;if(y<minY)minY=y; const c=z*W+x;
  if(isLeaf[val]){leaf[c]=1; const s=leafSpecies[val]; spCount.set(s,(spCount.get(s)||0)+1);} if(isLog[val])log[c]=1; });
console.error(`bbox x${mnx}-${mxx} z${mnz}-${mxz} minY=${minY}`);
// tree trunk columns = log columns with >=2 leaf columns within radius 2
const trunk=new Uint8Array(W*L);
for(let z=mnz;z<=mxz;z++)for(let x=mnx;x<=mxx;x++){ const c=z*W+x; if(!log[c])continue; let near=0; for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,nz=z+dz;if(nx>=0&&nx<W&&nz>=0&&nz<L&&leaf[nz*W+nx])near++;} if(near>=2)trunk[c]=1; }
// tree nodes: cluster trunk columns (connected comp), one node per cluster
const seen=new Uint8Array(W*L), nodes=[];
for(let z=mnz;z<=mxz;z++)for(let x=mnx;x<=mxx;x++){ const s0=z*W+x; if(!trunk[s0]||seen[s0])continue; const st=[s0];seen[s0]=1;let sx=0,sz=0,n=0; const spTally=new Map();
  while(st.length){const c=st.pop();const cx=c%W,cz=(c/W)|0;sx+=cx;sz+=cz;n++; for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const nx=cx+dx,nz=cz+dz;if(nx<0||nx>=W||nz<0||nz>=L)continue;const nc=nz*W+nx;if(trunk[nc]&&!seen[nc]){seen[nc]=1;st.push(nc);}}
    // species vote from nearby leaves
    for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const nx=cx+dx,nz=cz+dz;if(nx<0||nx>=W||nz<0||nz>=L)continue;} }
  const gx=Math.round(sx/n),gz=Math.round(sz/n);
  // species by nearest leaf tally in a small window
  const sv=new Map(); for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const nx=gx+dx,nz=gz+dz;if(nx<0||nx>=W||nz<0||nz>=L)continue;} 
  nodes.push({x:gx-mnx,z:gz-mnz}); }
// species per node: sample dominant leaf species around node from spCount global fallback
const domSpecies=[...spCount.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||"jungle";
// mark columns to strip logs: trunk columns
// pass 2: build blocks (strip leaves everywhere, strip logs on trunk columns)
// A build this large can only render as instanced cubes — shaped pieces
// (stairs/slabs/panes/posts) would each need an individual mesh (100k+ = crash),
// so flatten every solid piece to a full cube. Detail is lost but the hub reads.
const CUBEKIND = new Set(["stairs","slab","thin","pane","post"]);
const blocks=[];
decode((x,y,z,val)=>{ if(isLeaf[val])return; if(y-minY>70)return; const c=z*W+x; if(isLog[val]&&trunk[c])return; const b=tpl[val]; if(!b)return;
  const out={...b,x:x-mnx,y:y-minY,z:z-mnz};
  if(CUBEKIND.has(out.kind)){ if(out.translucent){out.kind="cube";} else {out.kind="cube";out.top=undefined;out.facing=undefined;out.open=undefined;} }
  blocks.push(out); });
console.error(`raw blocks ${blocks.length}, trees ${nodes.length}, dominant species ${domSpecies}`);
const W2=mxx-mnx+1, D2=mxz-mnz+1;
let maxY=0;for(const b of blocks)if(b.y>maxY)maxY=b.y;
// Cull the whole build first (best cross-block enclosure), then slice into tiles
// so the renderer streams only the tiles near the player (a single town-sized
// mesh takes ~30s to build and can't stream). Tiles share y=0 origin + sink=0 so
// their floors line up seamlessly on the flat plateau.
let whole=cullEnclosedCubes({name:"lobby",sx:W2,sy:maxY+1,sz:D2,sink:1,blocks});
console.error(`culled blocks ${whole.blocks.length} of ${blocks.length}`);
// Global walkability, per-column (a terraced hub isn't a flood-fillable building
// — walkableSurfaces marks most of it blocked). A cell stands on the top of its
// lowest solid stack that has 2 blocks of headroom, if that surface is low
// enough to be ground/terrace (<= WALKMAX); a taller stack with no low standing
// spot is a wall.
const WALKMAX=4;
const occ=new Map();
for(const b of whole.blocks){ if(b.kind!=="cube"&&b.kind!=="post")continue; const c=b.z*W2+b.x; let s=occ.get(c); if(!s){s=new Set();occ.set(c,s);} s.add(b.y); }
// Walk-map: per-cell code — 0 terrain (leave to natural ground), 255 blocked
// (a wall), else the surface top (integer, since shaped pieces were cubed) so a
// terrace cell stands at base+top. Computed once on the whole hub above.
const walkMap=new Uint8Array(W2*D2);
let nWalk=0,nBlock=0;
for(const [c,s] of occ){ let code=255; for(let y=0;y<=WALKMAX;y++){ if(s.has(y)&&!s.has(y+1)&&!s.has(y+2)){ code=y+1; break; } } walkMap[c]=code; if(code===255)nBlock++;else nWalk++; }
const walkB64=Buffer.from(gzipSync(walkMap)).toString("base64");
console.error(`walk-map ${nWalk} walkable, ${nBlock} wall  ->  ${(walkB64.length/1024).toFixed(0)}KB b64`);
const TILE=64, cols=Math.ceil(W2/TILE), rows=Math.ceil(D2/TILE);
const buckets=new Map();
for(const b of whole.blocks){ const tx=Math.floor(b.x/TILE), tz=Math.floor(b.z/TILE); const k=tx+","+tz; let a=buckets.get(k); if(!a){a=[];buckets.set(k,a);} a.push({...b,x:b.x-tx*TILE,z:b.z-tz*TILE}); }
const tiles=[];
for(const [k,bl] of buckets){ const [tx,tz]=k.split(",").map(Number); let sy=0;for(const b of bl)if(b.y+1>sy)sy=b.y+1;
  tiles.push({name:`lobby.t_${tx}_${tz}`, sx:Math.min(TILE,W2-tx*TILE), sy, sz:Math.min(TILE,D2-tz*TILE), sink:1, blocks:bl}); }
console.error(`tiles ${tiles.length} (TILE=${TILE}, grid ${cols}x${rows})`);
const raw=packStructures(tiles); const bin=gzipSync(raw); const b64=Buffer.from(bin).toString("base64");
console.error(`packed -> ${(raw.length/1048576).toFixed(1)}MB raw, ${(bin.length/1048576).toFixed(2)}MB gz, ${(b64.length/1048576).toFixed(2)}MB b64`);
const treeList = nodes.map(nd=>`{x:${nd.x},z:${nd.z}}`).join(",");
const out=`// Auto-generated from lobby_red.schem. Do not edit.\n// The hub build sliced into ${TILE}x${TILE} walkable tiles (lazily decoded so the\n// renderer streams only the tiles near the player), a global walk-map (surfaces\n// + walls, computed once so per-tile flood-fill never runs), and the tree\n// positions that seed harvestable nodes (swapped for custom trees later).\nimport { gunzipSync } from "fflate";\nimport { openPackBase64 } from "../../structures/packed";\nexport const lobbyPack = openPackBase64(\n  ${JSON.stringify(b64)},\n);\nexport const LOBBY_TILE = ${TILE};\nexport const LOBBY_W = ${W2};\nexport const LOBBY_D = ${D2};\nexport const LOBBY_SINK = 1;\nexport const LOBBY_SPECIES = ${JSON.stringify(domSpecies)};\nexport const LOBBY_TREES: Array<{x:number;z:number}> = [${treeList}];\nlet _walk: Uint8Array | null = null;\n/** Per-cell walk code (row-major, LOBBY_W wide): 0 = natural ground, 255 = wall,\n *  else the surface top the walker stands on (relative to the tile floor). */\nexport function lobbyWalk(): Uint8Array {\n  if (!_walk) _walk = gunzipSync(Uint8Array.from(atob(${JSON.stringify(walkB64)}), (c) => c.charCodeAt(0)));\n  return _walk;\n}\n`;
writeFileSync(resolve(gameDir,"src/content/structures/lobby.ts"), out);
console.error(`wrote src/content/structures/lobby.ts (${tiles.length} tiles, ${nodes.length} trees)`);
