# Credits

## Textures

The default texture set — blocks, item icons, and entity/mob skins — is
baked from **Classic Faithful 64x** (Jappa edition) by the Classic Faithful
team, part of the Faithful project. Block art is downscaled to 32px at bake
time. Used with permission and credited here, under the Faithful License
(see `docs/third-party/FAITHFUL-LICENSE.txt`, included unmodified as the
license requires — the same license text ships inside the pack).

- Website: https://faithfulpack.net/
- This project is unofficial and is not affiliated with or endorsed by the
  Faithful or Classic Faithful projects.

Coverage spans the logical materials the game uses: terrain and stone
families (stone, stone brick, diorite, granite, quartz, calcite, basalt,
nether brick, prismarine, purpur, end stone), every wood species' planks
and bark, roofs, the dyed block families (all sixteen colours of wool,
concrete, and terracotta), props, and the item/inventory sprites. Held-item
sprites and any material the pack does not cover keep the project's own
built-in procedural art as a fallback.

To re-bake the default set from a pack:

    node game/scripts/bake-default-textures.mjs <pack.zip> [size]

The project's own "Bare Bones Remix" user-authored pack can be baked the
same way to restore a fully original-art default.
