---
# SW5e sample (classesen.csv, row "Consular"). Subclass levels from the CSV (3/6/10/14/18),
# not the placeholder copied into sw5e-data.
name: Consular
snippet: Force-wielder who focuses on using force powers.
hitDie: 6
primaryAbility: [wis, cha]
subclassLabel: Consular Tradition
profs:
  weapon:
    has: [simple_lightweapon, simple_vibroweapon]
  skill:
    choices:
      count: 2
      items: [deception, insight, intimidation, investigation, lore, medicine, persuasion]
  saving-throw:
    has: [wis, cha]
startingEquipment:
  - text: (a) a simple lightweapon or (b) a simple vibroweapon
  - text: (a) a scholar's pack, (b) an explorer's pack, or (c) a diplomat's pack
startingWealth:
  value: 5d4x100
progression:
  subclass: [3, 6, 10, 14, 18]
  abi: [4, 8, 12, 16, 19]
  columns:
    - label: features
    - label: force_powers_known
      values: [9, 11, 13, 15, 17, 19, 21, 23, 25, 26, 28, 29, 31, 32, 34, 35, 37, 38, 39, 40]
    - label: force_points
      values: [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80]
    - label: max_power_level
      values: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 9]
---
Consulars study the mysteries of the Force and draw a lightsaber only as a last resort.
