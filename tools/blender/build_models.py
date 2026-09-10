"""
Procedurally build Pilgrims' low-poly diorama models in Blender and export GLB.

Run headless from the project root:

    blender --background --factory-startup --python tools/blender/build_models.py

Outputs:
    public/models/pilgrim.glb
    public/models/shrine.glb
    public/models/props.glb

The models use named parts so the renderer can animate them at runtime
(LegL/LegR, ArmL/ArmR, Cloak, Head, Hood, ShrineOrb, ...).  Everything is
built from bmesh primitives + bevel + noise so the source of truth is code.
"""

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

# --------------------------------------------------------------------------
# Setup
# --------------------------------------------------------------------------


def project_root() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", ".."))


OUT_DIR = os.path.join(project_root(), "public", "models")
os.makedirs(OUT_DIR, exist_ok=True)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for item in list(block):
            block.remove(item)


# --------------------------------------------------------------------------
# Materials
# --------------------------------------------------------------------------


def make_material(
    name: str,
    color,
    roughness: float = 0.85,
    metallic: float = 0.0,
    emission=None,
    emission_strength: float = 0.0,
):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        return material
    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = roughness
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (
                emission[0],
                emission[1],
                emission[2],
                1.0,
            )
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        material.diffuse_color = (emission[0], emission[1], emission[2], 1.0)
    return material


# Shared palette.
MAT = {}


def build_palette() -> None:
    MAT["cloak"] = make_material("Cloak", (0.62, 0.32, 0.18), roughness=0.92)
    MAT["cloak_dark"] = make_material("CloakDark", (0.38, 0.19, 0.12), roughness=0.95)
    MAT["cloth"] = make_material("Cloth", (0.55, 0.46, 0.34), roughness=0.95)
    MAT["skin"] = make_material("Skin", (0.78, 0.60, 0.44), roughness=0.75)
    MAT["leather"] = make_material("Leather", (0.22, 0.17, 0.13), roughness=0.9)
    MAT["wood"] = make_material("Wood", (0.28, 0.19, 0.12), roughness=0.95)
    MAT["stone"] = make_material("Stone", (0.66, 0.62, 0.54), roughness=0.9)
    MAT["stone_dark"] = make_material("StoneDark", (0.42, 0.41, 0.38), roughness=0.95)
    MAT["gold"] = make_material(
        "GoldGlow",
        (0.95, 0.72, 0.34),
        roughness=0.35,
        metallic=0.2,
        emission=(1.0, 0.72, 0.30),
        emission_strength=3.0,
    )
    MAT["rune"] = make_material(
        "RuneGlow",
        (1.0, 0.80, 0.42),
        roughness=0.4,
        emission=(1.0, 0.78, 0.38),
        emission_strength=2.4,
    )
    MAT["foliage_a"] = make_material("FoliageA", (0.52, 0.32, 0.12), roughness=0.95)
    MAT["foliage_b"] = make_material("FoliageB", (0.30, 0.38, 0.18), roughness=0.95)
    MAT["grass"] = make_material("Grass", (0.34, 0.42, 0.22), roughness=0.95)


# --------------------------------------------------------------------------
# bmesh helpers
# --------------------------------------------------------------------------


def _sphere(bm, segments, rings, radius):
    try:
        return bmesh.ops.create_uvsphere(
            bm, u_segments=segments, v_segments=rings, radius=radius
        )
    except TypeError:
        return bmesh.ops.create_uvsphere(
            bm, u_segments=segments, v_segments=rings, diameter=radius
        )


def _ico(bm, subdivisions, radius):
    try:
        return bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    except TypeError:
        return bmesh.ops.create_icosphere(
            bm, subdivisions=subdivisions, diameter=radius
        )


def _cone(bm, segments, r1, r2, depth):
    try:
        return bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            cap_tris=False,
            segments=segments,
            radius1=r1,
            radius2=r2,
            depth=depth,
        )
    except TypeError:
        return bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            cap_tris=False,
            segments=segments,
            diameter1=r1,
            diameter2=r2,
            depth=depth,
        )


def _cube(bm, size=1.0):
    return bmesh.ops.create_cube(bm, size=size)


def _place(bm, created, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    verts = created["verts"]
    matrix = (
        Matrix.Translation(Vector(loc))
        @ Euler(rot, "XYZ").to_matrix().to_4x4()
        @ Matrix.Diagonal(Vector(scale).to_4d())
    )
    bmesh.ops.transform(bm, matrix=matrix, verts=list(verts))
    return verts


def add_sphere(bm, radius, loc, segments=10, rings=6, scale=(1, 1, 1), rot=(0, 0, 0)):
    return _place(bm, _sphere(bm, segments, rings, radius), loc, rot, scale)


def add_ico(bm, radius, loc, subdivisions=2, scale=(1, 1, 1), rot=(0, 0, 0)):
    return _place(bm, _ico(bm, subdivisions, radius), loc, rot, scale)


def add_cone(
    bm,
    r1,
    r2,
    depth,
    loc,
    segments=10,
    scale=(1, 1, 1),
    rot=(0, 0, 0),
):
    return _place(
        bm, _cone(bm, segments, r1, r2, depth), loc, rot, scale
    )


def add_box(bm, size, loc, scale=(1, 1, 1), rot=(0, 0, 0)):
    return _place(bm, _cube(bm, size), loc, rot, scale)


def jitter(bm, amount, seed=0, verts=None):
    rnd = random.Random(seed)
    for vertex in verts if verts is not None else bm.verts:
        vertex.co += Vector(
            (
                rnd.uniform(-1, 1),
                rnd.uniform(-1, 1),
                rnd.uniform(-1, 1),
            )
        ) * amount


def bevel(bm, offset=0.012, segments=1):
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    try:
        bmesh.ops.bevel(
            bm,
            geom=geom,
            offset=offset,
            segments=segments,
            profile=0.5,
            affect="EDGES",
            clamp_overlap=True,
        )
    except Exception:
        try:
            bmesh.ops.bevel(bm, geom=geom, offset=offset, segments=segments)
        except Exception:
            pass


def finish(
    name: str,
    bm,
    material,
    parent=None,
    smooth=False,
    recalc=True,
    loc=(0, 0, 0),
    rot=(0, 0, 0),
    scale=(1, 1, 1),
):
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(material)
    obj.location = loc
    obj.rotation_euler = Euler(rot, "XYZ")
    obj.scale = scale
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def empty(name: str, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.2
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


# --------------------------------------------------------------------------
# Pilgrim
# --------------------------------------------------------------------------


def build_pilgrim():
    root = empty("Pilgrim")

    # Legs pivot at the hip so the renderer can swing them.
    for side, label in ((1, "LegL"), (-1, "LegR")):
        bm = bmesh.new()
        add_box(bm, 1.0, (0.0, 0.0, -0.11), scale=(0.085, 0.085, 0.22))
        add_box(bm, 1.0, (0.055, 0.0, -0.20), scale=(0.15, 0.09, 0.045))
        bevel(bm, 0.012)
        finish(label, bm, MAT["leather"], parent=root, loc=(0.0, side * 0.085, 0.22))

    # Cloak: tapered, slightly irregular, flared hem.
    bm = bmesh.new()
    hem = add_cone(
        bm,
        r1=0.26,
        r2=0.15,
        depth=0.46,
        loc=(0.0, 0.0, 0.47),
        segments=12,
    )
    jitter(bm, 0.012, seed=11, verts=hem)
    bevel(bm, 0.01)
    finish("Cloak", bm, MAT["cloak"], parent=root, smooth=True)

    # Belt.
    bm = bmesh.new()
    add_cone(
        bm,
        r1=0.20,
        r2=0.20,
        depth=0.055,
        loc=(0.0, 0.0, 0.60),
        segments=12,
    )
    bevel(bm, 0.008)
    finish("Belt", bm, MAT["leather"], parent=root, smooth=True)

    # Head + hood.
    bm = bmesh.new()
    add_sphere(bm, 0.115, (0.02, 0.0, 0.78), segments=12, rings=8)
    finish("Head", bm, MAT["skin"], parent=root, smooth=True)

    bm = bmesh.new()
    add_cone(
        bm,
        r1=0.175,
        r2=0.055,
        depth=0.24,
        loc=(-0.01, 0.0, 0.83),
        segments=12,
    )
    add_cone(
        bm,
        r1=0.185,
        r2=0.155,
        depth=0.07,
        loc=(0.02, 0.0, 0.72),
        segments=12,
    )
    jitter(bm, 0.008, seed=7)
    bevel(bm, 0.01)
    finish("Hood", bm, MAT["cloak"], parent=root, smooth=True)

    # Scarf accent.
    bm = bmesh.new()
    add_cone(
        bm,
        r1=0.135,
        r2=0.12,
        depth=0.06,
        loc=(0.0, 0.0, 0.685),
        segments=12,
    )
    finish("Scarf", bm, MAT["cloth"], parent=root, smooth=True)

    # Arms pivot at the shoulder; hands are children so they follow the swing.
    for side, label in ((1, "ArmL"), (-1, "ArmR")):
        bm = bmesh.new()
        add_cone(
            bm,
            r1=0.065,
            r2=0.045,
            depth=0.30,
            loc=(0.0, 0.0, -0.15),
            segments=8,
        )
        bevel(bm, 0.012)
        arm = finish(
            label,
            bm,
            MAT["cloak"],
            parent=root,
            smooth=True,
            loc=(0.02 * side, side * 0.20, 0.70),
            rot=(side * 0.18, side * 0.30, 0.0),
        )
        bh = bmesh.new()
        add_sphere(bh, 0.05, (0.0, 0.0, 0.0), segments=8, rings=6)
        finish(
            "Hand" + label[-1],
            bh,
            MAT["skin"],
            parent=arm,
            smooth=True,
            loc=(0.0, 0.0, -0.30),
        )

    # Walking staff.
    bm = bmesh.new()
    add_cone(
        bm,
        r1=0.022,
        r2=0.018,
        depth=0.86,
        loc=(0.0, 0.0, 0.43),
        segments=6,
    )
    add_sphere(bm, 0.045, (0.03, 0.0, 0.87), segments=8, rings=6)
    bevel(bm, 0.006)
    finish("Staff", bm, MAT["wood"], parent=root, smooth=True, loc=(0.10, -0.255, 0.0))

    return root


# --------------------------------------------------------------------------
# Shrine
# --------------------------------------------------------------------------


def build_shrine():
    root = empty("Shrine")

    # Base tiers.
    bm = bmesh.new()
    add_cone(bm, r1=0.46, r2=0.46, depth=0.10, loc=(0, 0, 0.05), segments=8, rot=(0, 0, math.pi / 8))
    add_cone(bm, r1=0.37, r2=0.37, depth=0.10, loc=(0, 0, 0.15), segments=8, rot=(0, 0, math.pi / 8))
    bevel(bm, 0.012)
    finish("ShrineBase", bm, MAT["stone"], parent=root, smooth=False)

    # Body.
    bm = bmesh.new()
    body = add_cone(bm, r1=0.24, r2=0.20, depth=0.58, loc=(0, 0, 0.49), segments=8, rot=(0, 0, math.pi / 8))
    jitter(bm, 0.006, seed=21, verts=body)
    bevel(bm, 0.012)
    finish("ShrineBody", bm, MAT["stone"], parent=root, smooth=False)

    # Rune panels on the four faces.
    bm = bmesh.new()
    for i in range(4):
        angle = i * math.pi / 2 + math.pi / 8
        x = math.sin(angle) * 0.215
        y = math.cos(angle) * 0.215
        add_box(
            bm,
            1.0,
            (x, y, 0.50),
            scale=(0.045, 0.045, 0.34),
            rot=(0, 0, angle),
        )
    finish("ShrineRunes", bm, MAT["rune"], parent=root, smooth=False)

    # Cornice + roof.
    bm = bmesh.new()
    add_cone(bm, r1=0.34, r2=0.30, depth=0.07, loc=(0, 0, 0.81), segments=8, rot=(0, 0, math.pi / 8))
    add_cone(bm, r1=0.40, r2=0.03, depth=0.30, loc=(0, 0, 1.00), segments=8, rot=(0, 0, math.pi / 8))
    add_cone(bm, r1=0.22, r2=0.02, depth=0.18, loc=(0, 0, 1.20), segments=8, rot=(0, 0, math.pi / 8))
    bevel(bm, 0.012)
    finish("ShrineRoof", bm, MAT["stone_dark"], parent=root, smooth=False)

    # Floating emissive orb (pivot at its own centre so it can bob/spin).
    bm = bmesh.new()
    add_ico(bm, 0.10, (0, 0, 0), subdivisions=2)
    finish("ShrineOrb", bm, MAT["gold"], parent=root, smooth=True, loc=(0, 0, 1.42))

    return root


# --------------------------------------------------------------------------
# Props
# --------------------------------------------------------------------------


def build_tree_round(name, seed, foliage_mat):
    bm = bmesh.new()
    add_cone(bm, r1=0.075, r2=0.05, depth=0.55, loc=(0, 0, 0.28), segments=6)
    jitter(bm, 0.012, seed=seed)
    bevel(bm, 0.01)
    trunk = finish(name + "_Trunk", bm, MAT["wood"], smooth=False)

    bm = bmesh.new()
    rnd = random.Random(seed + 1)
    for i, (dx, dy, dz, r) in enumerate(
        [
            (0.0, 0.0, 0.72, 0.30),
            (0.16, 0.05, 0.62, 0.20),
            (-0.14, -0.08, 0.66, 0.19),
            (0.02, 0.16, 0.60, 0.17),
        ]
    ):
        add_ico(bm, r, (dx, dy, dz), subdivisions=1)
    jitter(bm, 0.03, seed=seed + 2)
    foliage = finish(name + "_Foliage", bm, foliage_mat, smooth=False)
    foliage.parent = trunk
    return trunk


def build_tree_conifer(name, seed):
    bm = bmesh.new()
    add_cone(bm, r1=0.06, r2=0.04, depth=0.4, loc=(0, 0, 0.2), segments=6)
    add_cone(bm, r1=0.30, r2=0.0, depth=0.4, loc=(0, 0, 0.5), segments=7)
    add_cone(bm, r1=0.24, r2=0.0, depth=0.36, loc=(0, 0, 0.78), segments=7)
    add_cone(bm, r1=0.16, r2=0.0, depth=0.30, loc=(0, 0, 1.02), segments=7)
    jitter(bm, 0.012, seed=seed)
    bevel(bm, 0.008)
    return finish(name, bm, MAT["foliage_b"], smooth=False)


def build_rock(name, seed, scale=(1, 1, 0.7)):
    bm = bmesh.new()
    add_ico(bm, 0.34, (0, 0, 0.24), subdivisions=1, scale=scale)
    jitter(bm, 0.06, seed=seed)
    bevel(bm, 0.01)
    return finish(name, bm, MAT["stone_dark"], smooth=False)


def build_grass(name, seed):
    bm = bmesh.new()
    rnd = random.Random(seed)
    for i in range(6):
        angle = rnd.uniform(0, math.pi * 2)
        radius = rnd.uniform(0.0, 0.12)
        height = rnd.uniform(0.16, 0.28)
        add_cone(
            bm,
            r1=0.02,
            r2=0.002,
            depth=height,
            loc=(math.cos(angle) * radius, math.sin(angle) * radius, height / 2),
            segments=4,
            rot=(rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4), 0),
        )
    return finish(name, bm, MAT["grass"], smooth=False)


def build_pillar(name, seed):
    bm = bmesh.new()
    add_cone(bm, r1=0.13, r2=0.115, depth=0.7, loc=(0, 0, 0.35), segments=8)
    add_cone(bm, r1=0.17, r2=0.15, depth=0.08, loc=(0, 0, 0.74), segments=8)
    # Break the top.
    verts = list(bm.verts)
    rnd = random.Random(seed)
    for v in verts:
        if v.co.z > 0.7:
            v.co.z += rnd.uniform(-0.08, 0.05)
            v.co.x += rnd.uniform(-0.02, 0.02)
    bevel(bm, 0.01)
    return finish(name, bm, MAT["stone"], smooth=False)


# --------------------------------------------------------------------------
# Title glyph monument
# --------------------------------------------------------------------------


def build_title_glyph():
    """A blocky monument: stepped pedestal, rune ring, broken monoliths and a
    floating voxel glyph (a seven-cube plus) with a glowing core."""
    root = empty("Title")

    # Stepped pedestal.
    bm = bmesh.new()
    add_cone(
        bm,
        r1=0.98,
        r2=0.88,
        depth=0.28,
        loc=(0, 0, 0.14),
        segments=8,
        rot=(0, 0, math.pi / 8),
    )
    add_cone(
        bm,
        r1=0.82,
        r2=0.76,
        depth=0.14,
        loc=(0, 0, 0.35),
        segments=8,
        rot=(0, 0, math.pi / 8),
    )
    bevel(bm, 0.02)
    finish("TitlePedestal", bm, MAT["stone"], parent=root)

    # Ring of upright blocks.
    bm = bmesh.new()
    for i in range(12):
        angle = (i / 12.0) * math.tau
        radius = 0.8
        height = 0.16 + (i % 3) * 0.06
        add_box(
            bm,
            1.0,
            (math.cos(angle) * radius, math.sin(angle) * radius, 0.45 + height / 2),
            scale=(0.11, 0.11, height),
            rot=(0, 0, angle),
        )
    jitter(bm, 0.01, seed=91)
    bevel(bm, 0.012)
    finish("TitleRing", bm, MAT["stone_dark"], parent=root)

    # Broken monoliths flanking the glyph.
    bm = bmesh.new()
    add_box(bm, 1.0, (0.66, 0.0, 1.0), scale=(0.15, 0.15, 1.3))
    add_box(bm, 1.0, (-0.66, 0.0, 0.78), scale=(0.13, 0.13, 0.9))
    jitter(bm, 0.03, seed=93)
    bevel(bm, 0.016)
    finish("TitleMonoliths", bm, MAT["stone_dark"], parent=root)

    # Floating seven-cube plus glyph.
    bm = bmesh.new()
    size = 0.2
    offsets = [
        (0, 0, 0),
        (1, 0, 0),
        (-1, 0, 0),
        (0, 1, 0),
        (0, -1, 0),
        (0, 0, 1),
        (0, 0, -1),
    ]
    for ox, oy, oz in offsets:
        add_box(
            bm,
            1.0,
            (ox * 0.235, oy * 0.235, oz * 0.235),
            scale=(size, size, size),
        )
    bevel(bm, 0.022)
    glyph = finish(
        "TitleGlyph",
        bm,
        MAT["stone_dark"],
        parent=root,
        loc=(0, 0, 1.95),
    )

    # Glowing core cube at the heart of the glyph.
    bm = bmesh.new()
    add_box(bm, 1.0, (0, 0, 0), scale=(0.19, 0.19, 0.19))
    bevel(bm, 0.02)
    finish("TitleCore", bm, MAT["gold"], parent=glyph)

    return root


# --------------------------------------------------------------------------
# Export
# --------------------------------------------------------------------------


def select_only(objects):
    # Include every descendant so parented parts and props export fully.
    expanded = []
    stack = list(objects)
    while stack:
        obj = stack.pop()
        if obj in expanded:
            continue
        expanded.append(obj)
        stack.extend(list(obj.children))

    bpy.ops.object.select_all(action="DESELECT")
    for obj in expanded:
        obj.select_set(True)
    if expanded:
        bpy.context.view_layer.objects.active = expanded[0]
    return expanded


def export_glb(filepath, objects):
    select_only(objects)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_animations=False,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
    )
    print("WROTE", filepath)


def main():
    reset_scene()
    build_palette()

    # Procedural fallbacks live beside the GLBs but are not loaded by default;
    # the shipped pilgrim/shrine come from the AI image-to-3D pipeline
    # (tools/blender/prepare_ai_models.py).
    procedural_dir = os.path.join(OUT_DIR, "procedural")
    os.makedirs(procedural_dir, exist_ok=True)

    pilgrim = build_pilgrim()
    export_glb(
        os.path.join(procedural_dir, "pilgrim.glb"),
        [pilgrim] + list(pilgrim.children),
    )

    shrine = build_shrine()
    export_glb(
        os.path.join(procedural_dir, "shrine.glb"),
        [shrine] + list(shrine.children),
    )

    props = []
    props.append(build_tree_round("TreeA", 101, MAT["foliage_a"]))
    props.append(build_tree_round("TreeB", 202, MAT["foliage_b"]))
    props.append(build_tree_conifer("TreeC", 303))
    props.append(build_rock("RockA", 404, (1.0, 1.0, 0.65)))
    props.append(build_rock("RockB", 505, (0.8, 1.2, 0.9)))
    props.append(build_rock("RockC", 606, (1.3, 0.9, 0.5)))
    props.append(build_grass("GrassA", 707))
    props.append(build_pillar("PillarA", 808))
    export_glb(os.path.join(OUT_DIR, "props.glb"), props)

    title = build_title_glyph()
    export_glb(
        os.path.join(procedural_dir, "title.glb"),
        [title] + list(title.children),
    )

    print("DONE")


if __name__ == "__main__":
    main()
