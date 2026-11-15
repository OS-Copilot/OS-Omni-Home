/* One tile source for Navigation, Marble and the Flutter driver client. */
(function () {
  'use strict';
  const root = new URL('./opennavigation/tiles/', document.currentScript.src);
  const provider = window.OSOmniMapTileURL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const pending = new Map(), nativeFetch=window.fetch.bind(window);
  const inventory = nativeFetch(new URL('manifest.json', root)).then(r => {
    if (!r.ok) throw new Error('Map tile inventory unavailable');
    return r.json();
  }).then(entries => new Set(entries));
  function key(z,x,y) { return `${z}/${x}/${y}.png`; }
  async function read(url) {
    const r = await nativeFetch(url,{signal:AbortSignal.timeout(10000)}); if (!r.ok) throw new Error('Tile unavailable');
    const blob = await r.blob();
    // Reject HTML error pages even when the host incorrectly returns HTTP 200.
    const bitmap = await createImageBitmap(blob); bitmap.close(); return blob;
  }
  async function load(z,x,y) {
    const entries = await inventory;
    if (entries.has(key(z,x,y))) return read(new URL(key(z,x,y),root));
    try { return await read(provider.replace('{z}',z).replace('{x}',x).replace('{y}',y)); }
    catch (error) {
      // Crop the exact child footprint, rather than stretching the whole parent.
      for (let level=z-1;level>=0;level--) {
        const factor=2**(z-level), px=Math.floor(x/factor), py=Math.floor(y/factor);
        if (!entries.has(key(level,px,py))) continue;
        const image=await createImageBitmap(await read(new URL(key(level,px,py),root)));
        const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
        const size=image.width/factor;
        canvas.getContext('2d').drawImage(image,(x%factor)*size,(y%factor)*size,size,size,0,0,256,256);
        image.close();return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      }
      throw error;
    }
  }
  window.OSOmniMapTiles = {
    async get(z,x,y) {
      const id=key(z,x,y);
      if (!pending.has(id)) {
        const task=load(z,x,y).catch(error=>{pending.delete(id);throw error;});
        pending.set(id,task);
        if(pending.size>256) pending.delete(pending.keys().next().value);
      }
      return pending.get(id);
    },
    async recover(image) {
      image.onerror=null;
      try {
        const blob=await this.get(+image.dataset.z,+image.dataset.x,+image.dataset.y);
        if (!image.isConnected) return;
        const url=URL.createObjectURL(blob);
        image.onload=()=>{URL.revokeObjectURL(url);image.onload=null;};image.src=url;
      } catch (_) {
        image.dataset.unavailable='true';image.style.visibility='hidden';
        const status=document.querySelector('#status-label');
        if(status)status.textContent='Map tiles unavailable — check your connection';
      }
    }
  };
})();
