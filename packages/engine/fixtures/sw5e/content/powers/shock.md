---
# SW5e sample (powersen.csv, row "Shock"); prose paraphrased.
name: Shock
level: 0
powerType: force
alignment: dark
tags: [damage]
casting:
  - castingTime: { length: 1, unit: action }
    duration: { length: 0, unit: instant }
    concentration: false
    range: { short: 120 }
    attack: { type: ranged, wp: power, proficient: true }
    damage:
      - { dieCount: 1, dieType: 10, type: lightning }
---
Make a ranged force attack; on a hit the target takes 1d10 lightning damage. The damage grows at 5th, 11th and 17th level.
