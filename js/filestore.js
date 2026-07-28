/* ====================================================================
   filestore.js
   Bindet Favoriten und TCode-Datenbank an echte lokale Dateien über die
   File System Access API (Chrome/Edge/Opera). Die Datei-Handles werden
   in IndexedDB abgelegt, damit die Verknüpfung auch nach dem Schließen
   des Browsers/Tabs erhalten bleibt ("beim Öffnen laden").

   Sicherheitsbedingt verlangt der Browser nach jedem Neuladen der Seite
   einmalig eine Bestätigung (Klick) für den Dateizugriff, falls diese
   nicht schon vorher im Rahmen der Session erteilt wurde - das ist keine
   Einschränkung dieses Tools, sondern eine Browser-Vorgabe.

   Nicht unterstützt in Firefox/Safari -> "supported" ist dann false,
   die aufrufende Seite fällt in diesem Fall auf manuelles JSON-
   Speichern/Laden zurück.
   ==================================================================== */
(function(global){
  "use strict";

  var DB_NAME = 'sap_fav_manager_files';
  var STORE_NAME = 'handles';
  var supported = !!(global.showOpenFilePicker && global.showSaveFilePicker && global.indexedDB);

  function openDb(){
    return new Promise(function(resolve, reject){
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(){ req.result.createObjectStore(STORE_NAME); };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
  }
  function idbGet(key){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readonly');
        var rq = tx.objectStore(STORE_NAME).get(key);
        rq.onsuccess = function(){ resolve(rq.result || null); };
        rq.onerror = function(){ reject(rq.error); };
      });
    });
  }
  function idbSet(key, value){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = function(){ resolve(); };
        tx.onerror = function(){ reject(tx.error); };
      });
    });
  }
  function idbDelete(key){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = function(){ resolve(); };
        tx.onerror = function(){ reject(tx.error); };
      });
    });
  }

  // ---- Berechtigungen ---------------------------------------------------
  function queryPermission(handle, forWrite){
    var opts = forWrite ? {mode:'readwrite'} : {mode:'read'};
    return handle.queryPermission(opts);
  }
  function requestPermission(handle, forWrite){
    var opts = forWrite ? {mode:'readwrite'} : {mode:'read'};
    return handle.requestPermission(opts); // benötigt eine User-Geste (Klick)
  }

  // ---- Verknüpfung herstellen --------------------------------------------
  // Favoriten: Save-Dialog, damit auch eine neue Datei angelegt werden kann.
  // Jedes Profil hat seinen eigenen Schlüssel ('favorites:<profilId>').
  function pickFavoritesFile(profileId){
    return global.showSaveFilePicker({
      suggestedName: 'sap_favoriten.json',
      types: [{description:'SAP Favoriten (JSON)', accept:{'application/json':['.json']}}]
    }).then(function(handle){
      return idbSet('favorites:'+profileId, handle).then(function(){ return handle; });
    });
  }
  // TCode-Datenbank: Open-Dialog, da i.d.R. eine bereits vorhandene Datei verknüpft wird.
  // Bewusst NICHT profilgebunden (geteilte Referenzdaten für alle Profile).
  function pickTcodeFile(){
    return global.showOpenFilePicker({
      types: [{description:'TCode-Datenbank (JSON)', accept:{'application/json':['.json']}}],
      multiple: false
    }).then(function(handles){
      var handle = handles[0];
      return idbSet('tcodedb', handle).then(function(){ return handle; });
    });
  }

  // Einmalige Migration: aus der Zeit vor mehreren Profilen gab es genau
  // einen Handle unter dem Schlüssel 'favorites'. Der wird dem Standard-
  // Profil zugeordnet, damit bestehende Verknüpfungen erhalten bleiben.
  function migrateLegacyFavoritesHandle(defaultProfileId){
    return idbGet('favorites').then(function(legacy){
      if(!legacy) return false;
      return idbGet('favorites:'+defaultProfileId).then(function(existing){
        if(existing) return false;
        return idbSet('favorites:'+defaultProfileId, legacy).then(function(){ return true; });
      });
    }).catch(function(){ return false; });
  }

  function getLinkedHandle(key){ return idbGet(key); }
  function forgetHandle(key){ return idbDelete(key); }

  // ---- Beim Start: stillen Reconnect versuchen -------------------------
  // Ergebnis: {state:'none'} | {state:'granted', handle} | {state:'needs-permission', handle}
  function tryReconnect(key, forWrite){
    return idbGet(key).then(function(handle){
      if(!handle) return {state:'none'};
      return queryPermission(handle, forWrite).then(function(perm){
        if(perm==='granted') return {state:'granted', handle:handle};
        return {state:'needs-permission', handle:handle};
      });
    });
  }

  // ---- Lesen/Schreiben ------------------------------------------------
  function readFile(handle){
    return handle.getFile().then(function(file){ return file.text(); });
  }
  function writeFile(handle, text){
    return handle.createWritable().then(function(writable){
      return writable.write(text).then(function(){ return writable.close(); });
    });
  }

  global.FileStore = {
    supported: supported,
    pickFavoritesFile: pickFavoritesFile,
    pickTcodeFile: pickTcodeFile,
    getLinkedHandle: getLinkedHandle,
    forgetHandle: forgetHandle,
    tryReconnect: tryReconnect,
    queryPermission: queryPermission,
    requestPermission: requestPermission,
    readFile: readFile,
    writeFile: writeFile,
    migrateLegacyFavoritesHandle: migrateLegacyFavoritesHandle
  };

})(window);
