/* ====================================================================
   store.js
   Zustand + reine Datenoperationen. Kein DOM-Zugriff (Ausnahme:
   localStorage). Rendering passiert ausschließlich in ui.js.
   ==================================================================== */
(function(global){
  "use strict";

  var LS_KEY_FAVORITES_PREFIX = 'sap_fav_manager_v1:';   // + Profil-ID
  var LS_KEY_FAVORITES_LEGACY = 'sap_fav_manager_v1';     // altes Format (vor Profilen)
  var LS_KEY_TCODEDB = 'sap_fav_manager_tcodedb_v1';
  var LS_KEY_PROFILES = 'sap_fav_manager_profiles_v1';
  var LS_KEY_ACTIVE_PROFILE = 'sap_fav_manager_active_profile_v1';
  var DEFAULT_PROFILE_ID = 'default';
  var MAX_UNDO = 50;

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
    localStorageWorks: true,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [],
    undoStack: []
  };

  function emptyRootNode(){
    return {id:1, parentId:0, kind:'root', rtype:null, tcode:'', text:'Meine Favoriten', url:'', order:0};
  }
  function freshRoot(){
    state.nodes = new Map();
    state.nodes.set(1, emptyRootNode());
    state.nextId = 2;
    state.selectedIds = new Set();
    state.lastAnchorId = null;
    state.undoStack = [];
  }
  freshRoot();

  // ---- Baum-Hilfsfunktionen ---------------------------------------------
  function orderKey(n){ return (n.order!==undefined && n.order!==null) ? n.order : n.id; }
  function childrenOf(id){
    var out = [];
    state.nodes.forEach(function(n){ if(n.parentId===id) out.push(n); });
    out.sort(function(a,b){
      var ka=orderKey(a), kb=orderKey(b);
      if(ka!==kb) return ka-kb;
      return a.id-b.id;
    });
    return out;
  }
  function nextOrder(parentId){
    var kids = childrenOf(parentId);
    if(!kids.length) return 0;
    var max = -Infinity;
    kids.forEach(function(k){ var o=orderKey(k); if(o>max) max=o; });
    return max+1;
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

  // ---- Undo ---------------------------------------------------------------
  // Einfaches Snapshot-basiertes Undo: vor jeder Änderung wird der komplette
  // Baum kopiert und auf einen Stapel gelegt (Redo gibt es bewusst nicht).
  function snapshotNodes(){
    var out = [];
    state.nodes.forEach(function(n){ out.push(Object.assign({}, n)); });
    return out;
  }
  function pushUndo(){
    state.undoStack.push({nextId: state.nextId, nodes: snapshotNodes()});
    if(state.undoStack.length > MAX_UNDO) state.undoStack.shift();
  }
  function canUndo(){ return state.undoStack.length>0; }
  function undo(){
    if(!state.undoStack.length) return false;
    var snap = state.undoStack.pop();
    state.nodes = new Map(snap.nodes.map(function(n){ return [n.id, n]; }));
    if(!state.nodes.has(1)) state.nodes.set(1, emptyRootNode());
    state.nextId = snap.nextId;
    state.selectedIds = new Set();
    state.lastAnchorId = null;
    return true;
  }

  // ---- CRUD (jede Änderung legt zuerst einen Undo-Schnappschuss an) -----
  function addFolder(text, parentId){
    pushUndo();
    var id = state.nextId++;
    state.nodes.set(id, {id:id, parentId:parentId, kind:'folder', rtype:null, tcode:'', text:text, url:'', order:nextOrder(parentId)});
    return id;
  }
  function addEntry(rtype, tcode, text, url, parentId){
    pushUndo();
    var id = state.nextId++;
    state.nodes.set(id, {id:id, parentId:parentId, kind:'entry', rtype:rtype, tcode:tcode, text:text, url:url, order:nextOrder(parentId)});
    return id;
  }
  function editFolder(id, text, parentId){
    pushUndo();
    var n = state.nodes.get(id); if(!n) return;
    n.text = text;
    if(parentId!==undefined && parentId!==null && parentId!==n.parentId){
      n.parentId = parentId; n.order = nextOrder(parentId);
    }
  }
  function editEntry(id, tcode, text, url, parentId){
    pushUndo();
    var n = state.nodes.get(id); if(!n) return;
    n.tcode = tcode; n.text = text; n.url = url;
    if(parentId!==undefined && parentId!==null && parentId!==n.parentId){
      n.parentId = parentId; n.order = nextOrder(parentId);
    }
  }
  // Schlanke Variante ohne eigenen Undo-Schnappschuss, für Inline-Edit-Helfer,
  // die den Schnappschuss selbst schon vorher angelegt haben.
  function renameNode(id, text){
    var n = state.nodes.get(id); if(!n) return;
    n.text = text;
  }
  function retagEntry(id, tcode){
    var n = state.nodes.get(id); if(!n || n.kind!=='entry') return;
    n.tcode = tcode;
  }
  function deleteNodes(ids){
    pushUndo();
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
    pushUndo();
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
      n.order = nextOrder(targetFolderId);
    });
  }
  // Wie moveNodes, aber setzt die verschobenen Knoten an eine genaue Position
  // innerhalb der Geschwister (unmittelbar vor beforeId, oder ans Ende wenn
  // beforeId null/nicht vorhanden ist). Für Drag & Drop-Umsortierung.
  function moveNodesToPosition(idSet, targetFolderId, beforeId){
    var target = state.nodes.get(targetFolderId);
    if(!target || !isFolderLike(target)) return;
    pushUndo();
    var moved = [];
    idSet.forEach(function(id){
      if(id===1) return;
      var n = state.nodes.get(id);
      if(!n || n.id===targetFolderId) return;
      if(n.kind==='folder'){
        var sub = new Set(); collectSubtree(n.id, sub);
        if(sub.has(targetFolderId)) return; // Zyklus verhindern
      }
      n.parentId = targetFolderId;
      moved.push(n);
    });
    if(!moved.length) return;
    var movedIds = {};
    moved.forEach(function(n){ movedIds[n.id] = true; });
    var siblings = childrenOf(targetFolderId).filter(function(n){ return !movedIds[n.id]; });
    var insertAt = siblings.length;
    if(beforeId!==null && beforeId!==undefined){
      for(var i=0;i<siblings.length;i++){
        if(siblings[i].id===beforeId){ insertAt = i; break; }
      }
    }
    var result = siblings.slice(0, insertAt).concat(moved, siblings.slice(insertAt));
    result.forEach(function(n, i){ n.order = i; });
  }
  function siblingAfter(n){
    var sibs = childrenOf(n.parentId);
    for(var i=0;i<sibs.length;i++){
      if(sibs[i].id===n.id) return (i+1<sibs.length) ? sibs[i+1].id : null;
    }
    return null;
  }
  function cloneSubtree(id, newParentId){
    var orig = state.nodes.get(id);
    var newId = state.nextId++;
    state.nodes.set(newId, {id:newId, parentId:newParentId, kind:orig.kind, rtype:orig.rtype, tcode:orig.tcode, text:orig.text, url:orig.url, order:nextOrder(newParentId)});
    if(orig.kind==='folder'){
      childrenOf(id).forEach(function(c){ cloneSubtree(c.id, newId); });
    }
    return newId;
  }
  function pasteClipboard(){
    if(!state.clipboard || !state.clipboard.ids.length) return [];
    pushUndo();
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

  // ---- Sortieren ------------------------------------------------------
  function cmpText(a, b){
    var ta=(a.text||'').toLowerCase(), tb=(b.text||'').toLowerCase();
    return ta<tb ? -1 : (ta>tb ? 1 : 0);
  }
  function sortChildrenInternal(folderId, recursive){
    var kids = childrenOf(folderId);
    var folders = kids.filter(function(k){ return k.kind==='folder'; }).sort(cmpText);
    var entries = kids.filter(function(k){ return k.kind==='entry'; }).sort(cmpText);
    folders.concat(entries).forEach(function(k, i){ k.order = i; });
    if(recursive){
      folders.forEach(function(f){ sortChildrenInternal(f.id, true); });
    }
  }
  function sortChildren(folderId, recursive){
    pushUndo();
    sortChildrenInternal(folderId, !!recursive);
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

  // ---- Profile ----------------------------------------------------------
  // Ein Profil ist ein eigenständiger, unabhängig verlinkter Favoriten-Baum
  // (z.B. je SAP-System/Mandant). Die TCode-Datenbank ist bewusst geteilt
  // (Referenzdaten, kein Grund für getrennte Kopien pro Profil).
  //
  // Quelle der Wahrheit ist state.profiles (in-memory) - genau wie beim
  // Favoriten-Baum selbst. localStorage dient nur als Best-Effort-Spiegel,
  // damit die Profilliste einen Neustart übersteht; ist localStorage nicht
  // verfügbar (z.B. Vorschau-Sandbox), funktionieren Profile innerhalb der
  // laufenden Sitzung trotzdem normal weiter.
  function uid(){ return 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
  var profilesLoaded = false;
  function ensureProfilesLoaded(){
    if(profilesLoaded) return;
    profilesLoaded = true;
    try{
      var raw = window.localStorage.getItem(LS_KEY_PROFILES);
      var list = raw ? JSON.parse(raw) : null;
      state.profiles = (list && list.length) ? list : [{id: DEFAULT_PROFILE_ID, name:'Standard'}];
    }catch(e){
      state.profiles = [{id: DEFAULT_PROFILE_ID, name:'Standard'}];
    }
  }
  function persistProfiles(){
    try{ window.localStorage.setItem(LS_KEY_PROFILES, JSON.stringify(state.profiles)); }catch(e){}
  }
  function listProfiles(){
    ensureProfilesLoaded();
    return state.profiles;
  }
  function getActiveProfileId(){
    ensureProfilesLoaded();
    try{
      var id = window.localStorage.getItem(LS_KEY_ACTIVE_PROFILE);
      if(id && state.profiles.some(function(p){ return p.id===id; })) return id;
    }catch(e){}
    return state.profiles[0].id;
  }
  function setActiveProfileId(id){
    state.activeProfileId = id;
    try{ window.localStorage.setItem(LS_KEY_ACTIVE_PROFILE, id); }catch(e){}
  }
  function createProfile(name){
    ensureProfilesLoaded();
    var id = uid();
    state.profiles.push({id:id, name:name});
    persistProfiles();
    return id;
  }
  function renameProfile(id, name){
    ensureProfilesLoaded();
    var p = state.profiles.filter(function(x){ return x.id===id; })[0];
    if(p){ p.name = name; persistProfiles(); }
  }
  function deleteProfile(id){
    ensureProfilesLoaded();
    state.profiles = state.profiles.filter(function(x){ return x.id!==id; });
    if(!state.profiles.length) state.profiles = [{id: DEFAULT_PROFILE_ID, name:'Standard'}];
    persistProfiles();
    try{ window.localStorage.removeItem(LS_KEY_FAVORITES_PREFIX+id); }catch(e){}
    return state.profiles;
  }

  // ---- Lokale Speicherung (Favoriten, pro Profil) -----------------------
  function saveLocal(){
    if(!state.localStorageWorks) return;
    try{
      var data = JSON.stringify({nextId: state.nextId, nodes: Array.from(state.nodes.values())});
      window.localStorage.setItem(LS_KEY_FAVORITES_PREFIX+state.activeProfileId, data);
    }catch(e){ state.localStorageWorks = false; }
  }
  function loadLocal(){
    try{
      var key = LS_KEY_FAVORITES_PREFIX+state.activeProfileId;
      var raw = window.localStorage.getItem(key);
      // Migration: altes Format (vor Profilen) einmalig ins Standard-Profil übernehmen.
      if(!raw && state.activeProfileId===DEFAULT_PROFILE_ID){
        raw = window.localStorage.getItem(LS_KEY_FAVORITES_LEGACY);
        if(raw) window.localStorage.setItem(key, raw);
      }
      if(!raw) return false;
      var data = JSON.parse(raw);
      if(!data.nodes || !data.nodes.length) return false;
      state.nodes = new Map(data.nodes.map(function(n){ return [n.id, n]; }));
      if(!state.nodes.has(1)) state.nodes.set(1, emptyRootNode());
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
    renameNode: renameNode,
    retagEntry: retagEntry,
    deleteNodes: deleteNodes,
    moveNodes: moveNodes,
    moveNodesToPosition: moveNodesToPosition,
    siblingAfter: siblingAfter,
    cloneSubtree: cloneSubtree,
    pasteClipboard: pasteClipboard,
    sortChildren: sortChildren,
    findDuplicates: findDuplicates,
    normalizeTcodeDb: normalizeTcodeDb,
    loadTcodeDbFromJson: loadTcodeDbFromJson,
    lookupTcode: lookupTcode,
    searchTcodes: searchTcodes,
    pushUndo: pushUndo,
    canUndo: canUndo,
    undo: undo,
    listProfiles: listProfiles,
    getActiveProfileId: getActiveProfileId,
    setActiveProfileId: setActiveProfileId,
    createProfile: createProfile,
    renameProfile: renameProfile,
    deleteProfile: deleteProfile,
    saveLocal: saveLocal,
    loadLocal: loadLocal,
    saveTcodeDbLocal: saveTcodeDbLocal,
    loadTcodeDbLocal: loadTcodeDbLocal
  };

})(window);
