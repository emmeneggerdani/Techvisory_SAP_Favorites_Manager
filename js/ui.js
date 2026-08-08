/* ====================================================================
   ui.js
   Rendering des Baums und des Seitenpanels sowie die Formularlogik
   (TCode-Validierung gegen die geladene TCode-Datenbank, Fiori-Intent-
   Builder für OT-Objekte). Greift auf Store (store.js) zu.
   ==================================================================== */
(function(global){
  "use strict";

  var S = global.Store;
  var treePanel, sidePanel, countBadge, footerMsg, searchInput;
  var OT_TCODE_DEFAULT_URL = 'URL';
  var OT_TCODE_DEFAULT_FIORI = 'FLP_APP_PROVIDER';

  // Zentraler Speicher-Hook: schreibt localStorage UND, falls verknüpft,
  // die echte lokale Datei. Wird in main.js gesetzt (window.Persist).
  function persist(){
    if(global.Persist && typeof global.Persist.save==='function') global.Persist.save();
    else S.saveLocal();
  }

  // Ersetzt ein Text-Element temporär durch ein Eingabefeld (Inline-Edit
  // per Doppelklick). Enter bestätigt, Escape/Blur-ohne-Änderung bricht ab.
  function startInlineEdit(el, currentValue, onCommit){
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit';
    input.value = currentValue || '';
    input.addEventListener('click', function(e){ e.stopPropagation(); });
    input.addEventListener('mousedown', function(e){ e.stopPropagation(); });
    var cancelled = false;
    input.addEventListener('keydown', function(e){
      e.stopPropagation();
      if(e.key==='Enter'){ input.blur(); }
      else if(e.key==='Escape'){ cancelled = true; input.blur(); }
    });
    var done = false;
    input.addEventListener('blur', function(){
      if(done) return; done = true;
      var val = input.value.trim();
      if(!cancelled && val && val!==currentValue) onCommit(val);
      else renderTree();
    });
    el.replaceWith(input);
    input.focus();
    input.select();
  }
  var flatVisible = [];
  var draggedIds = null;

  function init(dom){
    treePanel = dom.treePanel; sidePanel = dom.sidePanel;
    countBadge = dom.countBadge; footerMsg = dom.footerMsg; searchInput = dom.searchInput;

    treePanel.addEventListener('dragover', function(e){ if(draggedIds) e.preventDefault(); });
    treePanel.addEventListener('drop', function(e){
      if(e.target===treePanel && draggedIds){ e.preventDefault(); S.moveNodes(draggedIds, 1); draggedIds=null; renderAll(); persist(); }
    });
  }

  function setFooter(msg){ footerMsg.textContent = msg; }

  function escapeHtml(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  // ==================== Suche ====================
  function computeSearch(){
    var q = (S.state.searchQuery||'').trim().toLowerCase();
    if(!q) return {active:false, match:null, expand:null};
    var match = new Set();
    S.state.nodes.forEach(function(n){
      if(n.kind==='root') return;
      var hay = ((n.text||'')+' '+(n.tcode||'')+' '+(n.url||'')).toLowerCase();
      if(hay.indexOf(q)!==-1) match.add(n.id);
    });
    var expand = new Set();
    match.forEach(function(id){
      var p = S.state.nodes.get(id).parentId;
      while(p){ expand.add(p); var pn=S.state.nodes.get(p); if(!pn) break; p=pn.parentId; }
    });
    return {active:true, match:match, expand:expand};
  }

  // ==================== Baum ====================
  function iconFor(n){
    if(n.kind==='root') return '⭐';
    if(n.kind==='folder') return '📁';
    if(n.rtype==='TR') return '▸';
    return '◆';
  }

  // Liefert eine navigierbare href für ein OT-URL-Feld, oder null wenn es
  // sich erkennbar nicht um eine Web-Adresse handelt (z.B. Fiori-Intent
  // "#SemObj-Action" oder ein SAP-Bereichsmenü-Code wie "WEDI").
  function toHref(url){
    var u = (url||'').trim();
    if(!u) return null;
    if(/^https?:\/\//i.test(u)) return u;
    if(/^www\.[^\s]+\.[a-z]{2,}/i.test(u)) return 'https://'+u;
    return null;
  }

  function buildRow(n, search){
    var row = document.createElement('div');
    row.className = 'node'+(S.state.selectedIds.has(n.id)?' selected':'')+(search.active && search.match.has(n.id)?' match':'');
    row.dataset.id = n.id;
    row.draggable = n.kind!=='root';

    // Klick vs. Doppelklick sauber trennen: ein einzelner Klick löst (leicht
    // verzögert) die Auswahl + Re-Render aus; kommt innerhalb der Wartezeit
    // ein zweiter Klick (= dblclick), wird der Timer verworfen, BEVOR ein
    // Re-Render das Element unter der Maus zerstören kann.
    function selectNode(e){
      if(n.kind==='root'){ S.state.selectedIds=new Set([1]); S.state.lastAnchorId=1; renderAll(); return; }
      if(e.shiftKey && S.state.lastAnchorId!==null && flatVisible.indexOf(S.state.lastAnchorId)!==-1){
        var i1=flatVisible.indexOf(S.state.lastAnchorId), i2=flatVisible.indexOf(n.id);
        var lo=Math.min(i1,i2), hi=Math.max(i1,i2);
        S.state.selectedIds = new Set(flatVisible.slice(lo,hi+1).filter(function(id){ return id!==1; }));
      } else if(e.ctrlKey || e.metaKey){
        if(S.state.selectedIds.has(n.id)) S.state.selectedIds.delete(n.id); else S.state.selectedIds.add(n.id);
        S.state.lastAnchorId = n.id;
      } else {
        S.state.selectedIds = new Set([n.id]);
        S.state.lastAnchorId = n.id;
      }
      renderAll();
    }
    function attachClickDblclickSplit(el, onDouble){
      var timer = null;
      el.addEventListener('click', function(e){
        e.stopPropagation();
        if(timer) clearTimeout(timer);
        timer = setTimeout(function(){ timer=null; selectNode(e); }, 240);
      });
      el.addEventListener('dblclick', function(e){
        e.stopPropagation();
        if(timer){ clearTimeout(timer); timer=null; }
        onDouble(e);
      });
    }

    var kids = S.childrenOf(n.id);
    var hasKids = S.isFolderLike(n) && kids.length>0;
    var twisty = document.createElement('span');
    twisty.className='twisty';
    twisty.textContent = hasKids ? (S.state.collapsed.has(n.id) && !(search.active && search.expand.has(n.id)) ? '▸' : '▾') : '';
    twisty.addEventListener('click', function(e){
      e.stopPropagation();
      if(S.state.collapsed.has(n.id)) S.state.collapsed.delete(n.id); else S.state.collapsed.add(n.id);
      renderTree();
    });
    row.appendChild(twisty);

    var icon = document.createElement('span'); icon.className='icon'; icon.textContent=iconFor(n);
    row.appendChild(icon);

    if(n.kind==='entry'){
      var code = document.createElement('span');
      code.className = 'code'+(n.rtype!=='TR'?' ot':'');
      code.textContent = n.tcode || '(ohne Code)';
      row.appendChild(code);
      if(n.rtype==='TR'){
        code.title = 'Doppelklick zum Bearbeiten des Codes';
        attachClickDblclickSplit(code, function(){
          startInlineEdit(code, n.tcode||'', function(newVal){
            S.pushUndo(); S.retagEntry(n.id, newVal.toUpperCase());
            persist(); renderTree(); renderSide('info');
          });
        });
      }
      if(n.rtype && n.rtype!=='TR'){
        var b=document.createElement('span'); b.className='badge'; b.textContent=n.rtype;
        row.appendChild(b);
      }
    }

    var desc = document.createElement('span'); desc.className='desc';
    desc.textContent = n.text || (n.kind==='folder' ? '(ohne Namen)' : '');
    desc.title = 'Doppelklick zum Umbenennen';
    attachClickDblclickSplit(desc, function(){
      startInlineEdit(desc, n.text||'', function(newVal){
        S.pushUndo(); S.renameNode(n.id, newVal);
        persist(); renderTree(); renderSide('info');
      });
    });
    row.appendChild(desc);

    if(n.kind==='entry' && n.rtype!=='TR' && n.url){
      var linkHref = toHref(n.url);
      var extra = document.createElement(linkHref ? 'a' : 'span');
      extra.className='extra';
      extra.textContent = '('+n.url+')';
      if(linkHref){
        extra.href = linkHref;
        extra.target = '_blank';
        extra.rel = 'noopener noreferrer';
        extra.title = 'In neuem Tab öffnen: '+linkHref;
        extra.draggable = false;
        extra.addEventListener('click', function(e){ e.stopPropagation(); });
        extra.addEventListener('mousedown', function(e){ e.stopPropagation(); });
        extra.addEventListener('dblclick', function(e){ e.stopPropagation(); });
      }
      row.appendChild(extra);
    }

    row.addEventListener('click', function(e){
      e.stopPropagation();
      selectNode(e);
    });

    row.addEventListener('dragstart', function(e){
      if(e.target && e.target.tagName==='A'){ e.preventDefault(); return; }
      if(n.kind==='root'){ e.preventDefault(); return; }
      if(!S.state.selectedIds.has(n.id)){ S.state.selectedIds=new Set([n.id]); S.state.lastAnchorId=n.id; renderTree(); }
      draggedIds = new Set(S.state.selectedIds);
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain','drag');
    });
    row.addEventListener('dragover', function(e){
      if(!draggedIds) return;
      e.preventDefault();
      var rect = row.getBoundingClientRect();
      var relY = (e.clientY - rect.top) / rect.height;
      var zone;
      if(n.kind==='root'){
        zone = 'into';
      } else if(n.kind==='folder'){
        zone = relY < 0.3 ? 'before' : (relY > 0.7 ? 'after' : 'into');
      } else {
        zone = relY < 0.5 ? 'before' : 'after';
      }
      row.dataset.dropZone = zone;
      row.classList.toggle('drag-over', zone==='into');
      row.classList.toggle('drop-before', zone==='before');
      row.classList.toggle('drop-after', zone==='after');
    });
    row.addEventListener('dragleave', function(){ row.classList.remove('drag-over','drop-before','drop-after'); delete row.dataset.dropZone; });
    row.addEventListener('drop', function(e){
      e.preventDefault(); e.stopPropagation();
      var zone = row.dataset.dropZone || 'into';
      row.classList.remove('drag-over','drop-before','drop-after');
      delete row.dataset.dropZone;
      if(!draggedIds) return;
      if(zone==='into'){
        var targetId = S.isFolderLike(n) ? n.id : n.parentId;
        S.moveNodesToPosition(draggedIds, targetId, null);
      } else {
        var beforeId = zone==='before' ? n.id : S.siblingAfter(n);
        S.moveNodesToPosition(draggedIds, n.parentId, beforeId);
      }
      draggedIds = null;
      renderAll();
      persist();
    });

    return row;
  }

  function renderNodeRec(id, container, search){
    var n = S.state.nodes.get(id);
    if(!n) return;
    if(search.active && n.kind!=='root' && !search.match.has(id) && !search.expand.has(id)) return;

    var row = buildRow(n, search);
    container.appendChild(row);
    flatVisible.push(id);

    var kids = S.childrenOf(id);
    var forceExpand = search.active && search.expand.has(id);
    var isCollapsed = S.state.collapsed.has(id) && !forceExpand;
    if(S.isFolderLike(n) && kids.length>0 && !isCollapsed){
      var kidsC = document.createElement('div'); kidsC.className='children';
      kids.forEach(function(c){ renderNodeRec(c.id, kidsC, search); });
      if(kidsC.children.length>0) container.appendChild(kidsC);
    }
  }

  function renderTree(){
    var search = computeSearch();
    treePanel.innerHTML='';
    flatVisible = [];
    renderNodeRec(1, treePanel, search);
    countBadge.textContent = (S.state.nodes.size-1) + ' Einträge';
    updateButtons();
  }

  function updateButtons(){
    var real = Array.from(S.state.selectedIds).filter(function(id){ return id!==1; });
    document.getElementById('btn-edit').disabled = real.length!==1;
    document.getElementById('btn-delete').disabled = real.length===0;
    document.getElementById('btn-copy').disabled = real.length===0;
    document.getElementById('btn-paste').disabled = !S.state.clipboard || S.state.clipboard.ids.length===0;
    var undoBtn = document.getElementById('btn-undo');
    if(undoBtn) undoBtn.disabled = !S.canUndo();
  }

  function renderAll(){ renderTree(); renderSide('info'); }

  // ==================== Seitenpanel: Ordner-Auswahl ====================
  function buildFolderOptions(sel, excludeSubtreeOf){
    sel.innerHTML='';
    var excluded = new Set();
    if(excludeSubtreeOf!==null && excludeSubtreeOf!==undefined) S.collectSubtree(excludeSubtreeOf, excluded);
    if(!excluded.has(1)){
      var rootOpt=document.createElement('option'); rootOpt.value=1; rootOpt.textContent='Meine Favoriten (oberste Ebene)';
      sel.appendChild(rootOpt);
    }
    Array.from(S.state.nodes.values()).filter(function(n){ return n.kind==='folder'; })
      .sort(function(a,b){ return a.id-b.id; })
      .forEach(function(n){
        if(excluded.has(n.id)) return;
        var o=document.createElement('option'); o.value=n.id; o.textContent=S.folderPath(n.id);
        sel.appendChild(o);
      });
  }

  // ==================== TCode-Validierung (Transaktions-Formular) ======
  function wireTcodeField(tcodeInput, textInput, statusEl, datalistEl, initialCode){
    function applyLookup(){
      var code = tcodeInput.value.trim().toUpperCase();
      if(!code){
        statusEl.className='status-line neutral'; statusEl.textContent='Code eingeben, um gegen die TCode-Datenbank zu prüfen.';
        textInput.readOnly = false;
        return;
      }
      var hit = S.lookupTcode(code);
      if(hit!==null){
        textInput.value = hit;
        textInput.readOnly = true;
        statusEl.className='status-line ok';
        statusEl.textContent = '✓ in TCode-Datenbank gefunden – Text wird automatisch übernommen.';
      } else {
        textInput.readOnly = false;
        if(S.state.tcodeDb.size===0){
          statusEl.className='status-line neutral';
          statusEl.textContent = 'Keine TCode-Datenbank geladen – Text bitte manuell eingeben.';
        } else {
          statusEl.className='status-line warn';
          statusEl.textContent = '⚠ Code nicht in der TCode-Datenbank gefunden – Text bitte manuell eingeben und prüfen.';
        }
      }
    }
    tcodeInput.addEventListener('input', function(){
      var prefix = tcodeInput.value.trim();
      if(datalistEl){
        datalistEl.innerHTML='';
        S.searchTcodes(prefix, 50).forEach(function(item){
          var o=document.createElement('option');
          o.value = item.code;
          o.textContent = item.code+' – '+item.text;
          datalistEl.appendChild(o);
        });
      }
      applyLookup();
    });
    if(initialCode) applyLookup();
  }

  // ==================== Seitenpanel: Duplikate ====================
  function renderDuplicates(){
    var h=document.createElement('h2'); h.textContent='Duplikate'; sidePanel.appendChild(h);
    var dupes = S.findDuplicates();
    if(dupes.length===0){
      var p=document.createElement('div'); p.className='placeholder';
      p.textContent='Keine doppelten Transaktionen oder OT-Objekte gefunden.';
      sidePanel.appendChild(p);
    } else {
      dupes.forEach(function(entry){
        var sig=entry[0], list=entry[1];
        var g=document.createElement('div'); g.className='dup-group';
        var t=document.createElement('div'); t.className='dup-title'; t.textContent=sig+' ('+list.length+'×)';
        g.appendChild(t);
        list.forEach(function(n){
          var row=document.createElement('div'); row.className='dup-occ';
          var label=document.createElement('span'); label.textContent=S.folderPath(n.parentId);
          var btn=document.createElement('button'); btn.textContent='Anzeigen';
          btn.addEventListener('click', function(){
            S.state.selectedIds=new Set([n.id]); S.state.lastAnchorId=n.id;
            var p2=n.parentId; while(p2){ S.state.collapsed.delete(p2); var pn=S.state.nodes.get(p2); if(!pn) break; p2=pn.parentId; }
            renderAll();
          });
          row.appendChild(label); row.appendChild(btn);
          g.appendChild(row);
        });
        sidePanel.appendChild(g);
      });
    }
    var back=document.createElement('div'); back.className='panel-actions';
    var b=document.createElement('button'); b.textContent='Zurück'; b.addEventListener('click', function(){ renderSide('info'); });
    back.appendChild(b); sidePanel.appendChild(back);
  }

  // ==================== Seitenpanel: Info / Auswahl ====================
  function triggerToolbar(id){ var el=document.getElementById(id); if(el) el.click(); }

  function renderInfo(){
    var real = Array.from(S.state.selectedIds).filter(function(id){ return id!==1; });

    if(real.length===1){
      var n = S.state.nodes.get(real[0]);
      var h=document.createElement('h2'); h.textContent = n.kind==='folder' ? 'Ordner' : (n.rtype==='TR' ? 'Transaktion' : 'OT-Objekt');
      sidePanel.appendChild(h);

      var card = document.createElement('div'); card.className='detail-card';
      var title = document.createElement('div'); title.className='detail-title';
      title.textContent = n.kind==='folder' ? n.text : (n.tcode || '(ohne Code)');
      card.appendChild(title);
      if(n.kind==='entry'){
        var desc = document.createElement('div'); desc.className='detail-desc'; desc.textContent = n.text || '(ohne Bezeichnung)';
        card.appendChild(desc);
      }
      var meta = document.createElement('div'); meta.className='detail-meta';
      meta.textContent = 'Ordner: '+S.folderPath(n.parentId);
      card.appendChild(meta);
      if(n.kind==='entry' && n.rtype!=='TR' && n.url){
        var urlLine = document.createElement('div'); urlLine.className='detail-meta';
        var linkHref = toHref(n.url);
        if(linkHref){
          urlLine.appendChild(document.createTextNode('URL: '));
          var a=document.createElement('a'); a.href=linkHref; a.target='_blank'; a.rel='noopener noreferrer';
          a.textContent=n.url; a.className='detail-link';
          urlLine.appendChild(a);
        } else {
          urlLine.textContent = (n.fioriSemObj ? 'Fiori-Intent: ' : 'Wert: ')+n.url;
        }
        card.appendChild(urlLine);
      }
      sidePanel.appendChild(card);

      var actions=document.createElement('div'); actions.className='panel-actions';
      var editBtn=document.createElement('button'); editBtn.className='primary'; editBtn.textContent='✎ Bearbeiten';
      editBtn.addEventListener('click', function(){ triggerToolbar('btn-edit'); });
      var copyBtn=document.createElement('button'); copyBtn.textContent='⧉ Kopieren';
      copyBtn.addEventListener('click', function(){ triggerToolbar('btn-copy'); });
      var delBtn=document.createElement('button'); delBtn.className='danger'; delBtn.textContent='🗑 Löschen';
      delBtn.addEventListener('click', function(){ triggerToolbar('btn-delete'); });
      actions.appendChild(editBtn); actions.appendChild(copyBtn); actions.appendChild(delBtn);
      if(n.kind==='folder' && S.childrenOf(n.id).length>1){
        var sortBtn=document.createElement('button'); sortBtn.textContent='🔤 Sortieren (A-Z)';
        sortBtn.title = 'Ordner und Einträge in diesem Ordner alphabetisch sortieren';
        sortBtn.addEventListener('click', function(){
          S.sortChildren(n.id, false);
          persist(); renderTree(); renderSide('info');
        });
        actions.appendChild(sortBtn);
      }
      sidePanel.appendChild(actions);

      var hint=document.createElement('div'); hint.className='placeholder detail-hint';
      hint.textContent = 'Doppelklick auf Name'+(n.kind==='entry'&&n.rtype==='TR'?' oder Code':'')+' zum schnellen Umbenennen, oder per Drag & Drop in einen anderen Ordner verschieben.';
      sidePanel.appendChild(hint);

    } else if(real.length>1){
      var h2=document.createElement('h2'); h2.textContent='Mehrfachauswahl'; sidePanel.appendChild(h2);
      var info=document.createElement('div'); info.className='target-line';
      info.innerHTML = '<b>'+real.length+' Elemente ausgewählt.</b><br>Ziel für „Einfügen“: '+escapeHtml(S.folderPath(S.effectiveTargetFolder()));
      sidePanel.appendChild(info);

      var actions2=document.createElement('div'); actions2.className='panel-actions';
      var copyBtn2=document.createElement('button'); copyBtn2.textContent='⧉ Kopieren';
      copyBtn2.addEventListener('click', function(){ triggerToolbar('btn-copy'); });
      var delBtn2=document.createElement('button'); delBtn2.className='danger'; delBtn2.textContent='🗑 Löschen';
      delBtn2.addEventListener('click', function(){ triggerToolbar('btn-delete'); });
      actions2.appendChild(copyBtn2); actions2.appendChild(delBtn2);
      sidePanel.appendChild(actions2);

      var p2=document.createElement('div'); p2.className='placeholder';
      p2.textContent = 'Strg/Cmd+Klick zum Erweitern, Umschalt+Klick für Bereichsauswahl. Gemeinsames Verschieben per Drag & Drop.';
      sidePanel.appendChild(p2);

    } else if(S.state.selectedIds.has(1)){
      var h4=document.createElement('h2'); h4.textContent='Oberste Ebene'; sidePanel.appendChild(h4);
      var card4 = document.createElement('div'); card4.className='detail-card';
      var title4 = document.createElement('div'); title4.className='detail-title'; title4.textContent='Meine Favoriten';
      card4.appendChild(title4);
      var meta4 = document.createElement('div'); meta4.className='detail-meta';
      meta4.textContent = S.childrenOf(1).length+' Element(e) auf oberster Ebene';
      card4.appendChild(meta4);
      sidePanel.appendChild(card4);

      if(S.childrenOf(1).length>1){
        var actions4=document.createElement('div'); actions4.className='panel-actions';
        var sortBtn4=document.createElement('button'); sortBtn4.textContent='🔤 Sortieren (A-Z)';
        sortBtn4.title = 'Oberste Ebene alphabetisch sortieren';
        sortBtn4.addEventListener('click', function(){
          S.sortChildren(1, false);
          persist(); renderTree(); renderSide('info');
        });
        actions4.appendChild(sortBtn4);
        sidePanel.appendChild(actions4);
      }

      var hint4=document.createElement('div'); hint4.className='placeholder detail-hint';
      hint4.textContent = 'Neue Ordner/Einträge werden hier auf oberster Ebene angelegt.';
      sidePanel.appendChild(hint4);

    } else {
      var h3=document.createElement('h2'); h3.textContent='Auswahl'; sidePanel.appendChild(h3);
      var info3=document.createElement('div'); info3.className='target-line';
      info3.innerHTML = '<b>Ziel für neue Einträge:</b><br>'+escapeHtml(S.folderPath(S.effectiveTargetFolder()));
      sidePanel.appendChild(info3);
      var p3=document.createElement('div'); p3.className='placeholder';
      p3.textContent = 'Wähle links einen Ordner oder Eintrag aus, um Details zu sehen und zu bearbeiten. Ohne Auswahl wird auf oberster Ebene angelegt.';
      sidePanel.appendChild(p3);
    }

    var dbInfo = document.createElement('div');
    dbInfo.className = 'tcode-db-status'+(S.state.tcodeDb.size>0?' loaded':'');
    dbInfo.textContent = S.state.tcodeDb.size>0
      ? 'TCode-Datenbank: '+S.state.tcodeDb.size+' Codes geladen'+(S.state.tcodeDbLabel?' ('+S.state.tcodeDbLabel+')':'')
      : 'Keine TCode-Datenbank geladen – Transaktionstexte müssen manuell eingegeben werden.';
    sidePanel.appendChild(dbInfo);
  }

  // ==================== Seitenpanel: Formulare (Ordner/TR/OT/Edit) =====
  function renderForm(mode, ctx){
    var editingNode = mode==='edit' ? S.state.nodes.get(ctx) : null;
    var h=document.createElement('h2');
    h.textContent = mode==='add-folder' ? 'Neuer Ordner' : mode==='add-tr' ? 'Neue Transaktion' : mode==='add-ot' ? 'Neues OT-Objekt' : 'Eintrag bearbeiten';
    sidePanel.appendChild(h);

    if(mode!=='edit'){
      var tgt=document.createElement('div'); tgt.className='target-line';
      tgt.innerHTML='<b>Wird angelegt in:</b><br>'+escapeHtml(S.folderPath(S.effectiveTargetFolder()));
      sidePanel.appendChild(tgt);
    }

    var form = document.createElement('div');
    var kind = mode==='edit' ? editingNode.kind : (mode==='add-folder' ? 'folder' : 'entry');
    var rtype = mode==='edit' ? editingNode.rtype : (mode==='add-tr' ? 'TR' : mode==='add-ot' ? 'OT' : null);

    var tcodeInput=null, textInput=null, statusEl=null, datalistEl=null;
    var otKindSel=null, otUrlField=null, otFioriWrap=null, semObjInput=null, actionInput=null, fioriPreview=null;

    if(kind==='entry' && rtype==='TR'){
      var f1=document.createElement('div'); f1.className='field';
      f1.innerHTML='<label for="f-tcode">Transaktionscode</label>';
      tcodeInput=document.createElement('input'); tcodeInput.id='f-tcode'; tcodeInput.maxLength=40; tcodeInput.setAttribute('data-mono','1');
      tcodeInput.setAttribute('list','tcode-datalist');
      tcodeInput.value = editingNode ? (editingNode.tcode||'') : '';
      tcodeInput.placeholder='z.B. SE16N';
      f1.appendChild(tcodeInput);
      datalistEl = document.createElement('datalist'); datalistEl.id='tcode-datalist';
      f1.appendChild(datalistEl);
      form.appendChild(f1);
    } else if(kind==='entry' && rtype!=='TR'){
      var isFioriInit = !!(editingNode && editingNode.fioriSemObj);
      var f1b=document.createElement('div'); f1b.className='field';
      f1b.innerHTML='<label for="f-tcode">Objektname (TCODE-Feld)</label>';
      tcodeInput=document.createElement('input'); tcodeInput.id='f-tcode'; tcodeInput.maxLength=40; tcodeInput.setAttribute('data-mono','1');
      tcodeInput.value = isFioriInit ? OT_TCODE_DEFAULT_FIORI : OT_TCODE_DEFAULT_URL;
      tcodeInput.readOnly = true;
      f1b.appendChild(tcodeInput);
      var hint0=document.createElement('div'); hint0.className='hint'; hint0.textContent='Fest vorgegeben durch die Art des Objekts (siehe unten): "'+OT_TCODE_DEFAULT_URL+'" bei freier URL, "'+OT_TCODE_DEFAULT_FIORI+'" bei Fiori-App.';
      f1b.appendChild(hint0);
      form.appendChild(f1b);
    }


    var fd=document.createElement('div'); fd.className='field';
    fd.innerHTML='<label for="f-text">'+(kind==='folder'?'Ordnername':'Bezeichnung')+'</label>';
    textInput=document.createElement('input'); textInput.id='f-text'; textInput.maxLength=132;
    textInput.value = editingNode ? (editingNode.text||'') : '';
    textInput.placeholder = kind==='folder' ? 'z.B. Zoll & Außenhandel' : 'z.B. Data Browser aufrufen';
    fd.appendChild(textInput);
    form.appendChild(fd);

    if(kind==='entry' && rtype==='TR'){
      statusEl = document.createElement('div'); statusEl.className='status-line neutral';
      statusEl.textContent = 'Code eingeben, um gegen die TCode-Datenbank zu prüfen.';
      form.appendChild(statusEl);
    }

    // ---- OT: Auswahl Freie URL vs. Fiori-App -------------------------
    if(kind==='entry' && rtype!=='TR'){
      var isFiori = !!(editingNode && editingNode.fioriSemObj);
      var fSel=document.createElement('div'); fSel.className='field';
      fSel.innerHTML='<label for="f-otkind">Art des Objekts</label>';
      otKindSel=document.createElement('select'); otKindSel.id='f-otkind';
      var opt1=document.createElement('option'); opt1.value='url'; opt1.textContent='Freie URL / Parameter';
      var opt2=document.createElement('option'); opt2.value='fiori'; opt2.textContent='Fiori-App (Semantisches Objekt + Action)';
      otKindSel.appendChild(opt1); otKindSel.appendChild(opt2);
      otKindSel.value = isFiori ? 'fiori' : 'url';
      fSel.appendChild(otKindSel);
      form.appendChild(fSel);

      // Freie URL
      var fUrl=document.createElement('div'); fUrl.className='field'; fUrl.id='wrap-url';
      fUrl.innerHTML='<label for="f-url">URL / Parameter</label>';
      otUrlField=document.createElement('input'); otUrlField.id='f-url';
      otUrlField.value = editingNode && !isFiori ? (editingNode.url||'') : '';
      otUrlField.placeholder='z.B. https://… oder ein Bereichsmenü-/Objektcode';
      fUrl.appendChild(otUrlField);
      var hintUrl=document.createElement('div'); hintUrl.className='hint'; hintUrl.textContent='Wird 1:1 in das URL-Feld der SAP-Favoritendatei geschrieben.';
      fUrl.appendChild(hintUrl);
      form.appendChild(fUrl);

      // Fiori-Felder
      otFioriWrap = document.createElement('div'); otFioriWrap.id='wrap-fiori';
      var fSem=document.createElement('div'); fSem.className='field';
      fSem.innerHTML='<label for="f-semobj">Semantisches Objekt</label>';
      semObjInput=document.createElement('input'); semObjInput.id='f-semobj'; semObjInput.setAttribute('data-mono','1');
      semObjInput.value = editingNode ? (editingNode.fioriSemObj||'') : '';
      semObjInput.placeholder='z.B. SalesOrder';
      fSem.appendChild(semObjInput);
      otFioriWrap.appendChild(fSem);

      var fAct=document.createElement('div'); fAct.className='field';
      fAct.innerHTML='<label for="f-action">Action</label>';
      actionInput=document.createElement('input'); actionInput.id='f-action'; actionInput.setAttribute('data-mono','1');
      actionInput.value = editingNode ? (editingNode.fioriAction||'') : '';
      actionInput.placeholder='z.B. create';
      fAct.appendChild(actionInput);
      otFioriWrap.appendChild(fAct);

      fioriPreview = document.createElement('div'); fioriPreview.className='status-line neutral';
      otFioriWrap.appendChild(fioriPreview);
      form.appendChild(otFioriWrap);

      function updateFioriPreview(){
        var so=semObjInput.value.trim(), ac=actionInput.value.trim();
        fioriPreview.textContent = (so||ac) ? ('Intent-URL: #'+so+'-'+ac) : 'Semantisches Objekt und Action eingeben, um die Intent-URL zu erzeugen.';
      }
      function updateOtKindVisibility(){
        var isF = otKindSel.value==='fiori';
        fUrl.style.display = isF ? 'none' : '';
        otFioriWrap.style.display = isF ? '' : 'none';
        tcodeInput.value = isF ? OT_TCODE_DEFAULT_FIORI : OT_TCODE_DEFAULT_URL;
        if(isF) updateFioriPreview();
      }
      otKindSel.addEventListener('change', updateOtKindVisibility);
      semObjInput.addEventListener('input', updateFioriPreview);
      actionInput.addEventListener('input', updateFioriPreview);
      updateOtKindVisibility();
    }

    if(mode==='edit'){
      var fp=document.createElement('div'); fp.className='field';
      fp.innerHTML='<label for="f-parent">'+(kind==='folder'?'Übergeordneter Ordner':'Ordner')+'</label>';
      var sel=document.createElement('select'); sel.id='f-parent';
      buildFolderOptions(sel, kind==='folder' ? editingNode.id : null);
      sel.value = editingNode.parentId;
      fp.appendChild(sel); form.appendChild(fp);
    }

    sidePanel.appendChild(form);

    var actions=document.createElement('div'); actions.className='panel-actions';
    var saveBtn=document.createElement('button'); saveBtn.className='primary';
    saveBtn.textContent = mode==='edit' ? 'Speichern' : 'Anlegen';
    saveBtn.addEventListener('click', function(){
      submitForm(mode, editingNode, kind, rtype, {
        tcodeInput:tcodeInput, textInput:textInput, otKindSel:otKindSel,
        otUrlField:otUrlField, semObjInput:semObjInput, actionInput:actionInput
      });
    });
    var cancelBtn=document.createElement('button'); cancelBtn.textContent='Abbrechen';
    cancelBtn.addEventListener('click', function(){ renderSide('info'); });
    actions.appendChild(saveBtn); actions.appendChild(cancelBtn);
    sidePanel.appendChild(actions);

    if(kind==='entry' && rtype==='TR'){
      wireTcodeField(tcodeInput, textInput, statusEl, datalistEl, !!editingNode);
    }

    setTimeout(function(){ var first=form.querySelector('input'); if(first) first.focus(); },0);
  }

  function submitForm(mode, editingNode, kind, rtype, f){
    var text = f.textInput.value.trim();
    if(!text){ alert('Bitte einen Namen/eine Bezeichnung eingeben.'); return; }

    if(kind==='entry'){
      var tcode = f.tcodeInput.value.trim();
      if(!tcode){ alert('Bitte einen Code/Objektnamen eingeben.'); return; }
      var url = '', fioriSemObj='', fioriAction='';
      if(rtype!=='TR'){
        if(f.otKindSel.value==='fiori'){
          fioriSemObj = f.semObjInput.value.trim();
          fioriAction = f.actionInput.value.trim();
          if(!fioriSemObj || !fioriAction){ alert('Bitte Semantisches Objekt und Action angeben.'); return; }
          url = '#'+fioriSemObj+'-'+fioriAction;
        } else {
          url = f.otUrlField.value.trim();
        }
      }
      var parentId = null;
      var selEl = document.getElementById('f-parent');
      if(selEl) parentId = parseInt(selEl.value,10);

      var targetId;
      if(mode==='edit'){
        S.editEntry(editingNode.id, tcode, text, url, parentId);
        editingNode.fioriSemObj = fioriSemObj; editingNode.fioriAction = fioriAction;
        targetId = editingNode.id;
      } else {
        targetId = S.addEntry(rtype, tcode, text, url, S.effectiveTargetFolder());
        var n = S.state.nodes.get(targetId);
        n.fioriSemObj = fioriSemObj; n.fioriAction = fioriAction;
      }
      S.state.selectedIds = new Set([targetId]); S.state.lastAnchorId = targetId;
    } else {
      var selEl2 = document.getElementById('f-parent');
      var parentId2 = selEl2 ? parseInt(selEl2.value,10) : null;
      var targetId2;
      if(mode==='edit'){
        S.editFolder(editingNode.id, text, parentId2);
        targetId2 = editingNode.id;
      } else {
        targetId2 = S.addFolder(text, S.effectiveTargetFolder());
      }
      S.state.selectedIds = new Set([targetId2]); S.state.lastAnchorId = targetId2;
    }

    renderTree(); renderSide('info'); persist();
  }

  // ==================== Dispatcher ====================
  function renderSide(mode, ctx){
    mode = mode || 'info';
    sidePanel.innerHTML='';
    if(mode==='duplicates') renderDuplicates();
    else if(mode==='info') renderInfo();
    else renderForm(mode, ctx);
  }

  global.UI = {
    init: init,
    renderTree: renderTree,
    renderSide: renderSide,
    renderAll: renderAll,
    setFooter: setFooter,
    escapeHtml: escapeHtml,
    getDraggedIds: function(){ return draggedIds; },
    clearDraggedIds: function(){ draggedIds=null; }
  };

})(window);
