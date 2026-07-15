// Slice a modern WorldEdit "sponge" schematic that packs many buildings on a
// shared floor platform into individual house StructureAssets, then emit them
// as one gzipped packed group (game/src/content/structures/<group>.ts).
//
//   node game/scripts/slice-house-pack.mjs <file.schem> <group> <idPrefix> [--dry] [--max N]
//
// Buildings are found as connected components of the above-floor (y>=2) block
// mass; identical builds are de-duplicated by content hash.
import { build } from "esbuild";
import { gzipSync } from "zlib";
import { readFileSync, writeFileSync } from "fs";
import { gunzipSync } from "zlib";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [, , src, group, idPrefix, ...rest] = process.argv;
if (!src || !group || !idPrefix) { console.error("usage: slice-house-pack.mjs <file.schem> <group> <idPrefix> [--dry] [--max N]"); process.exit(1); }
const dry = rest.includes("--dry");
const maxI = rest.indexOf("--max"); const MAX = maxI >= 0 ? parseInt(rest[maxI + 1]) : Infinity;

// Bundle the TS helpers we need.
const bundled = await build({
  stdin: { contents: `
    export { parsePaletteKey } from "./src/structures/formats";
    export { toStructureBlock } from "./src/structures/mapping";
    export { packStructures, cullEnclosedCubes } from "./src/structures/packed";
  `, resolveDir: gameDir, loader: "ts" },
  bundle: true, format: "esm", platform: "node", write: false,
});
const mod = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
const { parsePaletteKey, toStructureBlock, packStructures, cullEnclosedCubes } = mod;

// --- parse sponge schem (memory-safe streaming) ---
let buf = readFileSync(src); try { buf = gunzipSync(buf); } catch {}
let pos = 0;
const u8 = () => buf[pos++], i16 = () => { const v = buf.readInt16BE(pos); pos += 2; return v; }, i32 = () => { const v = buf.readInt32BE(pos); pos += 4; return v; };
const rstr = () => { const n = buf.readUInt16BE(pos); pos += 2; const s = buf.toString("utf8", pos, pos + n); pos += n; return s; };
function skip(t){switch(t){case 1:pos+=1;break;case 2:pos+=2;break;case 3:pos+=4;break;case 4:pos+=8;break;case 5:pos+=4;break;case 6:pos+=8;break;case 7:{const n=i32();pos+=n;break;}case 8:{const n=buf.readUInt16BE(pos);pos+=2+n;break;}case 9:{const et=u8();const n=i32();for(let i=0;i<n;i++)skip(et);break;}case 10:{for(;;){const tt=u8();if(tt===0)break;const nl=buf.readUInt16BE(pos);pos+=2+nl;skip(tt);}break;}case 11:{const n=i32();pos+=4*n;break;}case 12:{const n=i32();pos+=8*n;break;}default:throw new Error("tag "+t);}}
let W,H,L,palette={},dataOff=-1,dataLen=0;
function walk(){for(;;){const tt=u8();if(tt===0)break;const name=rstr();if(tt===2){const v=i16();if(name==="Width")W=v;else if(name==="Height")H=v;else if(name==="Length")L=v;}else if(tt===10&&(name==="Blocks"||name==="Schematic"))walk();else if(tt===10&&name==="Palette"){for(;;){const pt=u8();if(pt===0)break;const pn=rstr();palette[pn]=i32();}}else if(tt===7&&(name==="Data"||name==="BlockData")){const n=i32();dataOff=pos;dataLen=n;pos+=n;}else skip(tt);}}
u8();rstr();walk();
console.error(`dims ${W}x${H}x${L}, palette ${Object.keys(palette).length}`);

// palette index -> {air, template block (props-only)}
const inv=[];for(const[n,i]of Object.entries(palette))inv[i]=n;
const isAir=inv.map(n=>!n||/air$/.test(n));
const tpl=inv.map(n=>{ if(!n||/air$/.test(n))return null; const {name,props}=parsePaletteKey(n); const {block}=toStructureBlock(0,0,0,name,props); return block; });

// pass 1: footprint (y>=2 non-air), then connected components (gap tol 1)
const fp=new Uint8Array(W*L);
const decode=(cb)=>{let p=dataOff;const end=dataOff+dataLen;let idx=0;while(p<end){let val=0,shift=0,b;do{b=buf[p++];val|=(b&0x7f)<<shift;shift+=7;}while(b&0x80);const y=(idx/(W*L))|0;if(y>=2&&!isAir[val]){const x=idx%W,z=((idx/W)|0)%L;cb(x,y,z,val);}idx++;}};
decode((x,y,z)=>{fp[z*W+x]=1;});
const GAP=1;const dil=new Uint8Array(W*L);
for(let z=0;z<L;z++)for(let x=0;x<W;x++){if(!fp[z*W+x])continue;for(let dz=-GAP;dz<=GAP;dz++)for(let dx=-GAP;dx<=GAP;dx++){const nx=x+dx,nz=z+dz;if(nx>=0&&nx<W&&nz>=0&&nz<L)dil[nz*W+nx]=1;}}
const label=new Int32Array(W*L).fill(-1);const comps=[];const st=[];
for(let s=0;s<W*L;s++){if(!dil[s]||label[s]>=0)continue;const id=comps.length;let minx=1e9,maxx=-1,minz=1e9,maxz=-1,rc=0;st.push(s);label[s]=id;while(st.length){const c=st.pop();const x=c%W,z=(c/W)|0;if(fp[c])rc++;if(x<minx)minx=x;if(x>maxx)maxx=x;if(z<minz)minz=z;if(z>maxz)maxz=z;const nbs=[[x-1,z],[x+1,z],[x,z-1],[x,z+1]];for(const[nx,nz]of nbs){if(nx<0||nx>=W||nz<0||nz>=L)continue;const nc=nz*W+nx;if(dil[nc]&&label[nc]<0){label[nc]=id;st.push(nc);}}}comps.push({id,minx,maxx,minz,maxz,rc,w:maxx-minx+1,d:maxz-minz+1});}
const kept=comps.filter(c=>c.rc>=40&&c.w<=48&&c.d<=48&&c.w>=6&&c.d>=6);
console.error(`components ${comps.length}, kept ${kept.length}`);

// pass 2: gather blocks per kept comp (local coords, y-2 floor)
const keepId=new Int32Array(comps.length).fill(-1);kept.forEach((c,i)=>keepId[c.id]=i);
const blocksByComp=kept.map(()=>[]);
decode((x,y,z,val)=>{const b=tpl[val];if(!b)return;const cid=label[z*W+x];if(cid<0)return;const ki=keepId[cid];if(ki<0)return;const c=kept[ki];blocksByComp[ki].push({...b,x:x-c.minx,y:y-2,z:z-c.minz});});

// Detect a house's real ground-floor slab and DROP everything beneath it, so no
// block ever sits under the floor. Many of these builds stand on a sparse
// foundation / stilt base (9-17% footprint coverage) with the true floor slab
// (40-55%) a few layers up; the old "lowest non-empty layer" rule kept that
// base. The real floor is a BROAD slab, so: take the densest layer in the lower
// 60% of the build as the reference, then the floor is the LOWEST layer whose
// coverage reaches 70% of it — anything below is foundation and gets trimmed.
function trimUnderFloor(blocks){
  const area=(()=>{let mnx=1e9,mxx=-1,mnz=1e9,mxz=-1;for(const b of blocks){if(b.x<mnx)mnx=b.x;if(b.x>mxx)mxx=b.x;if(b.z<mnz)mnz=b.z;if(b.z>mxz)mxz=b.z;}return (mxx-mnx+1)*(mxz-mnz+1);})();
  const cov=new Map(); // y -> footprint cells with a solid stand-on block
  for(const b of blocks){ if(b.kind!=="cube"&&b.kind!=="slab"&&b.kind!=="stairs")continue; if(!cov.has(b.y))cov.set(b.y,new Set()); cov.get(b.y).add(b.x+","+b.z); }
  let minY=Infinity,maxY=-1;for(const b of blocks){if(b.y<minY)minY=b.y;if(b.y>maxY)maxY=b.y;}
  const lowerTop=minY+Math.max(1,Math.round((maxY-minY+1)*0.6));
  let ref=0;for(let y=minY;y<=lowerTop;y++)ref=Math.max(ref,cov.get(y)?.size??0);
  const need=Math.max(0.7*ref, 0.25*area); // broad slab, not a stilt row
  let floor=minY;for(let y=minY;y<=maxY;y++){ if((cov.get(y)?.size??0)>=need){ floor=y; break; } }
  return blocks.filter(b=>b.y>=floor).map(b=>({...b,y:b.y-floor}));
}
// build assets, dedupe by content hash
function hash(blocks){let h=0x811c9dc5>>>0;for(const b of blocks){const s=`${b.x},${b.y},${b.z},${b.kind},${b.material||b.color||""}`;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}}return h>>>0;}
const seen=new Map();const assets=[];
kept.forEach((c,i)=>{let blocks=blocksByComp[i];if(!blocks.length)return;blocks=trimUnderFloor(blocks);if(!blocks.length)return;let sy=0;for(const b of blocks)if(b.y+1>sy)sy=b.y+1;
  const hkey=`${c.w}x${c.d}x${sy}:${blocks.length}:${hash(blocks)}`;if(seen.has(hkey))return;seen.set(hkey,1);
  let a={name:"tmp",sx:c.w,sy,sz:c.d,sink:1,blocks};a=cullEnclosedCubes(a);assets.push(a);});
assets.sort((a,b)=>b.blocks.length-a.blocks.length);
console.error(`unique assets after dedupe: ${assets.length}`);
const final=assets.slice(0,MAX).map((a,i)=>({...a,name:`${idPrefix}${String(i+1).padStart(3,"0")}`}));
const raw=packStructures(final);const bin=gzipSync(raw);const b64=Buffer.from(bin).toString("base64");
console.error(`packed ${final.length} houses -> ${(raw.length/1024/1024).toFixed(2)} MB raw, ${(bin.length/1024/1024).toFixed(2)} MB gz, ${(b64.length/1024/1024).toFixed(2)} MB base64`);
const szHist={};for(const a of final){const k=`${a.sx}x${a.sz}`;szHist[k]=(szHist[k]||0)+1;}
console.error("sizes:",Object.entries(szHist).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>`${k}:${v}`).join(" "));
if(dry){console.error("dry run — not writing");process.exit(0);}
const out=`// Auto-generated packed house group from an imported asset map. Do not edit.\n// Opened lazily (per-asset LRU decode) so the ${final.length}-house library never\n// materializes all at once. Asset names already carry the "${idPrefix}" prefix.\nimport { openPackBase64 } from "../../structures/packed";\nexport const ${group}Pack = openPackBase64(\n  ${JSON.stringify(b64)},\n);\n`;
writeFileSync(resolve(gameDir, `src/content/structures/${group}.ts`), out);
console.error(`wrote src/content/structures/${group}.ts`);
