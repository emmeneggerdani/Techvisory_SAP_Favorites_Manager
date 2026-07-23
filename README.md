# Techvisory SAP Favorites Manager

Eine moderne, portable Windows-Desktop-Anwendung zur lokalen Verwaltung von SAP GUI Favoriten über mehrere Systeme hinweg.

## Features

✨ **Kernfunktionalität**
- 📥 Favoriten von SAP GUI importieren (TXT-Format)
- 📤 Favoriten zu SAP GUI exportieren (TXT-Format)
- 💾 Lokale Speicherung im JSON-Format für bessere Portabilität und Metadaten
- 🌳 Interaktive Baumstruktur (TreeView) mit automatischer Hierarchie-Erkennung
- 📁 Ordner erstellen, bearbeiten und löschen
- 🔍 Volltextsuche
- 🔄 Drag & Drop Reorganisation
- 📋 Copy/Paste-Unterstützung
- ✓ Multi-Select
- 🔍 Duplikate finden und entfernen
- 💪 Automatisches Speichern bei Änderungen
- 🎨 Modernes, benutzerfreundliches UI
- 📦 Vollständig portabel - einzelne EXE-Datei

## Installation

### Anforderungen
- Python 3.9 oder höher
- Windows/Mac/Linux

### Setup

1. Repository klonen:
```bash
git clone https://github.com/emmeneggerdani/Techvisory_SAP_Favorites_Manager.git
cd Techvisory_SAP_Favorites_Manager
```

2. Virtuelle Umgebung erstellen:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
```

3. Abhängigkeiten installieren:
```bash
pip install -r requirements.txt
```

4. Anwendung ausführen:
```bash
python src/main.py
```

## Portable EXE erstellen

Um eine eigenständige `.exe`-Datei zu erstellen, die keine Python-Installation erfordert:

```bash
pip install pyinstaller
pyinstaller --onefile --windowed --icon=assets/icon.ico src/main.py
```

Die ausführbare Datei befindet sich im `dist/` Ordner.

## Dateiformat

### SAP TXT Format (Import/Export)
```
RTYPE|PARENT_ID|OBJECT_ID|TCODE|TEXT|URL|SAP_GUID
|1|2||Ordner|||
TR|1|3|SE80|Object Navigator||GUID-123
OT|1|6|FLP_APP_PROVIDER|Fiori Launchpad|#|GUID-456
```

### Lokales JSON Format (Speicherung)
```json
{
  "version": "1.0",
  "exported_from_system": "DEV",
  "last_modified": "2026-07-23T10:00:00Z",
  "favorites": [
    {
      "id": "SAP_2",
      "object_id": "2",
      "rtype": "",
      "parent_id": "1",
      "tcode": null,
      "text": "Transaktionen",
      "url": null,
      "sap_guid": null,
      "created_at": "2026-07-23T10:00:00Z",
      "modified_at": "2026-07-23T10:00:00Z"
    }
  ]
}
```

## Verwendung

### Favoriten importieren
1. Klick auf **Datei → Von TXT importieren**
2. SAP Favoriten TXT-Datei wählen
3. Favoriten werden automatisch in der Baumstruktur organisiert

### Favoriten exportieren
1. Klick auf **Datei → Nach TXT exportieren**
2. Speicherort wählen
3. Datei ist im SAP GUI importierbaren Format

### Favoriten verwalten
- **Drag & Drop**: Favoriten in der Baumstruktur reorganisieren
- **Rechtsklick**: Kontextmenü für Hinzufügen/Bearbeiten/Löschen
- **Suche**: Suchbox zum Filtern von Favoriten
- **Copy/Paste**: Standard-Tastenkombinationen (Strg+C, Strg+V)
- **Duplikate finden**: Doppelte Einträge anzeigen und entfernen
- **Multi-Select**: Mehrere Elemente mit Strg+Klick auswählen

### Automatisches Speichern
Alle Änderungen werden automatisch in der lokalen JSON-Datei gespeichert.

## Projektstruktur

```
Techvisory_SAP_Favorites_Manager/
├── src/
│   ├── main.py                 # Einstiegspunkt der Anwendung
│   ├── models/
│   │   ├── favorite.py         # Datenmodell für Favoriten
│   │   └── storage.py          # JSON-Speicher-Handler
│   ├── parsers/
│   │   ├── sap_parser.py       # SAP TXT-Format Parser
│   │   └── json_parser.py      # JSON-Format Parser
│   ├── ui/
│   │   ├── main_window.py      # Hauptfenster der Anwendung
│   │   ├── tree_widget.py      # TreeView-Widget
│   │   └── dialogs/
│   │       ├── edit_dialog.py
│   │       └── delete_dialog.py
│   ├── utils/
│   │   ├── duplicates.py       # Duplikat-Erkennung
│   │   └── validators.py       # Eingabe-Validierung
│   └── config.py               # Anwendungs-Konfiguration
├── assets/
│   └── icon.ico                # Anwendungssymbol
├── tests/
│   ├── test_parser.py
│   ├── test_storage.py
│   └── test_models.py
├── requirements.txt            # Python-Abhängigkeiten
├── README.md                   # Diese Datei
├── LICENSE                     # MIT Lizenz
└── .gitignore
```

## Entwicklung

### Tests ausführen
```bash
pip install pytest
pytest tests/
```

### Code-Stil
Dieses Projekt folgt PEP 8 Konventionen.

## Lizenz

MIT Lizenz - Siehe LICENSE-Datei für Details

## Beitragen

Beiträge sind willkommen! Bitte erstellen Sie einen Pull Request.

## Unterstützung

Für Fragen, Probleme oder Funktionswünsche erstellen Sie bitte ein Issue auf GitHub.

---

**Mit ❤️ von Techvisory**
