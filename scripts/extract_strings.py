import json
import xml.etree.ElementTree as ET
from pathlib import Path

LANG_SOURCES = {
    "en": Path("decompiled/base/res/values/strings.xml"),
    "de": Path("decompiled/config_de/res/values-de/strings.xml"),
    "es": Path("decompiled/config_es/res/values-es/strings.xml"),
    "fr": Path("decompiled/config_fr/res/values-fr/strings.xml"),
    "pt": Path("decompiled/config_pt/res/values-pt/strings.xml"),
}

KEYS = {
    "app_name",
    "main_editTeams",
    "main_setStones",
    "main_lastScore",
    "settings",
    "main_team1",
    "main_team2",
    "main_changeColor_1",
    "main_changeColor_2",
    "main_changeOfEnds",
    "main_changeColor",
    "main_renameTeams",
    "main_renameTeams_1",
    "main_renameTeams_2",
    "main_toast_infinity",
    "reset",
    "pref_category_game",
    "pref_category_sound",
    "pref_category_others",
    "pref_mode",
    "pref_mode_50",
    "pref_mode_100",
    "pref_mode_infinite",
    "pref_mode_custom",
    "playStore",
    "pref_interval_custom",
    "pref_stoneInterval",
    "pref_reverse",
    "pref_reverse_summary",
    "pref_immediateStart",
    "pref_gong_after_point",
    "pref_pause_after_point",
    "pref_pause_after_gong",
    "pref_keep_display_awake",
    "pref_sounds_stones",
    "pref_sounds_stones_countdown",
    "pref_sounds_gong",
    "pref_sounds_gong",
    "pref_sounds_stones",
    "pref_sounds_stones_countdown",
    "pref_stone",
    "pref_achievement",
    "pref_big_drum",
    "pref_cash_reg",
    "pref_censure",
    "pref_crow",
    "pref_doh",
    "pref_drum",
    "pref_duck",
    "pref_fb",
    "pref_gong",
    "pref_metal_gear",
    "pref_pan",
    "pref_snare_drum",
    "pref_telephone",
    "pref_train_whistle",
    "pref_vuvuzela",
    "pref_air_horn",
    "pref_email",
    "pref_version",
    "language",
    "language_english",
    "language_german",
    "language_spanish",
    "language_french",
    "language_portuguese",
    "language_en",
    "language_english_en",
    "language_german_en",
    "language_spanish_en",
    "language_french_en",
    "language_portuguese_en",
    "pref_mode_infinite",
    "pref_mode_custom",
}

# Clean duplicates
KEYS = set(KEYS)

def load_strings(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"Missing file: {path}")
    tree = ET.parse(path)
    root = tree.getroot()
    strings = {}
    for node in root.findall("string"):
        name = node.attrib.get("name")
        if name in KEYS:
            strings[name] = ''.join(node.itertext())
    return strings

all_data = {}
for lang, src in LANG_SOURCES.items():
    strings = load_strings(src)
    all_data[lang] = strings

# Ensure fallbacks are filled from English
english = all_data["en"]
for lang, values in all_data.items():
    if lang == "en":
        continue
    for key in KEYS:
        if key not in values and key in english:
            values[key] = english[key]

# Add manual common strings (save/cancel etc.)
COMMON = {
    "en": {"common.save": "Save", "common.cancel": "Cancel"},
    "de": {"common.save": "Speichern", "common.cancel": "Abbrechen"},
    "es": {"common.save": "Guardar", "common.cancel": "Cancelar"},
    "fr": {"common.save": "Enregistrer", "common.cancel": "Annuler"},
    "pt": {"common.save": "Guardar", "common.cancel": "Cancelar"},
}

for lang, entries in all_data.items():
    entries.update(COMMON.get(lang, COMMON["en"]))

output_path = Path("docs/i18n.json")
output_path.parent.mkdir(parents=True, exist_ok=True)
with output_path.open("w", encoding="utf-8") as fh:
    json.dump(all_data, fh, ensure_ascii=False, indent=2)

print(f"Wrote {output_path}")
