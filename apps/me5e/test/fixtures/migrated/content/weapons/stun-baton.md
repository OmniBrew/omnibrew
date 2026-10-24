---
name: Stun Baton
rarity: uncommon
weaponType: melee
cost: 13500
manufacturer: cerberus
weight: 2
damage:
  dieCount: 1
  dieType: 6
  type: bludgeoning
range:
  short: 5
andromeda: false
properties:
  - id: light
slots: 1
additionalDamage:
  - dieCount: 1
    dieType: 4
    type: lightning
    addTo: base
---
When you hit with an attack using this weapon, the target takes an additional 1d4 lightning damage.
If the target is maintaining a concentration power, it automatically fails its saving throw to maintain
that power.
