/* ====================================================================
   format.js
   Alles, was mit dem SAP-Austauschformat von MENU_FAVORITES_DOWNLOAD /
   MENU_FAVORITES_UPLOAD zu tun hat (Strukturen SMEN_BUFFC / SMEN_BUFFI).

   Zeilenlayout (fix, ohne Zeilenumbruch):
     RTYPE(2) PARENT_ID(5) OBJECT_ID(5) TCODE(40) <8 reserviert> TEXT(132) [URL variabel]

   RTYPE:  '  ' (2 Leerzeichen) = Ordner
           'TR'                  = Transaktion
           'OT' (oder anderer 2-stelliger Code) = sonstiges Objekt (z.B. Web-Adresse)

   OBJECT_IDs dürfen beim Export frei neu vergeben werden, da SAP diese
   beim Upload ohnehin neu mapped (PARENT_ID/OBJECT_ID sind nur innerhalb
   der Datei relevant, nicht persistent).

   Reine Funktionen, kein DOM-Zugriff -> global unter window.SapFormat.
   ==================================================================== */
(function(global){
  "use strict";

  // ---- cp1252 <-> Unicode -------------------------------------------
  // Byte-Bereich 0x80-0x9F weicht von Latin-1 ab, Rest ist 1:1 gleich.
  var CP1252_HIGH = {
    0x80:0x20AC, 0x82:0x201A, 0x83:0x0192, 0x84:0x201E, 0x85:0x2026, 0x86:0x2020, 0x87:0x2021,
    0x88:0x02C6, 0x89:0x2030, 0x8A:0x0160, 0x8B:0x2039, 0x8C:0x0152, 0x8E:0x017D, 0x91:0x2018,
    0x92:0x2019, 0x93:0x201C, 0x94:0x201D, 0x95:0x2022, 0x96:0x2013, 0x97:0x2014, 0x98:0x02DC,
    0x99:0x2122, 0x9A:0x0161, 0x9B:0x203A, 0x9C:0x0153, 0x9E:0x017E, 0x9F:0x0178
  };
  var CP1252_HIGH_REV = {};
  Object.keys(CP1252_HIGH).forEach(function(k){ CP1252_HIGH_REV[CP1252_HIGH[k]] = parseInt(k,10); });

  function encodeCp1252(str){
    var bytes = [];
    for(var i=0;i<str.length;i++){
      var cp = str.charCodeAt(i);
      if(cp<0x80 || (cp>=0xA0 && cp<=0xFF)) bytes.push(cp);
      else if(CP1252_HIGH_REV[cp]!==undefined) bytes.push(CP1252_HIGH_REV[cp]);
      else bytes.push(0x3F); // '?' Fallback für nicht darstellbare Zeichen
    }
    return new Uint8Array(bytes);
  }

  function decodeCp1252(bytes){
    try{
      return new TextDecoder('windows-1252').decode(bytes);
    }catch(e){
      var s='';
      for(var i=0;i<bytes.length;i++){
        var b=bytes[i];
        s += String.fromCharCode(CP1252_HIGH[b]!==undefined ? CP1252_HIGH[b] : b);
      }
      return s;
    }
  }

  // ---- Feldbreiten -----------------------------------------------------
  var W_TYPE=2, W_PARENT=5, W_OBJ=5, W_TCODE=40, W_GAP=8, W_TEXT=132;
  var FIXED_LEN = W_TYPE+W_PARENT+W_OBJ+W_TCODE+W_GAP+W_TEXT; // 192

  function padRight(s,len){ s=(s||'').slice(0,len); return s+' '.repeat(len-s.length); }
  function zeroPad(n,len){ return String(n).padStart(len,'0'); }

  // ---- Parsen: Text (bereits cp1252-dekodiert) -> {nodes, nextId} -------
  // node: {id, parentId, kind:'folder'|'entry', rtype, tcode, text, url}
  function parseSapFile(text){
    var nodes = new Map();
    nodes.set(1, {id:1, parentId:0, kind:'root', rtype:null, tcode:'', text:'Meine Favoriten', url:''});
    var maxId = 1;
    var lines = text.split(/\r\n|\n|\r/);
    for(var li=0; li<lines.length; li++){
      var raw = lines[li];
      if(!raw || !raw.trim()) continue;
      if(raw.length < FIXED_LEN) continue; // unbekanntes/zu kurzes Format überspringen
      var rtypeRaw = raw.slice(0,2);
      var parentId = parseInt(raw.slice(2,7),10);
      var objectId = parseInt(raw.slice(7,12),10);
      if(!isFinite(parentId) || !isFinite(objectId)) continue;
      var tcode = raw.slice(12,52).replace(/\s+$/,'');
      var textField = raw.slice(60,192).replace(/\s+$/,'');
      var url = raw.slice(192);
      var isFolder = rtypeRaw === '  ';
      nodes.set(objectId, {
        id: objectId, parentId: parentId,
        kind: isFolder ? 'folder' : 'entry',
        rtype: isFolder ? null : rtypeRaw,
        tcode: isFolder ? '' : tcode,
        text: textField,
        url: isFolder ? '' : url,
        order: objectId
      });
      if(objectId>maxId) maxId=objectId;
    }
    return {nodes: nodes, nextId: maxId+1};
  }

  // ---- Export: nodes-Map -> Text (noch nicht cp1252-kodiert) -----------
  function buildSapExport(nodes){
    var list = [];
    nodes.forEach(function(n){ if(n.id!==1) list.push(n); });
    list.sort(function(a,b){ return a.id-b.id; });

    var remap = new Map(); remap.set(1,1);
    list.forEach(function(n,i){ remap.set(n.id, i+2); });

    var lines = list.map(function(n){
      var rtype = n.kind==='folder' ? '  ' : padRight(n.rtype||'TR', W_TYPE);
      var tcodeField = n.kind==='folder' ? ' '.repeat(W_TCODE) : padRight(n.tcode||'', W_TCODE);
      var parent = remap.get(n.parentId) || 1;
      var id = remap.get(n.id);
      var base = rtype + zeroPad(parent,W_PARENT) + zeroPad(id,W_OBJ) + tcodeField + ' '.repeat(W_GAP) + padRight(n.text||'', W_TEXT);
      var url = (n.kind==='entry' && n.rtype==='OT') ? (n.url||'') : '';
      return base + url;
    });
    return lines.join('\r\n') + '\r\n';
  }

  global.SapFormat = {
    encodeCp1252: encodeCp1252,
    decodeCp1252: decodeCp1252,
    parseSapFile: parseSapFile,
    buildSapExport: buildSapExport,
    padRight: padRight,
    zeroPad: zeroPad,
    FIXED_LEN: FIXED_LEN,
    WIDTHS: {type:W_TYPE, parent:W_PARENT, obj:W_OBJ, tcode:W_TCODE, gap:W_GAP, text:W_TEXT}
  };

})(window);
