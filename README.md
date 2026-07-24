# SAP Favoriten-Manager

Ein kleines, rein lokales Tool zur Verwaltung von SAP-GUI-Favoriten
(Ordner, Transaktionen, sonstige Objekte) mit Baumansicht, Suche,
Drag & Drop, Mehrfachauswahl, Duplikat-Erkennung sowie Import/Export
im Format von `MENU_FAVORITES_DOWNLOAD` / `MENU_FAVORITES_UPLOAD`.

Läuft komplett im Browser – kein Server, kein Build-Schritt, keine
Abhängigkeiten. `index.html` einfach lokal öffnen.

## Funktionen

- **SAP-Favoriten Import/Export** – liest und schreibt das Textformat,
  das SAP GUI unter *Favoriten → Favoriten hochladen/herunterladen*
  verwendet (siehe [Dateiformat](#dateiformat)).
- **Baumstruktur** mit Ordnern, Transaktionen und sonstigen Objekten
  (`OT`), auf/zuklappbar.
- **Ordner anlegen / bearbeiten / löschen** (inkl. Verschieben in
  einen anderen Ordner).
- **Transaktionen anlegen**, geprüft gegen eine geladene
  [TCode-Datenbank](#tcode-datenbank) – Bezeichnung wird automatisch
  übernommen.
- **OT-Objekte anlegen**, wahlweise als freie URL/Parameter oder als
  **Fiori-App** über Semantisches Objekt + Action (siehe
  [Fiori-Intents](#fiori-apps-als-ot-objekt)).
- **Suche** über Code, Bezeichnung und URL, klappt Trefferpfade
  automatisch auf.
- **Drag & Drop** zum Verschieben einzelner oder mehrerer Einträge.
- **Kopieren/Einfügen**, auch für ganze Unterordner.
- **Mehrfachauswahl** (Strg/Cmd+Klick, Umschalt+Klick, `Entf`).
- **Duplikate finden** – gruppiert mehrfach vorkommende Transaktionen
  bzw. OT-Objekte (gleicher TCODE bzw. gleiche URL) über alle Ordner
  hinweg.
- **Lokale Speicherung**: automatisches Sichern im Browser
  (`localStorage`) sowie manuelles Backup/Restore als JSON-Datei.

## Projektstruktur

```
sap-favoriten-manager/
├── index.html              Einstiegspunkt – im Browser öffnen
├── css/
│   └── styles.css          Styles
├── js/
│   ├── format.js           SAP-Dateiformat: cp1252 De-/Encoding, Parsen/Export
│   ├── store.js             Datenmodell, CRUD, lokale Speicherung, TCode-DB
│   ├── filestore.js          Verknüpfung mit echten lokalen Dateien (File System Access API)
│   ├── ui.js                   Rendering (Baum, Seitenpanel/Formulare)
│   └── main.js                  Verdrahtung: Toolbar-Events, Datei-Dialoge, Start
└── data/
    └── tcodes.example.json  Beispiel für eine TCode-Datenbank (siehe unten)
```

Die Skripte sind bewusst als klassische `<script src="…">`-Dateien
eingebunden (keine ES-Module), damit `index.html` auch per Doppelklick
über `file://` funktioniert – ES-Module blockieren Browser dort aus
Sicherheitsgründen (CORS), klassische Scripts nicht.

## Nutzung

1. `index.html` im Browser öffnen (lokal per Doppelklick oder über
   einen beliebigen statischen Webserver).
2. Bestehende Favoriten über **SAP-Favoriten laden** importieren,
   oder direkt links im Baum über **+ Ordner / + Transaktion /
   + OT-Objekt** neue Einträge anlegen.
3. Optional eine [TCode-Datenbank](#tcode-datenbank) laden, damit
   Transaktionscodes beim Anlegen geprüft und automatisch mit dem
   richtigen Text versehen werden.
4. Über **SAP-Favoriten exportieren** eine Datei erzeugen und in SAP
   GUI unter *Favoriten → Favoriten hochladen* wieder einspielen.

## Dateiformat

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

**Hinweis zu `OBJECT_ID`/`PARENT_ID`:** Diese dürfen beim Export frei
neu vergeben werden – SAP mappt sie beim Upload ohnehin neu. Das Tool
nummeriert beim Export durch, unabhängig von den beim Import
eingelesenen IDs.

**Bekannte Einschränkung:** Ein mögliches zusätzliches `SAP_GUID`-Feld
nach dem `URL`-Feld wird derzeit nicht separat behandelt. In den bisher
getesteten Exporten trat es nicht auf; sollte eine SAP-Version es
mitschreiben, geht dieser Teil beim Round-Trip verloren.

## TCode-Datenbank

Damit beim Anlegen einer Transaktion Code und Bezeichnung geprüft
werden können, kann über **TCode-Datenbank laden** eine JSON-Datei
mit allen bekannten Transaktionen geladen werden. Unterstützt werden
drei gleichwertige Formate:

```json
[
  { "tcode": "SE16N", "text": "Data Browser" },
  { "tcode": "SE38",  "text": "ABAP Editor" }
]
```

```json
{
  "SE16N": "Data Browser",
  "SE38": "ABAP Editor"
}
```

```json
[
  ["SE16N", "Data Browser"],
  ["SE38", "ABAP Editor"]
]
```

Ein Beispiel liegt unter [`data/tcodes.example.json`](data/tcodes.example.json).
Eine vollständige Liste lässt sich z. B. aus der Tabelle `TSTC`/`TSTCT`
exportieren (Transaktionscode + Kurztext je Sprache).

Wird beim Anlegen ein bekannter Code eingegeben, wird die Bezeichnung
automatisch übernommen (Feld gesperrt). Ist der Code nicht in der
Datenbank enthalten, erscheint ein Hinweis und die Bezeichnung kann
manuell eingegeben werden. Die geladene Datenbank wird ebenfalls lokal
im Browser zwischengespeichert.

## Fiori-Apps als OT-Objekt

Beim Anlegen eines OT-Objekts kann zwischen **freier URL/Parameter**
und **Fiori-App** gewählt werden. Bei Fiori-App werden *Semantisches
Objekt* und *Action* abgefragt und daraus automatisch die
Intent-basierte Navigations-URL im Format

```
#SemantischesObjekt-Action
```

gebildet (z. B. `#SalesOrder-create`), die dann als `URL`-Feld in die
Favoritendatei geschrieben wird.

## Datenhaltung

Es gibt drei sich ergänzende Ebenen:

1. **Datei-Verknüpfung (empfohlen)** – über die Leiste direkt unter
   der Symbolleiste lässt sich sowohl die Favoriten-Datei als auch
   die TCode-Datenbank mit einer echten lokalen Datei verknüpfen
   (🔗 Verbinden). Danach:
   - wird bei **jeder Änderung** automatisch in diese Datei
     geschrieben (Favoriten),
   - wird die Datei **beim erneuten Öffnen von `index.html`
     automatisch wieder eingelesen** – ganz ohne Re-Import.

   Technisch basiert das auf der *File System Access API*
   (unterstützt in Chrome, Edge, Opera; **nicht** in Firefox/Safari –
   dort blendet das Tool die Verbindungsleiste automatisch aus und
   nutzt nur die beiden folgenden Ebenen). Aus Sicherheitsgründen
   verlangt der Browser nach jedem Neuladen der Seite einmal einen
   Klick auf „🔓 Zugriff erlauben“, falls die Berechtigung nicht mehr
   aktiv ist – das ist eine Browser-Vorgabe und keine Einschränkung
   des Tools. Über „Trennen“ lässt sich die Verknüpfung jederzeit
   aufheben (die Datei selbst bleibt erhalten).

2. **Automatisch im Browser** (`localStorage`) – zusätzlich wird
   jede Änderung im Browser zwischengespeichert, als Fallback für
   Browser ohne Datei-Verknüpfung und als schnelle Wiederherstellung
   direkt beim Laden, noch bevor die verknüpfte Datei nachgezogen
   wird. In eingebetteten Vorschau-Umgebungen (z. B. Sandboxes) kann
   `localStorage` blockiert sein – das Tool erkennt das und weist
   darauf hin.

3. **Manuell** – **JSON speichern/laden** exportiert bzw. importiert
   den kompletten Baum als einmalige Kopie, unabhängig von Browser
   und Verknüpfung (z. B. für Backups oder Weitergabe an Kolleg:innen).
   Ebenso lässt sich die TCode-Datenbank über „TCode-Datenbank laden“
   einmalig aus einer Datei einlesen, ohne dauerhafte Verknüpfung.

## Browser-Kompatibilität

Getestet mit aktuellen Chromium- und Firefox-basierten Browsern.
Benötigt `TextDecoder('windows-1252')` (in allen gängigen Browsern
vorhanden) sowie HTML5 Drag & Drop.

## Lizenz

[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0)
– vollständiger Text in [`LICENSE.md`](LICENSE.md).

Kurz zusammengefasst: frei nutzbar, veränderbar und weitergebbar für
**nicht-kommerzielle Zwecke**; kein Verkauf, keine kostenpflichtige
Bereitstellung. Die Software wird **ohne jede Gewährleistung** zur
Verfügung gestellt – Nutzung auf eigenes Risiko, keine Haftung für
daraus entstehende Schäden (siehe Abschnitt „No Liability“ in der
Lizenz).
