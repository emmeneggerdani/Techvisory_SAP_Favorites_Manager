/* ====================================================================
   store.js
   Zustand + reine Datenoperationen. Kein DOM-Zugriff (Ausnahme:
   localStorage). Rendering passiert ausschließlich in ui.js.
   ==================================================================== */
(function(global){
  "use strict";

  var LS_KEY_FAVORITES = 'sap_fav_manager_v1';
  var LS_KEY_TCODEDB = 'sap_fav_manager_tcodedb_v1';

  var state = {
    nodes: new Map(),
    nextId: 2,
    selectedIds: new Set(),
    lastAnchorId: null,
    collapsed: new Set(),
    clipboard: null,          // {ids:[...]}
    searchQuery: '',
    tcodeDb: new Map(),       // TCODE (upper) -> Beschreibungstext
    tcodeDbLabel: '',         // Anzeigename der geladenen Datei
    localStorageWorks: true
  };

  function freshRoot(){
    state.nodes = new Map();
    state.nodes.set(1, {id:1, parentId:0, kind:'root', rtype:null, tcode:'', text:'Meine Favoriten', url:''});
    state.nextId = 2;
    state.selectedIds = new Set();
    state.lastAnchorId = null;
  }
  freshRoot();

  // ---- Baum-Hilfsfunktionen ---------------------------------------------
  function childrenOf(id){
    var out = [];
    state.nodes.forEach(function(n){ if(n.parentId===id) out.push(n); });
    out.sort(function(a,b){ return a.id-b.id; });
    return out;
  }
  function collectSubtree(id, set){
    set.add(id);
    childrenOf(id).forEach(function(c){ collectSubtree(c.id, set); });
  }
  function folderPath(id){
    if(id===1) return 'Meine Favoriten';
    var n = state.nodes.get(id);
    if(!n) return '?';
    return folderPath(n.parentId) + ' / ' + n.text;
  }
  function isFolderLike(n){ return !!n && (n.kind==='root' || n.kind==='folder'); }
  function effectiveTargetFolder(){
    if(state.selectedIds.size===0) return 1;
    var id = (state.lastAnchorId!==null && state.selectedIds.has(state.lastAnchorId))
      ? state.lastAnchorId : state.selectedIds.values().next().value;
    var n = state.nodes.get(id);
    if(!n) return 1;
    return isFolderLike(n) ? n.id : n.parentId;
  }

  // ---- CRUD ---------------------------------------------------------------
  function addFolder(text, parentId){
    var id = state.nextId++;
    state.nodes.set(id, {id:id, parentId:parentId, kind:'folder', rtype:null, tcode:'', text:text, url:''});
    return id;
  }
  function addEntry(rtype, tcode, text, url, parentId){
    var id = state.nextId++;
    state.nodes.set(id, {id:id, parentId:parentId, kind:'entry', rtype:rtype, tcode:tcode, text:text, url:url});
    return id;
  }
  function editFolder(id, text, parentId){
    var n = state.nodes.get(id); if(!n) return;
    n.text = text;
    if(parentId!==undefined && parentId!==null) n.parentId = parentId;
  }
  function editEntry(id, tcode, text, url, parentId){
    var n = state.nodes.get(id); if(!n) return;
    n.tcode = tcode; n.text = text; n.url = url;
    if(parentId!==undefined && parentId!==null) n.parentId = parentId;
  }
  function deleteNodes(ids){
    var all = new Set();
    ids.forEach(function(id){
      var n = state.nodes.get(id);
      if(!n) return;
      if(n.kind==='folder') collectSubtree(id, all); else all.add(id);
    });
    all.forEach(function(id){ state.nodes.delete(id); });
    return all;
  }
  function moveNodes(idSet, targetFolderId){
    var target = state.nodes.get(targetFolderId);
    if(!target || !isFolderLike(target)) return;
    idSet.forEach(function(id){
      if(id===1) return;
      var n = state.nodes.get(id);
      if(!n || n.id===targetFolderId) return;
      if(n.kind==='folder'){
        var sub = new Set(); collectSubtree(n.id, sub);
        if(sub.has(targetFolderId)) return; // Zyklus verhindern
      }
      n.parentId = targetFolderId;
    });
  }
  function cloneSubtree(id, newParentId){
    var orig = state.nodes.get(id);
    var newId = state.nextId++;
    state.nodes.set(newId, {id:newId, parentId:newParentId, kind:orig.kind, rtype:orig.rtype, tcode:orig.tcode, text:orig.text, url:orig.url});
    if(orig.kind==='folder'){
      childrenOf(id).forEach(function(c){ cloneSubtree(c.id, newId); });
    }
    return newId;
  }
  function pasteClipboard(){
    if(!state.clipboard || !state.clipboard.ids.length) return [];
    var target = effectiveTargetFolder();
    var idSet = new Set(state.clipboard.ids);
    var topIds = state.clipboard.ids.filter(function(id){
      var n = state.nodes.get(id);
      if(!n) return false;
      var p = n.parentId;
      while(p){
        if(idSet.has(p)) return false;
        var pn = state.nodes.get(p); if(!pn) break; p = pn.parentId;
      }
      return true;
    });
    return topIds.filter(function(id){ return state.nodes.get(id); }).map(function(id){ return cloneSubtree(id, target); });
  }

  function findDuplicates(){
    var groups = new Map();
    state.nodes.forEach(function(n){
      if(n.kind!=='entry') return;
      var sig = n.rtype==='TR'
        ? 'TR · '+(n.tcode||'').trim().toUpperCase()
        : (n.rtype||'OT')+' · '+((n.url||n.tcode||'').trim().toUpperCase());
      if(!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(n);
    });
    var out = [];
    groups.forEach(function(list, sig){ if(list.length>1) out.push([sig, list]); });
    out.sort(function(a,b){ return b[1].length-a[1].length; });
    return out;
  }

  // ---- TCode-Datenbank ------------------------------------------------
  // Akzeptiert:
  //  - Array von Objekten: [{tcode:"SE16N", text:"Data Browser"}, ...]
  //    (Schlüssel-Varianten: tcode/TCODE/code, text/TEXT/description/beschreibung)
  //  - Array von 2er-Arrays: [["SE16N","Data Browser"], ...]
  //  - Objekt-Map: {"SE16N":"Data Browser", ...}
  function normalizeTcodeDb(data){
    var map = new Map();
    if(Array.isArray(data)){
      data.forEach(function(item){
        if(Array.isArray(item) && item.length>=2){
          map.set(String(item[0]).trim().toUpperCase(), String(item[1]).trim());
        } else if(item && typeof item==='object'){
          var code = item.tcode || item.TCODE || item.Tcode || item.code || item.Code;
          var text = item.text || item.TEXT || item.Text || item.description || item.Description || item.beschreibung || item.Beschreibung;
          if(code) map.set(String(code).trim().toUpperCase(), String(text||'').trim());
        }
      });
    } else if(data && typeof data==='object'){
      Object.keys(data).forEach(function(k){
        map.set(k.trim().toUpperCase(), String(data[k]||'').trim());
      });
    }
    return map;
  }
  function loadTcodeDbFromJson(jsonText, label){
    var data = JSON.parse(jsonText);
    state.tcodeDb = normalizeTcodeDb(data);
    state.tcodeDbLabel = label || '';
    return state.tcodeDb.size;
  }
  function lookupTcode(code){
    if(!code) return null;
    var hit = state.tcodeDb.get(String(code).trim().toUpperCase());
    return hit===undefined ? null : hit;
  }
  function searchTcodes(prefix, limit){
    prefix = (prefix||'').trim().toUpperCase();
    var out = [];
    state.tcodeDb.forEach(function(text, code){
      if(!prefix || code.indexOf(prefix)===0){
        out.push({code:code, text:text});
        if(out.length>=1000) return;
      }
    });
    out.sort(function(a,b){ return a.code<b.code?-1:1; });
    return out.slice(0, limit||50);
  }

  // ---- Lokale Speicherung (Favoriten) -------------------------------
  function saveLocal(){
    if(!state.localStorageWorks) return;
    try{
      var data = JSON.stringify({nextId: state.nextId, nodes: Array.from(state.nodes.values())});
      window.localStorage.setItem(LS_KEY_FAVORITES, data);
    }catch(e){ state.localStorageWorks = false; }
  }
  function loadLocal(){
    try{
      var raw = window.localStorage.getItem(LS_KEY_FAVORITES);
      if(!raw) return false;
      var data = JSON.parse(raw);
      if(!data.nodes || !data.nodes.length) return false;
      state.nodes = new Map(data.nodes.map(function(n){ return [n.id, n]; }));
      if(!state.nodes.has(1)) state.nodes.set(1, {id:1,parentId:0,kind:'root',rtype:null,tcode:'',text:'Meine Favoriten',url:''});
      state.nextId = data.nextId || 2;
      return true;
    }catch(e){ state.localStorageWorks = false; return false; }
  }

  // ---- Lokale Speicherung (TCode-DB, eigener Key, da potenziell groß) --
  function saveTcodeDbLocal(){
    if(!state.localStorageWorks) return;
    try{
      var data = JSON.stringify({label: state.tcodeDbLabel, entries: Array.from(state.tcodeDb.entries())});
      window.localStorage.setItem(LS_KEY_TCODEDB, data);
    }catch(e){ /* z.B. Speicherlimit überschritten - bewusst ignorieren, DB bleibt nur in dieser Session */ }
  }
  function loadTcodeDbLocal(){
    try{
      var raw = window.localStorage.getItem(LS_KEY_TCODEDB);
      if(!raw) return false;
      var data = JSON.parse(raw);
      state.tcodeDb = new Map(data.entries);
      state.tcodeDbLabel = data.label || '';
      return state.tcodeDb.size>0;
    }catch(e){ return false; }
  }

  global.Store = {
    state: state,
    freshRoot: freshRoot,
    childrenOf: childrenOf,
    collectSubtree: collectSubtree,
    folderPath: folderPath,
    isFolderLike: isFolderLike,
    effectiveTargetFolder: effectiveTargetFolder,
    addFolder: addFolder,
    addEntry: addEntry,
    editFolder: editFolder,
    editEntry: editEntry,
    deleteNodes: deleteNodes,
    moveNodes: moveNodes,
    cloneSubtree: cloneSubtree,
    pasteClipboard: pasteClipboard,
    findDuplicates: findDuplicates,
    normalizeTcodeDb: normalizeTcodeDb,
    loadTcodeDbFromJson: loadTcodeDbFromJson,
    lookupTcode: lookupTcode,
    searchTcodes: searchTcodes,
    saveLocal: saveLocal,
    loadLocal: loadLocal,
    saveTcodeDbLocal: saveTcodeDbLocal,
    loadTcodeDbLocal: loadTcodeDbLocal
  };

})(window);
