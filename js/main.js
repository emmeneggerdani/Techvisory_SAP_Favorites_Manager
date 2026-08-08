/* ====================================================================
   main.js
   Verdrahtet Toolbar/Datei-Events mit Store (Daten) und UI (Rendering).
   Kümmert sich außerdem um Profile (mehrere unabhängig verlinkte
   Favoriten-Bäume) und die Verknüpfung mit echten lokalen Dateien für
   Favoriten und TCode-Datenbank (siehe filestore.js) inkl. automatischem
   Laden beim Öffnen.
   ==================================================================== */
(function(){
  "use strict";

  var APP_VERSION = '1.1.0';
  var S = window.Store, UI = window.UI, F = window.SapFormat, FS = window.FileStore;

  function emptyRoot(){
    return {id:1, parentId:0, kind:'root', rtype:null, tcode:'', text:'Meine Favoriten', url:'', order:0};
  }
  function loadFavoritesJson(text){
    var data = JSON.parse(text);
    if(!data || !data.nodes) throw new Error('ungültiges Format');
    S.state.nodes = new Map(data.nodes.map(function(n){ return [n.id, n]; }));
    if(!S.state.nodes.has(1)) S.state.nodes.set(1, emptyRoot());
    S.state.nextId = data.nextId || 2;
    S.state.collapsed = new Set(); S.state.selectedIds = new Set(); S.state.lastAnchorId = null;
  }

  document.addEventListener('DOMContentLoaded', function(){

    UI.init({
      treePanel: document.getElementById('tree-panel'),
      sidePanel: document.getElementById('side-content'),
      countBadge: document.getElementById('count-badge'),
      footerMsg: document.getElementById('footer-msg'),
      searchInput: document.getElementById('search-input')
    });

    function stamp(){
      var now = new Date();
      return now.getFullYear()+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0');
    }
    function downloadBlob(blob, filename){
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // ================= Datei-Verknüpfung (File System Access API) =================
    var favHandle = null, favGranted = false;
    var tcodeHandle = null, tcodeGranted = false;
    var connBar = document.getElementById('connection-bar');

    var Persist = {
      save: function(){
        S.saveLocal();
        if(FS.supported && favHandle && favGranted){
          var data = JSON.stringify({nextId: S.state.nextId, nodes: Array.from(S.state.nodes.values())}, null, 2);
          FS.writeFile(favHandle, data).catch(function(){
            favGranted = false; renderConnectionBar();
            UI.setFooter('Konnte nicht in die verknüpfte Favoriten-Datei schreiben (evtl. verschoben/gelöscht) – bitte erneut verbinden.');
          });
        }
      }
    };
    window.Persist = Persist;

    function connItem(label, handle, granted, handlers){
      var wrap = document.createElement('span'); wrap.className='conn-item';
      var dot = document.createElement('span');
      dot.className = 'conn-dot' + (handle && granted ? ' ok' : (handle ? ' warn' : ''));
      wrap.appendChild(dot);
      var text = document.createElement('span'); text.className='conn-label';
      text.textContent = label + ': ' + (handle && granted ? ('verbunden ('+handle.name+')') : handle ? 'Zugriff erforderlich' : 'nicht verbunden');
      wrap.appendChild(text);
      if(!handle){
        var btn = document.createElement('button'); btn.textContent='🔗 Verbinden';
        btn.addEventListener('click', handlers.onConnect);
        wrap.appendChild(btn);
      } else if(!granted){
        var btn2 = document.createElement('button'); btn2.textContent='🔓 Zugriff erlauben';
        btn2.addEventListener('click', handlers.onReconnect);
        wrap.appendChild(btn2);
      } else {
        if(handlers.onReload){
          var btn3 = document.createElement('button'); btn3.textContent='🔄 Neu laden';
          btn3.addEventListener('click', handlers.onReload);
          wrap.appendChild(btn3);
        }
        var btn4 = document.createElement('button'); btn4.textContent='Trennen';
        btn4.addEventListener('click', handlers.onForget);
        wrap.appendChild(btn4);
      }
      return wrap;
    }

    function renderConnectionBar(){
      connBar.innerHTML='';
      if(!FS.supported){
        connBar.classList.remove('conn-ok','conn-warn');
        var note = document.createElement('span'); note.className='conn-note';
        note.textContent = 'Automatische Datei-Verknüpfung wird von diesem Browser nicht unterstützt (nur Chrome/Edge/Opera) – nutze das ⚙ Einstellungen-Menü als Alternative.';
        connBar.appendChild(note);
        return;
      }
      var favOk = !!(favHandle && favGranted);
      connBar.classList.toggle('conn-ok', favOk);
      connBar.classList.toggle('conn-warn', !favOk);
      connBar.appendChild(connItem('Favoriten-Datei', favHandle, favGranted, {
        onConnect: connectFavorites, onReconnect: reconnectFavorites, onForget: forgetFavorites
      }));
      connBar.appendChild(connItem('TCode-Datenbank', tcodeHandle, tcodeGranted, {
        onConnect: connectTcode, onReconnect: reconnectTcode, onForget: forgetTcode, onReload: reloadTcode
      }));
    }

    function connectFavorites(){
      FS.pickFavoritesFile(S.state.activeProfileId).then(function(handle){
        favHandle = handle; favGranted = true;
        return FS.readFile(handle);
      }).then(function(text){
        var loaded = false;
        if(text && text.trim()){
          try{ loadFavoritesJson(text); loaded = true; }
          catch(e){ /* keine gültige/leere JSON -> aktuellen Stand hineinschreiben */ }
        }
        if(!loaded){
          Persist.save();
        } else {
          S.saveLocal();
        }
        UI.renderAll();
        UI.setFooter('Mit Favoriten-Datei "'+favHandle.name+'" verbunden – '+(S.state.nodes.size-1)+' Einträge.');
        renderConnectionBar();
      }).catch(function(err){
        if(err && err.name==='AbortError') return;
        alert('Datei konnte nicht verknüpft werden: '+(err && err.message ? err.message : err));
      });
    }
    function reconnectFavorites(){
      FS.requestPermission(favHandle, true).then(function(perm){
        if(perm!=='granted'){ alert('Zugriff wurde nicht erteilt.'); return; }
        favGranted = true;
        return FS.readFile(favHandle).then(function(text){
          try{
            if(text && text.trim()) loadFavoritesJson(text);
            UI.renderAll();
            UI.setFooter('Wieder mit Favoriten-Datei "'+favHandle.name+'" verbunden – '+(S.state.nodes.size-1)+' Einträge.');
          }catch(e){ alert('Die verknüpfte Datei enthält kein gültiges Favoriten-JSON.'); }
          renderConnectionBar();
        });
      });
    }
    function forgetFavorites(){
      FS.forgetHandle('favorites:'+S.state.activeProfileId).then(function(){
        favHandle=null; favGranted=false; renderConnectionBar();
        UI.setFooter('Verknüpfung mit der Favoriten-Datei aufgehoben. Änderungen werden weiterhin lokal im Browser gespeichert.');
      });
    }

    function connectTcode(){
      FS.pickTcodeFile().then(function(handle){
        tcodeHandle = handle; tcodeGranted = true;
        return FS.readFile(handle);
      }).then(function(text){
        var count = S.loadTcodeDbFromJson(text, tcodeHandle.name);
        S.saveTcodeDbLocal();
        UI.renderSide('info');
        UI.setFooter('Mit TCode-Datenbank "'+tcodeHandle.name+'" verbunden – '+count+' Codes.');
        renderConnectionBar();
      }).catch(function(err){
        if(err && err.name==='AbortError') return;
        alert('TCode-Datenbank konnte nicht als JSON gelesen/verknüpft werden: '+(err && err.message ? err.message : err));
      });
    }
    function reconnectTcode(){
      FS.requestPermission(tcodeHandle, false).then(function(perm){
        if(perm!=='granted'){ alert('Zugriff wurde nicht erteilt.'); return; }
        tcodeGranted = true;
        return FS.readFile(tcodeHandle).then(function(text){
          var count = S.loadTcodeDbFromJson(text, tcodeHandle.name);
          S.saveTcodeDbLocal();
          UI.renderSide('info');
          UI.setFooter('Wieder mit TCode-Datenbank "'+tcodeHandle.name+'" verbunden – '+count+' Codes.');
          renderConnectionBar();
        });
      });
    }
    function reloadTcode(){
      FS.readFile(tcodeHandle).then(function(text){
        var count = S.loadTcodeDbFromJson(text, tcodeHandle.name);
        S.saveTcodeDbLocal();
        UI.renderSide('info');
        UI.setFooter('TCode-Datenbank neu von Datei geladen – '+count+' Codes.');
      });
    }
    function forgetTcode(){
      FS.forgetHandle('tcodedb').then(function(){
        tcodeHandle=null; tcodeGranted=false; renderConnectionBar();
      });
    }

    // Versucht beim Start bzw. nach Profilwechsel, die Favoriten-Datei
    // des aktiven Profils automatisch (wieder) einzuhängen.
    function loadLinkedFavoritesForActiveProfile(){
      favHandle = null; favGranted = false;
      if(!FS.supported) return;
      FS.tryReconnect('favorites:'+S.state.activeProfileId, true).then(function(res){
        if(res.state==='granted'){
          favHandle = res.handle; favGranted = true;
          return FS.readFile(favHandle).then(function(text){
            if(text && text.trim()){
              try{
                loadFavoritesJson(text);
                UI.renderAll();
                UI.setFooter('Automatisch aus verknüpfter Datei "'+favHandle.name+'" geladen – '+(S.state.nodes.size-1)+' Einträge.');
              }catch(e){ /* Datei nicht lesbar -> lokaler Stand bleibt aktiv */ }
            }
            renderConnectionBar();
          });
        } else if(res.state==='needs-permission'){
          favHandle = res.handle; favGranted = false;
          renderConnectionBar();
        } else {
          renderConnectionBar();
        }
      });
    }
    function loadLinkedTcodeDb(){
      tcodeHandle = null; tcodeGranted = false;
      if(!FS.supported) return;
      FS.tryReconnect('tcodedb', false).then(function(res){
        if(res.state==='granted'){
          tcodeHandle = res.handle; tcodeGranted = true;
          return FS.readFile(tcodeHandle).then(function(text){
            var count = S.loadTcodeDbFromJson(text, tcodeHandle.name);
            S.saveTcodeDbLocal();
            UI.renderSide('info');
            renderConnectionBar();
          });
        } else if(res.state==='needs-permission'){
          tcodeHandle = res.handle; tcodeGranted = false;
          renderConnectionBar();
        } else {
          renderConnectionBar();
        }
      });
    }

    // ================= Profile =================
    var profileSelect = document.getElementById('profile-select');

    function renderProfileBar(){
      var list = S.listProfiles();
      profileSelect.innerHTML = '';
      list.forEach(function(p){
        var o = document.createElement('option'); o.value = p.id; o.textContent = p.name;
        profileSelect.appendChild(o);
      });
      profileSelect.value = S.state.activeProfileId;
      document.getElementById('btn-profile-delete').disabled = list.length<=1;
    }

    function switchToProfile(id){
      S.setActiveProfileId(id);
      var had = S.loadLocal();
      if(!had) S.freshRoot();
      S.state.collapsed = new Set(); S.state.selectedIds = new Set(); S.state.lastAnchorId = null; S.state.clipboard = null;
      UI.renderAll();
      renderProfileBar();
      loadLinkedFavoritesForActiveProfile();
    }

    profileSelect.addEventListener('change', function(){ switchToProfile(profileSelect.value); });

    document.getElementById('btn-profile-new').addEventListener('click', function(){
      var name = prompt('Name für das neue Profil (z.B. Systemname/Mandant):');
      if(!name || !name.trim()) return;
      var id = S.createProfile(name.trim());
      S.setActiveProfileId(id);
      S.freshRoot();
      S.state.collapsed = new Set(); S.state.selectedIds = new Set(); S.state.lastAnchorId = null; S.state.clipboard = null;
      UI.renderAll(); S.saveLocal();
      renderProfileBar();
      favHandle = null; favGranted = false; renderConnectionBar();
      UI.setFooter('Profil "'+name.trim()+'" angelegt. Noch keine Datei verknüpft.');
    });
    document.getElementById('btn-profile-rename').addEventListener('click', function(){
      var list = S.listProfiles();
      var current = list.filter(function(p){ return p.id===S.state.activeProfileId; })[0];
      var name = prompt('Neuer Name für dieses Profil:', current ? current.name : '');
      if(!name || !name.trim()) return;
      S.renameProfile(S.state.activeProfileId, name.trim());
      renderProfileBar();
    });
    document.getElementById('btn-profile-delete').addEventListener('click', function(){
      var list = S.listProfiles();
      if(list.length<=1) return;
      var current = list.filter(function(p){ return p.id===S.state.activeProfileId; })[0];
      if(!confirm('Profil "'+(current?current.name:'')+'" wirklich löschen? Die lokal zwischengespeicherten Favoriten dieses Profils gehen dabei verloren (eine evtl. verlinkte Datei bleibt auf der Festplatte erhalten).')) return;
      var remaining = S.deleteProfile(S.state.activeProfileId);
      switchToProfile(remaining[0].id);
      UI.setFooter('Profil gelöscht.');
    });

    // ================= Baum-Aktionen =================
    document.getElementById('btn-add-folder').addEventListener('click', function(){ UI.renderSide('add-folder'); });
    document.getElementById('btn-add-tr').addEventListener('click', function(){ UI.renderSide('add-tr'); });
    document.getElementById('btn-add-ot').addEventListener('click', function(){ UI.renderSide('add-ot'); });
    document.getElementById('btn-edit').addEventListener('click', function(){
      var real = Array.from(S.state.selectedIds).filter(function(id){ return id!==1; });
      if(real.length===1) UI.renderSide('edit', real[0]);
    });
    document.getElementById('btn-copy').addEventListener('click', function(){
      var real = Array.from(S.state.selectedIds).filter(function(id){ return id!==1; });
      if(!real.length) return;
      S.state.clipboard = {ids: real};
      UI.renderTree();
      UI.setFooter(real.length+' Element(e) in die Zwischenablage kopiert. Ziel wählen und „Einfügen“ klicken.');
    });
    document.getElementById('btn-paste').addEventListener('click', function(){
      var newIds = S.pasteClipboard();
      if(newIds.length){
        S.state.selectedIds = new Set(newIds);
        S.state.lastAnchorId = newIds[newIds.length-1];
      }
      UI.renderAll(); Persist.save();
    });
    document.getElementById('btn-delete').addEventListener('click', function(){
      var real = Array.from(S.state.selectedIds).filter(function(id){ return id!==1; });
      if(!real.length) return;
      var preview = new Set();
      real.forEach(function(id){
        var n = S.state.nodes.get(id); if(!n) return;
        if(n.kind==='folder') S.collectSubtree(id, preview); else preview.add(id);
      });
      var msg = preview.size>real.length
        ? 'Auswahl (inkl. enthaltener Unterelemente, insgesamt '+preview.size+') löschen?'
        : (preview.size>1 ? preview.size+' Elemente löschen?' : 'Diesen Eintrag löschen?');
      if(!confirm(msg)) return;
      S.deleteNodes(real);
      S.state.selectedIds = new Set(); S.state.lastAnchorId = null;
      UI.renderAll(); Persist.save();
    });
    document.getElementById('btn-dupes').addEventListener('click', function(){ UI.renderSide('duplicates'); });

    // ================= Undo =================
    function doUndo(){
      if(!S.undo()) { UI.setFooter('Nichts zum Rückgängig-Machen vorhanden.'); return; }
      UI.renderAll(); Persist.save();
      UI.setFooter('Letzte Änderung rückgängig gemacht.');
    }
    document.getElementById('btn-undo').addEventListener('click', doUndo);

    // ================= Sortieren (gesamter Baum, im Einstellungen-Menü) ===
    document.getElementById('btn-sort-all').addEventListener('click', function(){
      S.sortChildren(1, true);
      UI.renderAll(); Persist.save();
      UI.setFooter('Gesamter Baum alphabetisch sortiert.');
      closeSettings();
    });

    document.getElementById('btn-reset').addEventListener('click', function(){
      if(!confirm('Wirklich alle Favoriten aus diesem Tool löschen? Dies kann nicht rückgängig gemacht werden.')) return;
      S.freshRoot(); S.state.collapsed = new Set(); S.state.clipboard = null;
      UI.renderAll(); Persist.save();
      UI.setFooter('Alle Favoriten wurden gelöscht.');
      closeSettings();
    });

    // ================= SAP-Import/-Export =================
    document.getElementById('btn-import').addEventListener('click', function(){ document.getElementById('file-input-sap').click(); });
    document.getElementById('file-input-sap').addEventListener('change', function(e){
      var file = e.target.files[0]; if(!file) return;
      var reader = new FileReader();
      reader.onload = function(ev){
        S.pushUndo();
        var bytes = new Uint8Array(ev.target.result);
        var parsed = F.parseSapFile(F.decodeCp1252(bytes));
        S.state.nodes = parsed.nodes; S.state.nextId = parsed.nextId;
        S.state.collapsed = new Set(); S.state.selectedIds = new Set(); S.state.lastAnchorId = null;
        UI.renderAll(); Persist.save();
        UI.setFooter('"'+file.name+'" geladen – '+(S.state.nodes.size-1)+' Einträge.');
      };
      reader.readAsArrayBuffer(file);
      e.target.value='';
    });
    document.getElementById('btn-export').addEventListener('click', function(){
      if(S.state.nodes.size<=1){ alert('Es sind noch keine Favoriten angelegt.'); return; }
      var bytes = F.encodeCp1252(F.buildSapExport(S.state.nodes));
      downloadBlob(new Blob([bytes], {type:'text/plain'}), 'SAP_Favoriten_'+stamp()+'.txt');
      UI.setFooter('Datei exportiert. In SAP GUI unter Favoriten → Favoriten hochladen (MENU_FAVORITES_UPLOAD) wieder einspielen.');
    });

    // ================= JSON-Backup (manuelle Kopie, unabhängig von der Verknüpfung) ====
    document.getElementById('btn-json-save').addEventListener('click', function(){
      var data = JSON.stringify({nextId: S.state.nextId, nodes: Array.from(S.state.nodes.values())}, null, 2);
      downloadBlob(new Blob([data], {type:'application/json'}), 'sap_favoriten_backup_'+stamp()+'.json');
      closeSettings();
    });
    document.getElementById('btn-json-load').addEventListener('click', function(){ closeSettings(); document.getElementById('file-input-json').click(); });
    document.getElementById('file-input-json').addEventListener('change', function(e){
      var file = e.target.files[0]; if(!file) return;
      var reader = new FileReader();
      reader.onload = function(ev){
        try{
          S.pushUndo();
          loadFavoritesJson(ev.target.result);
          UI.renderAll(); Persist.save();
          UI.setFooter('"'+file.name+'" geladen – '+(S.state.nodes.size-1)+' Einträge.');
        }catch(err){ alert('Diese Datei konnte nicht als Favoriten-JSON gelesen werden.'); }
      };
      reader.readAsText(file);
      e.target.value='';
    });

    // ================= TCode-Datenbank: einmaliger Datei-Import ============
    document.getElementById('btn-tcodedb-load').addEventListener('click', function(){ closeSettings(); document.getElementById('file-input-tcodedb').click(); });
    document.getElementById('file-input-tcodedb').addEventListener('change', function(e){
      var file = e.target.files[0]; if(!file) return;
      var reader = new FileReader();
      reader.onload = function(ev){
        try{
          var count = S.loadTcodeDbFromJson(ev.target.result, file.name);
          S.saveTcodeDbLocal();
          UI.renderSide('info');
          UI.setFooter('TCode-Datenbank "'+file.name+'" geladen – '+count+' Codes.');
        }catch(err){ alert('Diese Datei konnte nicht als TCode-Datenbank (JSON) gelesen werden.'); }
      };
      reader.readAsText(file);
      e.target.value='';
    });

    // ================= Suche =================
    var searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', function(){ S.state.searchQuery = searchInput.value; UI.renderTree(); });
    document.getElementById('btn-search-clear').addEventListener('click', function(){ S.state.searchQuery=''; searchInput.value=''; UI.renderTree(); });

    // ================= Alle Ordner auf-/zuklappen =================
    document.getElementById('btn-expand-all').addEventListener('click', function(){
      S.state.collapsed = new Set();
      UI.renderTree();
    });
    document.getElementById('btn-collapse-all').addEventListener('click', function(){
      var all = new Set();
      S.state.nodes.forEach(function(n){ if(n.kind==='folder') all.add(n.id); });
      S.state.collapsed = all;
      UI.renderTree();
    });

    // ================= Info (Modal) =================
    document.getElementById('app-version').textContent = APP_VERSION;
    var infoOverlay = document.getElementById('info-overlay');
    function openInfo(){ infoOverlay.hidden = false; }
    function closeInfo(){ infoOverlay.hidden = true; }
    document.getElementById('btn-info').addEventListener('click', openInfo);
    document.getElementById('btn-info-close').addEventListener('click', closeInfo);
    infoOverlay.addEventListener('click', function(e){ if(e.target===infoOverlay) closeInfo(); });

    // ================= Einstellungen (Modal) =================
    var settingsOverlay = document.getElementById('settings-overlay');
    function openSettings(){ settingsOverlay.hidden = false; }
    function closeSettings(){ settingsOverlay.hidden = true; }
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('btn-settings-close').addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', function(e){ if(e.target===settingsOverlay) closeSettings(); });

    // ================= Tastenkürzel =================
    document.addEventListener('keydown', function(e){
      if(e.key==='Escape' && !infoOverlay.hidden){ closeInfo(); return; }
      if(e.key==='Escape' && !settingsOverlay.hidden){ closeSettings(); return; }
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if(tag==='INPUT' || tag==='SELECT') return;
      if(e.key==='Delete'){ document.getElementById('btn-delete').click(); }
      if((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==='z'){ e.preventDefault(); doUndo(); return; }
      if((e.ctrlKey||e.metaKey) && e.key==='c'){ document.getElementById('btn-copy').click(); }
      if((e.ctrlKey||e.metaKey) && e.key==='v'){ document.getElementById('btn-paste').click(); }
    });

    // ================= Start =================
    S.state.activeProfileId = S.getActiveProfileId();
    renderProfileBar();

    var hadLocal = S.loadLocal();
    S.loadTcodeDbLocal();
    if(!S.state.localStorageWorks){
      UI.setFooter('Hinweis: Der lokale Browserspeicher ist hier nicht verfügbar (z.B. Vorschau-Sandbox). Nutze das ⚙ Einstellungen-Menü zur Sicherung.');
    } else if(hadLocal){
      UI.setFooter('Gespeicherter Stand aus dem Browser geladen – '+(S.state.nodes.size-1)+' Einträge.');
    }
    UI.renderAll();
    renderConnectionBar();

    if(FS.supported){
      FS.migrateLegacyFavoritesHandle(S.state.activeProfileId).then(function(){
        loadLinkedFavoritesForActiveProfile();
      });
      loadLinkedTcodeDb();
    }
  });

})();
