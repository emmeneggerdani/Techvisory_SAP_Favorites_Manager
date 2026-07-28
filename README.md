<p align="center">
  <img src="assets/Techvisory_Logo.png" alt="Techvisory" height="60">
</p>

# SAP Favoriten-Manager

Ein kleines, kostenloses Tool, mit dem sich SAP-Favoriten (Ordner,
Transaktionen, Web-Adressen, Fiori-Apps) bequem am Computer bearbeiten
lassen – mit Suche, Drag & Drop, Sortieren, Rückgängig-Funktion und
mehreren Profilen für unterschiedliche SAP-Systeme.

Es läuft direkt im Browser. Es muss nichts installiert werden, es gibt
keine Zugriffe auf das Internet und keinen Server – alle Daten
bleiben auf dem eigenen Rechner (auch Logo und Favicon liegen lokal
im Ordner `assets/`).

## Schnellstart

1. Ordner mit den Dateien herunterladen/entpacken.
2. Datei **`index.html`** doppelklicken – öffnet sich im
   Standard-Browser (empfohlen: **Chrome** oder **Edge**, siehe
   [Hinweis zu Firefox/Safari](#hinweis-für-firefox--safari-nutzerinnen)).
3. Entweder eine bestehende Favoriten-Datei aus SAP GUI laden (Button
   **„SAP-Favoriten laden"**), oder direkt links im Baum neue Ordner
   und Einträge anlegen.
4. Fertig bearbeitet? Über **„SAP-Favoriten exportieren"** eine Datei
   erzeugen und in SAP GUI unter *Favoriten → Favoriten hochladen*
   wieder einspielen.

## Was man damit tun kann

**Favoriten bearbeiten**
- Ordner, Transaktionen und sonstige Objekte anlegen, umbenennen,
  verschieben und löschen.
- Schnell umbenennen: Doppelklick auf den Namen (oder bei
  Transaktionen auf den Code) direkt im Baum – Enter bestätigt,
  Escape bricht ab.
- Per Drag & Drop in andere Ordner ziehen, auch mehrere Einträge
  gleichzeitig (Mehrfachauswahl mit Strg/Cmd-Klick oder
  Umschalt-Klick).
- Kopieren & Einfügen (auch ganze Unterordner mit Inhalt).
- Rückgängig machen (`Strg+Z` bzw. `Cmd+Z`) – jede Änderung lässt
  sich Schritt für Schritt zurücknehmen.
- Sortieren: ein Ordner (Button im rechten Panel) oder der ganze Baum
  auf einmal (⚙ Einstellungen), alphabetisch, Ordner zuerst.
- Suche über Name, Code oder URL.
- Duplikate finden – zeigt Transaktionen/Objekte, die mehrfach an
  verschiedenen Stellen im Baum vorkommen.

**Bei Transaktionen und Web-Adressen unterstützt es**
- Prüfung des Transaktionscodes gegen eine Liste bekannter
  Transaktionen (siehe [TCode-Datenbank](#tcode-datenbank)) –
  die Bezeichnung wird dann automatisch eingetragen.
- Web-Adressen mit `http(s)://` sind im Baum direkt anklickbar.
- Fiori-Apps lassen sich über *Semantisches Objekt* und *Action*
  anlegen, ohne die Intent-URL von Hand zusammenzubauen (siehe
  [Fiori-Apps](#fiori-apps)).

**Mehrere Systeme**
- Über die **Profile**-Leiste lassen sich mehrere, komplett
  unabhängige Favoriten-Listen anlegen – praktisch, wenn man z. B.
  ein Profil pro SAP-System oder Mandant (PRD/QAS/DEV) führen möchte.
  Jedes Profil kann mit einer eigenen Datei verknüpft sein.

## Wie die Daten gespeichert werden

Der einfachste und empfohlene Weg: Auf **„🔗 Verbinden"** klicken
(direkt unter der Symbolleiste). Danach wählt man eine Datei auf dem
eigenen Rechner aus (oder legt eine neue an) – ab dann speichert das
Tool jede Änderung automatisch dort hinein und liest sie beim nächsten
Öffnen automatisch wieder ein. Man muss sich um nichts weiter kümmern.

> Aus Sicherheitsgründen fragt der Browser nach jedem Neu-Öffnen der
> Seite einmal kurz nach, ob der Zugriff auf die Datei erlaubt ist
> (Button „🔓 Zugriff erlauben"). Das ist eine Vorgabe des Browsers,
> keine Einschränkung des Tools.

Zusätzlich merkt sich der Browser den aktuellen Stand automatisch im
Hintergrund, auch ohne Verknüpfung – als Sicherheitsnetz.

Für alles Weitere (manuelle Sicherungskopie als Datei, TCode-Datenbank
einmalig laden, alles zurücksetzen) gibt es das **⚙ Einstellungen**-Menü
oben rechts.

### Hinweis für Firefox-/Safari-Nutzer:innen

Die automatische Datei-Verknüpfung funktioniert technisch nur in
Chrome, Edge und Opera. In Firefox und Safari blendet sich die
Verbindungsleiste deshalb automatisch aus – hier über das
**⚙ Einstellungen**-Menü mit **„JSON speichern"** regelmässig eine
Sicherungskopie herunterladen und bei Bedarf mit **„JSON laden"**
wieder einlesen.

## TCode-Datenbank

Damit beim Anlegen einer Transaktion die Bezeichnung automatisch
erscheint (und offensichtliche Tippfehler auffallen), kann eine Liste
aller bekannten Transaktionscodes hinterlegt werden – entweder dauerhaft
verknüpft (🔗 Verbinden, lädt automatisch beim Öffnen) oder einmalig
über ⚙ Einstellungen.

Diese Liste ist eine einfache JSON-Datei, zum Beispiel:

```json
[
  { "tcode": "SE16N", "text": "Data Browser" },
  { "tcode": "SE38",  "text": "ABAP Editor" }
]
```

Ein Beispiel liegt unter [`data/tcodes.example.json`](data/tcodes.example.json).
Eine vollständige Liste lässt sich in SAP z. B. aus der Tabelle `TSTC`
(Transaktionscodes) zusammen mit `TSTCT` (Kurztexte) exportieren.

Ist ein eingegebener Code nicht in der Liste enthalten, erscheint ein
Hinweis, und die Bezeichnung kann ganz normal von Hand eingetragen
werden – es wird nichts blockiert.

## Fiori-Apps

Beim Anlegen eines Objekts kann zwischen **freier URL/Parameter** und
**Fiori-App** gewählt werden. Bei Fiori-App genügt es, *Semantisches
Objekt* und *Action* einzutragen (z. B. `SalesOrder` und `create`) –
das Tool baut daraus automatisch die passende Intent-Adresse
(`#SalesOrder-create`), die SAP zum Öffnen der App benötigt.

## Profile (mehrere Systeme/Mandanten)

Über die Profil-Leiste (oben, mit Dropdown) lassen sich beliebig viele
unabhängige Favoriten-Listen führen, z. B. eine je SAP-System. Jedes
Profil hat seine eigenen Ordner/Einträge und kann mit einer eigenen
Datei verknüpft sein; die TCode-Datenbank ist bewusst für alle Profile
gleich (sie ändert sich ja nicht pro System).

- **+ Neu** – legt ein leeres Profil an und wechselt direkt dorthin.
- **✎ Umbenennen** – ändert nur den angezeigten Namen.
- **🗑 Löschen** – entfernt das Profil und seinen lokal gespeicherten
  Stand (eine eventuell verknüpfte Datei bleibt auf der Festplatte
  erhalten). Das letzte verbleibende Profil lässt sich nicht löschen.

## Browser-Kompatibilität

Empfohlen: aktuelles **Chrome**, **Edge** oder **Opera** (für die
automatische Datei-Verknüpfung). Firefox und Safari funktionieren
ebenfalls, dann aber nur mit manueller JSON-Sicherung (siehe oben).

## Lizenz

[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0)
– vollständiger Text in [`LICENSE.md`](LICENSE.md).

Kurz zusammengefasst: frei nutzbar, veränderbar und weitergebbar für
**nicht-kommerzielle Zwecke**; kein Verkauf, keine kostenpflichtige
Bereitstellung. Die Software wird **ohne jede Gewährleistung** zur
Verfügung gestellt – Nutzung auf eigenes Risiko.

---

## Für Entwickler:innen

Die folgenden Abschnitte sind für alle interessant, die selbst am Code
weiterarbeiten oder das Dateiformat im Detail verstehen möchten. Zum
reinen Benutzen des Tools ist das nicht nötig.

### Projektstruktur

```
sap-favoriten-manager/
├── index.html               Einstiegspunkt – im Browser öffnen
├── css/
│   └── styles.css           Styles
├── js/
│   ├── format.js            SAP-Dateiformat: cp1252 De-/Encoding, Parsen/Export
│   ├── store.js             Datenmodell, CRUD, Undo, Profile, lokale Speicherung, TCode-DB
│   ├── filestore.js         Verknüpfung mit echten lokalen Dateien (File System Access API)
│   ├── ui.js                Rendering (Baum, Seitenpanel/Formulare, Inline-Edit)
│   └── main.js               Verdrahtung: Toolbar-Events, Datei-Dialoge, Start
├── assets/
│   ├── Techvisory_Logo.png   Logo (Header)
│   └── Techvisory_Kolibri.png  Favicon
└── data/
    └── tcodes.example.json  Beispiel für eine TCode-Datenbank
```

Die Skripte sind bewusst als klassische `<script src="…">`-Dateien
eingebunden (keine ES-Module), damit `index.html` auch per Doppelklick
über `file://` funktioniert – ES-Module blockieren Browser dort aus
Sicherheitsgründen (CORS), klassische Scripts nicht.

### Datenmodell

Jeder Baumknoten (`Store.state.nodes`, eine `Map`) hat u. a. die Felder
`id`, `parentId`, `kind` (`root`/`folder`/`entry`), `rtype` (`TR`/`OT`),
`tcode`, `text`, `url`, `order` (Sortier-Reihenfolge) sowie bei
Fiori-Apps zusätzlich `fioriSemObj`/`fioriAction`. `order` bestimmt die
Anzeigereihenfolge innerhalb eines Ordners; ist es nicht gesetzt
(ältere Datenstände), wird ersatzweise nach `id` sortiert.

Undo ist snapshot-basiert: `Store.pushUndo()` legt vor jeder Änderung
eine Kopie des kompletten Baums auf einen Stapel (max. 50 Schritte,
kein Redo).

### Profile & lokale Speicherung

Jedes Profil hat einen eigenen `localStorage`-Schlüssel
(`sap_fav_manager_v1:<profilId>`) sowie – falls verknüpft – einen
eigenen Datei-Handle in IndexedDB (`favorites:<profilId>`). Die
Profilliste selbst liegt unter `sap_fav_manager_profiles_v1`, ist aber
primär **im Arbeitsspeicher** die Quelle der Wahrheit (`Store.state.profiles`)
und wird nur bestmöglich nach `localStorage` gespiegelt – damit
Profile auch funktionieren, wenn `localStorage` blockiert ist (z. B.
in eingebetteten Vorschau-Umgebungen). Aus einer Version vor den
Profilen wird eine bestehende Einzel-Verknüpfung einmalig automatisch
in das Profil „Standard" übernommen.

### SAP-Dateiformat

Basiert auf den Strukturen `SMEN_BUFFC` / `SMEN_BUFFI`, wie sie von
`MENU_FAVORITES_DOWNLOAD` erzeugt und von `MENU_FAVORITES_UPLOAD`
gelesen werden. Jede Zeile ist ein fester Datensatz ohne Trennzeichen:

| Feld        | Länge      | Beschreibung                                             |
|-------------|-----------:|-----------------------------------------------------------|
| `RTYPE`     | 2          | leer = Ordner, `TR` = Transaktion, `OT` = sonstiges Objekt |
| `PARENT_ID` | 5          | `OBJECT_ID` des übergeordneten Ordners (`00001` = Wurzel)  |
| `OBJECT_ID` | 5          | eindeutige ID dieser Zeile                                 |
| `TCODE`     | 40         | Transaktionscode bzw. Objektname (bei Ordnern leer)        |
| *reserviert*| 8          | ungenutzt/immer leer                                       |
| `TEXT`      | 132        | Anzeigetext (Ordnername bzw. Bezeichnung)                   |
| `URL`       | variabel   | nur bei `OT`-Objekten belegt, direkt an Zeile angehängt      |

Zeilenumbruch `\r\n`, Zeichensatz `windows-1252` (deckt deutsche
Umlaute/ß ab).

`OBJECT_ID`/`PARENT_ID` dürfen beim Export frei neu vergeben werden –
SAP mappt sie beim Upload ohnehin neu. Das Tool nummeriert beim Export
durch, unabhängig von den beim Import eingelesenen IDs.

**Bekannte Einschränkung:** Ein mögliches zusätzliches `SAP_GUID`-Feld
nach dem `URL`-Feld wird derzeit nicht separat behandelt. In den bisher
getesteten Exporten trat es nicht auf; sollte eine SAP-Version es
mitschreiben, geht dieser Teil beim Round-Trip verloren.
