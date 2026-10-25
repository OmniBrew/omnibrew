---
name: Asari Initiate Armor
coverage: suit
armorType: light
cost: 42500
manufacturer: serrice-council
image: https://vignette.wikia.nocookie.net/masseffect/images/5/51/Light-human-Phoenix.png/revision/latest/scale-to-width-down/160?cb=20100209134257
tags:
  - extra_damage
andromeda: false
rarity: spectre
flavor: Standard issue armor for all Asari infantry. Build-in biotic amps provide a minor boost to biotic powers.
mechanics:
  - type: me:cantrip-boost
  - type: me:shields
    capacity:
      type: flat
      value: 5
    regen:
      type: flat
      value: 5
  - type: me:thermal-clip-capacity
    value: 10
  - type: me:medi-gel-capacity
    value: 4
  - type: me:grenade-capacity
    value: 2
---
- While wearing this armor, your cantrips are considered to be 1 step higher in their progression.
For example, a 1st level player casts a cantrip as if they were at the 5th level. 5th -> 11th. 11th
-> 17th. There is no additional effect at the 17th level.
