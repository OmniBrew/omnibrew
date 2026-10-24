---
# SW5e sample (from utility/SW5eCSV/powersen.csv, row "Force Lightning"); prose paraphrased.
name: Force Lightning
level: 3
powerType: force
alignment: dark
prerequisite: shock
tags: [damage]
casting:
  - castingTime: { length: 1, unit: action }
    duration: { length: 0, unit: instant }
    concentration: false
    range:
      short: 0
      aoe: { type: line, size: 100 }
    dc: { save: dex, base: 8, proficient: true }
    damage:
      - { dieCount: 8, dieType: 6, type: lightning }
  - damage: [{ dieCount: 9 }]
  - damage: [{ dieCount: 10 }]
  - damage: [{ dieCount: 11 }]
  - damage: [{ dieCount: 12 }]
  - damage: [{ dieCount: 13 }]
  - damage: [{ dieCount: 14 }]
---
A 100-foot line of lightning arcs from your hands. Each creature in the line makes a Dexterity saving throw, taking
8d6 lightning damage on a failure or half on a success.

**Force Potency.** Cast with a higher-level force slot, the damage rises by 1d6 per level above 3rd.
