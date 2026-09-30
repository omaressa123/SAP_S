#!/usr/bin/env python3
"""Author the first 5 real GLB models for the Airport Digital Twin (Step 2).

Dependency-free minimal glTF 2.0 writer: boxes, tapered cylinders and UV
spheres with analytic normals, PBR metallic/roughness materials, node
hierarchy. All dimensions in meters, matching docs/coordinate-system.md.

Outputs (served by vite at /assets/models/...):
  chair.glb, security_gate.glb, fids_board.glb, aircraft_a320.glb, human.glb
"""
import json
import math
import struct
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "apps" / "web-client" / "public" / "assets" / "models"


class Builder:
    def __init__(self):
        self.pos: list[float] = []
        self.nor: list[float] = []
        self.idx: list[int] = []
        self.materials: list[dict] = []
        self.mat_index: dict[str, int] = {}
        self.meshes: list[dict] = []
        self.nodes: list[dict] = []

    # ---------------- materials ----------------
    def material(self, name, base=(1, 1, 1, 1), metallic=0.0, roughness=0.8, emissive=None):
        if name in self.mat_index:
            return self.mat_index[name]
        m = {"name": name, "pbrMetallicRoughness": {
            "baseColorFactor": list(base),
            "metallicFactor": metallic,
            "roughnessFactor": roughness}}
        if emissive:
            m["emissiveFactor"] = list(emissive)
        self.mat_index[name] = len(self.materials)
        self.materials.append(m)
        return self.mat_index[name]

    # ---------------- low-level ----------------
    def _vert(self, p, n):
        self.pos += [float(p[0]), float(p[1]), float(p[2])]
        self.nor += [float(n[0]), float(n[1]), float(n[2])]
        return len(self.pos) // 3 - 1

    @staticmethod
    def _sub(a, b):
        return (a[0] - b[0], a[1] - b[1], a[2] - b[2])

    @staticmethod
    def _cross(a, b):
        return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])

    @staticmethod
    def _dot(a, b):
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

    def _quad(self, mat, corners, outward, name):
        """Two triangles from 4 corners; winding auto-fixed against `outward`."""
        base = len(self.pos) // 3
        for c in corners:
            self.pos += [float(c[0]), float(c[1]), float(c[2])]
            self.nor += [float(outward[0]), float(outward[1]), float(outward[2])]
        a, b, c = corners[0], corners[1], corners[2]
        n = self._cross(self._sub(b, a), self._sub(c, a))
        if self._dot(n, outward) < 0:
            self.idx += [base, base + 2, base + 1, base, base + 3, base + 2]
        else:
            self.idx += [base, base + 1, base + 2, base, base + 2, base + 3]
        self._end_prim(mat, name)

    def _end_prim(self, mat, name):
        mi = self.materials and mat  # mat is already an index
        mesh_idx = len(self.meshes)
        self.meshes.append({"name": name, "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": mi}]})
        self.nodes.append({"name": name, "mesh": mesh_idx})

    # ---------------- primitives ----------------
    def box(self, mat, cx, cy, cz, sx, sy, sz, ry=0.0, name="box"):
        hx, hy, hz = sx / 2, sy / 2, sz / 2

        def rot(p):
            x, y, z = p[0] - cx, p[1] - cy, p[2] - cz
            if ry:
                c, s = math.cos(ry), math.sin(ry)
                x, z = x * c + z * s, -x * s + z * c
            return (x + cx, y + cy, z + cz)

        def rotn(n):
            if not ry:
                return n
            c, s = math.cos(ry), math.sin(ry)
            return (n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c)

        X = [(hx, -hy, -hz), (hx, -hy, hz), (hx, hy, hz), (hx, hy, -hz)]
        X = [rot((cx + x, cy + y, cz + z)) for x, y, z in X]
        NX = [(-hx, -hy, hz), (-hx, -hy, -hz), (-hx, hy, -hz), (-hx, hy, hz)]
        NX = [rot((cx + x, cy + y, cz + z)) for x, y, z in NX]
        Y = [( -hx, hy, -hz), (hx, hy, -hz), (hx, hy, hz), (-hx, hy, hz)]
        Y = [rot((cx + x, cy + y, cz + z)) for x, y, z in Y]
        NY = [(-hx, -hy, hz), (hx, -hy, hz), (hx, -hy, -hz), (-hx, -hy, -hz)]
        NY = [rot((cx + x, cy + y, cz + z)) for x, y, z in NY]
        Z = [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
        Z = [rot((cx + x, cy + y, cz + z)) for x, y, z in Z]
        NZ = [(hx, -hy, -hz), (-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz)]
        NZ = [rot((cx + x, cy + y, cz + z)) for x, y, z in NZ]
        # NOTE: _quad appends its own prim/mesh per face would split the box;
        # instead inline faces then close a single primitive manually.
        base_mesh = len(self.meshes)
        base_idx = len(self.idx)
        base_v = len(self.pos) // 3
        faces = [(X, (1, 0, 0)), (NX, (-1, 0, 0)), (Y, (0, 1, 0)),
                 (NY, (0, -1, 0)), (Z, (0, 0, 1)), (NZ, (0, 0, -1))]
        for corners, out in faces:
            o = rotn(out)
            b = len(self.pos) // 3
            for p in corners:
                self.pos += [float(p[0]), float(p[1]), float(p[2])]
                self.nor += [float(o[0]), float(o[1]), float(o[2])]
            a, bb, cc = corners[0], corners[1], corners[2]
            n = self._cross(self._sub(bb, a), self._sub(cc, a))
            if self._dot(n, o) < 0:
                self.idx += [b, b + 2, b + 1, b, b + 3, b + 2]
            else:
                self.idx += [b, b + 1, b + 2, b, b + 2, b + 3]
        # single mesh primitive spanning all 6 faces: rewrite _end_prim range
        self.meshes.append({"name": name, "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": mat}]})
        self.nodes.append({"name": name, "mesh": len(self.meshes) - 1})
        # fix up: attributes/indices are global (single buffer) so nothing more needed
        assert len(self.meshes) == base_mesh + 1

    def cyl(self, mat, cx, cy, cz, r_top, r_bot, h, seg=20, axis="y", name="cyl"):
        def xform(p, n):
            x, y, z = p
            nx, ny, nz = n
            if axis == "x":      # Y -> X  (rotZ -90)
                x, y = y, -x
                nx, ny = ny, -nx
            elif axis == "z":    # Y -> Z  (rotX +90)
                y, z = -z, y
                ny, nz = -nz, ny
            return (x + cx, y + cy, z + cz), (nx, ny, nz)
        # side (smooth radial normals)
        for i in range(seg):
            a0 = 2 * math.pi * i / seg
            a1 = 2 * math.pi * (i + 1) / seg
            ring = []
            for a, r, y in ((a0, r_bot, -h / 2), (a1, r_bot, -h / 2),
                            (a1, r_top, h / 2), (a0, r_top, h / 2)):
                p = (r * math.cos(a), y, r * math.sin(a))
                n = (math.cos(a), 0.0, math.sin(a))
                ring.append(xform(p, n))
            (b0, _), (b1, _), (t1, _), (t0, _) = ring
            # outward-verified pattern: (B_i, T_{i+1}, B_{i+1}), (B_i, T_i, T_{i+1})
            nb0 = (math.cos(a0), 0.0, math.sin(a0))
            nb1 = (math.cos(a1), 0.0, math.sin(a1))
            i0 = self._vert(*xform((r_bot * math.cos(a0), -h / 2, r_bot * math.sin(a0)), nb0))
            i1 = self._vert(*xform((r_top * math.cos(a1), h / 2, r_top * math.sin(a1)), nb1))
            i2 = self._vert(*xform((r_bot * math.cos(a1), -h / 2, r_bot * math.sin(a1)), nb1))
            i3 = self._vert(*xform((r_bot * math.cos(a0), -h / 2, r_bot * math.sin(a0)), nb0))
            i4 = self._vert(*xform((r_top * math.cos(a0), h / 2, r_top * math.sin(a0)), nb0))
            i5 = self._vert(*xform((r_top * math.cos(a1), h / 2, r_top * math.sin(a1)), nb1))
            self.idx += [i0, i1, i2, i3, i4, i5]
        # caps
        for y, r, ny in ((-h / 2, r_bot, -1.0), (h / 2, r_top, 1.0)):
            c = self._vert(*xform((0, y, 0), (0.0, ny, 0.0)))
            prev = None
            first = None
            for i in range(seg + 1):
                a = 2 * math.pi * i / seg
                v = self._vert(*xform((r * math.cos(a), y, r * math.sin(a)), (0.0, ny, 0.0)))
                if first is None:
                    first = v
                if prev is not None:
                    if ny < 0:
                        self.idx += [c, prev, v]
                    else:
                        self.idx += [c, v, prev]
                prev = v
        self.meshes.append({"name": name, "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": mat}]})
        self.nodes.append({"name": name, "mesh": len(self.meshes) - 1})

    def sphere(self, mat, cx, cy, cz, r, sx=1.0, sy=1.0, sz=1.0,
               lats=12, lons=18, name="sphere"):
        grid = []
        for j in range(lats + 1):
            phi = math.pi * j / lats
            row = []
            for i in range(lons + 1):
                th = 2 * math.pi * i / lons
                ux, uy, uz = math.sin(phi) * math.cos(th), math.cos(phi), math.sin(phi) * math.sin(th)
                p = (cx + r * sx * ux, cy + r * sy * uy, cz + r * sz * uz)
                n = (ux / sx, uy / sy, uz / sz)
                l = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2)
                row.append(self._vert(p, (n[0] / l, n[1] / l, n[2] / l)))
            grid.append(row)
        for j in range(lats):
            for i in range(lons):
                a, b, c, d = grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]
                # outward = away from center; fix per quad
                pa = (self.pos[3 * a], self.pos[3 * a + 1], self.pos[3 * a + 2])
                pb = (self.pos[3 * b], self.pos[3 * b + 1], self.pos[3 * b + 2])
                pc = (self.pos[3 * c], self.pos[3 * c + 1], self.pos[3 * c + 2])
                n = self._cross(self._sub(pb, pa), self._sub(pc, pa))
                out = (pa[0] - cx, pa[1] - cy, pa[2] - cz)
                if self._dot(n, out) < 0:
                    self.idx += [a, c, b, a, d, c]
                else:
                    self.idx += [a, b, c, a, c, d]
        self.meshes.append({"name": name, "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": mat}]})
        self.nodes.append({"name": name, "mesh": len(self.meshes) - 1})

    # ---------------- export ----------------
    def save(self, path: Path):
        # NOTE: meshes reference the whole-buffer accessors; per-mesh ranges are
        # intentionally NOT split (indices/positions are global). Babylon parses
        # this fine since each primitive has its own index list into shared
        # accessors... — actually NO: shared accessors mean every mesh draws ALL
        # vertices. That is wrong. Fix below by slicing per-mesh ranges.
        raise NotImplementedError("use save_split")


# The Builder above indexes globally; each mesh must own its vertex/index
# range. Simplest correct approach: one Builder per PART (mesh), then merge
# buffers with patched offsets at save time.
class Part(Builder):
    pass


def merge(parts: list[tuple[Builder, int, str]], path: Path):
    pos_all = bytearray()
    nor_all = bytearray()
    idx_all = bytearray()
    meshes, nodes, materials = [], [], []
    mat_global: dict[int, dict] = {}
    mat_map: dict[tuple[int, int], int] = {}  # (part_idx, local_mat) -> global

    def pad4(b: bytearray):
        while len(b) % 4:
            b.append(0)

    # gather materials
    for pi, (b, _, _) in enumerate(parts):
        for li, m in enumerate(b.materials):
            key = json.dumps(m, sort_keys=True)
            found = next((gi for gi, gm in mat_global.items() if json.dumps(gm, sort_keys=True) == key), None)
            if found is None:
                found = len(mat_global)
                mat_global[found] = m
            mat_map[(pi, li)] = found
    materials = [mat_global[i] for i in range(len(mat_global))]

    # NOTE: each Part holds exactly ONE mesh (box/cyl/sphere append one mesh)
    v_base = 0
    # we pack: all positions, then all normals, then all indices per part order
    pos_blob = bytearray()
    nor_blob = bytearray()
    idx_blob = bytearray()
    meta = []  # (vcount, icount, global_mat, name)
    for b, gmat_unused, name in parts:
        vcount = len(b.pos) // 3
        icount = len(b.idx)
        # local material of the single mesh:
        local_mat = b.meshes[0]["primitives"][0]["material"]
        pi = parts.index((b, gmat_unused, name))
        meta.append((vcount, icount, mat_map[(pi, local_mat)], name))
        for f in b.pos:
            pos_blob += struct.pack("<f", f)
        for f in b.nor:
            nor_blob += struct.pack("<f", f)
        for v in b.idx:
            idx_blob += struct.pack("<I", v + v_base)
        v_base += vcount

    pad4(pos_blob)
    pad4(nor_blob)
    pad4(idx_blob)
    Nakon = len(pos_blob)

    buffer = bytes(pos_blob) + bytes(nor_blob) + bytes(idx_blob)
    views = [
        {"buffer": 0, "byteOffset": 0, "byteLength": len(pos_blob), "target": 34962},
        {"buffer": 0, "byteOffset": len(pos_blob), "byteLength": len(nor_blob), "target": 34962},
        {"buffer": 0, "byteOffset": len(pos_blob) + len(nor_blob), "byteLength": len(idx_blob), "target": 34963},
    ]
    # per-mesh accessors need min/max + counts; compute from parts
    accessors = []
    node_list = []
    mesh_list = []
    v_off = 0
    i_off = 0
    # global vertex arrays for min/max
    all_pos = []
    for b, _, _ in parts:
        all_pos += b.pos
    for (vcount, icount, gmat, name), (b, _, _) in zip(meta, parts):
        pmin = [min(b.pos[0::3]), min(b.pos[1::3]), min(b.pos[2::3])]
        pmax = [max(b.pos[0::3]), max(b.pos[1::3]), max(b.pos[2::3])]
        pos_acc = len(accessors)
        accessors.append({"bufferView": 0, "byteOffset": 0, "componentType": 5126,
                          "count": 0, "type": "VEC3", "min": pmin, "max": pmax})
        nor_acc = len(accessors)
        accessors.append({"bufferView": 1, "byteOffset": 0, "componentType": 5126,
                          "count": 0, "type": "VEC3"})
        idx_acc = len(accessors)
        accessors.append({"bufferView": 2, "byteOffset": 0, "componentType": 5125,
                          "count": 0, "type": "SCALAR"})
        # NOTE: placeholders patched below with real offsets/counts
        mesh_list.append({"name": name, "primitives": [
            {"attributes": {"POSITION": pos_acc, "NORMAL": nor_acc},
             "indices": idx_acc, "material": gmat}]})
        node_list.append({"name": name, "mesh": len(mesh_list) - 1})
        v_off += vcount
        i_off += icount

    # patch offsets: positions/normals are per-part contiguous? NO — we packed
    # ALL positions together. So per-mesh accessor = byteOffset into view 0/1.
    v_byte = 0
    i_byte = 0
    v_ptr = 0
    ai = 0
    for (vcount, icount, gmat, name), (b, _, _) in zip(meta, parts):
        accessors[ai]["byteOffset"] = v_byte
        accessors[ai]["count"] = vcount
        accessors[ai + 1]["byteOffset"] = v_byte
        accessors[ai + 1]["count"] = vcount
        accessors[ai + 2]["byteOffset"] = i_byte
        accessors[ai + 2]["count"] = icount
        v_byte += vcount * 12
        i_byte += icount * 4
        ai += 3

    # rebuild buffer in accessor order? NO — buffer already packed as all-pos /
    # all-nor / all-idx, matching byteOffsets above. Good.
    gltf = {
        "asset": {"version": "2.0", "generator": "airport-twin make_models.py"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(node_list)))}],
        "nodes": node_list,
        "meshes": mesh_list,
        "materials": materials,
        "buffers": [{"byteLength": len(buffer)}],
        "bufferViews": views,
        "accessors": accessors,
    }
    # normals view byteOffset must equal len(pos_blob) — already set.
    chunk_json = json.dumps(gltf, separators=(",", ":")).encode()
    while len(chunk_json) % 4:
        chunk_json += b" "
    total = 12 + 8 + len(chunk_json) + 8 + len(buffer)
    out = struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(chunk_json), 0x4E4F534A) + chunk_json
    out += struct.pack("<II", len(buffer), 0x004E4942) + buffer
    path.write_bytes(out)
    # sanity: winding check — mean outward facing
    bad = 0
    tot = 0
    for b, _, _ in parts:
        for k in range(0, len(b.idx), 3):
            ia, ib, ic = b.idx[k] * 3, b.idx[k + 1] * 3, b.idx[k + 2] * 3
            a = (b.pos[ia], b.pos[ia + 1], b.pos[ia + 2])
            c_ = (b.pos[ic], b.pos[ic + 1], b.pos[ic + 2])
            bb = (b.pos[ib], b.pos[ib + 1], b.pos[ib + 2])
            ux, uy, uz = bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]
            vx, vy, vz = c_[0] - a[0], c_[1] - a[1], c_[2] - a[2]
            n = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
            na = (b.nor[ia], b.nor[ia + 1], b.nor[ia + 2])
            if n[0] * na[0] + n[1] * na[1] + n[2] * na[2] < 0:
                bad += 1
            tot += 1
    print(f"{path.name}: {len(mesh_list)} meshes, {tot} tris, flipped={bad}")
    assert bad == 0, f"{path.name} has {bad} flipped triangles"


def P(mat_name_holder):
    b = Part()
    return b


# ============================== models ==============================

def build_chair():
    fabric = (0.07, 0.16, 0.35, 1.0)
    steel = (0.55, 0.58, 0.62, 1.0)
    parts = []
    b = P(0)
    m = b.material("fabric", base=fabric, roughness=0.85)
    b.box(m, 0, 0.45, 0, 0.50, 0.09, 0.55, name="Seat")
    parts.append((b, m, "Seat"))
    b = P(0)
    m = b.material("fabric", base=fabric, roughness=0.85)
    b.box(m, 0, 0.78, 0.27, 0.50, 0.60, 0.09, name="Backrest")
    parts.append((b, m, "Backrest"))
    for i, (lx, lz) in enumerate([(-0.21, -0.23), (0.21, -0.23), (-0.21, 0.23), (0.21, 0.23)]):
        b = P(0)
        m = b.material("steel", base=steel, metallic=0.9, roughness=0.3)
        b.box(m, lx, 0.225, lz, 0.06, 0.45, 0.06, name=f"Leg{i}")
        parts.append((b, m, f"Leg{i}"))
    b = P(0)
    m = b.material("steel", base=steel, metallic=0.9, roughness=0.3)
    b.box(m, 0, 0.12, 0, 0.44, 0.05, 0.46, name="UnderFrame")
    parts.append((b, m, "UnderFrame"))
    return parts


def build_security_gate():
    housing = (0.88, 0.89, 0.91, 1.0)
    dark = (0.16, 0.17, 0.19, 1.0)
    parts = []

    def pil(name, x):
        b = P(0)
        m = b.material("housing", base=housing, metallic=0.35, roughness=0.4)
        b.box(m, x, 1.175, 0, 0.28, 2.35, 1.20, name=name)
        parts.append((b, m, name))
        b = P(0)
        m2 = b.material("panel", base=dark, metallic=0.6, roughness=0.5)
        b.box(m2, x + (0.15 if x < 0 else -0.15), 1.18, 0, 0.02, 1.80, 0.90, name=name + "Panel")
        parts.append((b, m2, name + "Panel"))

    pil("PillarL", -0.62)
    pil("PillarR", 0.62)
    b = P(0)
    m = b.material("housing", base=housing, metallic=0.35, roughness=0.4)
    b.box(m, 0, 2.45, 0, 1.52, 0.28, 1.20, name="Lintel")
    parts.append((b, m, "Lintel"))
    b = P(0)
    m = b.material("led", base=(0.1, 0.8, 0.3, 1.0), emissive=(0.09, 0.65, 0.2))
    b.box(m, 0.62, 2.10, 0, 0.08, 0.08, 1.22, name="LedStrip")
    parts.append((b, m, "LedStrip"))
    return parts


def build_fids_board():
    cab = (0.10, 0.11, 0.13, 1.0)
    blank = (0.02, 0.04, 0.08, 1.0)
    parts = []
    b = P(0)
    m = b.material("cabinet", base=cab, metallic=0.7, roughness=0.45)
    b.box(m, 0, 0, 0, 5.60, 2.40, 0.35, name="Cabinet")
    parts.append((b, m, "Cabinet"))
    for side, z in (("Front", 0.18), ("Back", -0.18)):
        b = P(0)
        m = b.material("screen", base=blank, metallic=0.1, roughness=0.35)
        b.box(m, 0, 0, z, 5.40, 2.20, 0.02, name=f"Screen{side}")
        parts.append((b, m, f"Screen{side}"))
    return parts


def build_aircraft():
    white = (0.93, 0.94, 0.96, 1.0)
    blue = (0.08, 0.25, 0.65, 1.0)
    dark = (0.05, 0.06, 0.08, 1.0)
    glassm = (0.03, 0.07, 0.12, 1.0)
    winlit = (0.75, 0.85, 0.95, 1.0)
    tire = (0.09, 0.09, 0.10, 1.0)
    parts = []

    def add(builder_fn, mat_spec, name, *a, **k):
        b = P(0)
        m = b.material(mat_spec[0], **mat_spec[1])
        getattr(b, builder_fn)(m, *a, name=name, **k)
        parts.append((b, m, name))

    F = [("fuselage", {"base": white, "metallic": 0.25, "roughness": 0.25})]
    add("cyl", ("fuselage", {"base": white, "metallic": 0.25, "roughness": 0.25}),
        "Fuselage", 0, 2.85, 0, 1.95, 1.95, 30.0, 36, "x")
    add("sphere", ("fuselage", {"base": white, "metallic": 0.25, "roughness": 0.25}),
        "Nose", 15.0, 2.80, 0, 1.95, 1.35, 1.02, 1.02)
    add("cyl", ("fuselage", {"base": white, "metallic": 0.25, "roughness": 0.25}),
        "Tailcone", -18.5, 3.45, 0, 0.35, 1.80, 7.8, 28, "x")
    # wings (swept via ry)
    for s, nm in ((1, "WingR"), (-1, "WingL")):
        add("box", ("wing", {"base": white, "metallic": 0.45, "roughness": 0.35}),
            nm + "In", 0.8, 2.30, s * 4.5, 6.0, 0.35, 8.0, ry=-s * 0.14)
        add("box", ("wing", {"base": white, "metallic": 0.45, "roughness": 0.35}),
            nm + "Out", -0.8, 2.45, s * 12.6, 4.0, 0.28, 8.6, ry=-s * 0.14)
        add("box", ("wing", {"base": blue, "metallic": 0.4, "roughness": 0.4}),
            nm + "let", -2.4, 3.60, s * 17.2, 1.6, 2.4, 0.15)
    # H-stabilizers + fin
    for s, nm in ((1, "HStabR"), (-1, "HStabL")):
        add("box", ("wing", {"base": white, "metallic": 0.45, "roughness": 0.35}),
            nm, -18.5, 3.80, s * 4.0, 3.0, 0.25, 7.0)
    add("box", ("fin", {"base": blue, "metallic": 0.4, "roughness": 0.4}),
        "Fin", -18.5, 7.60, 0, 4.5, 7.6, 0.30)
    # engines + fan discs
    for s, nm in ((1, "EngR"), (-1, "EngL")):
        add("cyl", ("engine", {"base": (0.80, 0.82, 0.85, 1.0), "metallic": 0.6, "roughness": 0.3}),
            nm, 1.5, 1.55, s * 5.4, 1.05, 1.05, 3.6, 24, "x")
        add("cyl", ("fan", {"base": dark, "metallic": 0.8, "roughness": 0.4}),
            nm + "Fan", 3.32, 1.55, s * 5.4, 0.88, 0.88, 0.12, 24, "x")
    # cockpit glazing + window bands + cheatline
    add("box", ("glass", {"base": glassm, "metallic": 0.9, "roughness": 0.08}),
        "Cockpit", 15.35, 3.55, 0, 1.30, 0.65, 2.60)
    for s, nm in ((1, "WinR"), (-1, "WinL")):
        add("box", ("winlit", {"base": winlit, "roughness": 0.3,
                               "emissive": (0.35, 0.42, 0.48)}),
            nm, 2.0, 3.30, s * 1.94, 24.0, 0.35, 0.04)
        add("box", ("livery", {"base": blue, "metallic": 0.3, "roughness": 0.4}),
            "Cheat" + nm, 0.0, 2.55, s * 1.96, 30.0, 0.50, 0.03)
    # gears
    add("cyl", ("gear", {"base": (0.6, 0.62, 0.65, 1.0), "metallic": 0.85, "roughness": 0.35}),
        "NoseStrut", 12.2, 0.90, 0, 0.09, 0.09, 1.60, 12, "y")
    for s in (1, -1):
        add("cyl", ("tire", {"base": tire, "roughness": 0.92}),
            f"NoseWheel{s}", 12.2, 0.33, s * 0.18, 0.33, 0.33, 0.22, 16, "z")
    for s, nm in ((1, "MainR"), (-1, "MainL")):
        add("cyl", ("gear", {"base": (0.6, 0.62, 0.65, 1.0), "metallic": 0.85, "roughness": 0.35}),
            nm + "Strut", -0.5, 0.95, s * 3.2, 0.11, 0.11, 1.50, 12, "y")
        for dz in (-0.55, 0.55):
            add("cyl", ("tire", {"base": tire, "roughness": 0.92}),
                f"{nm}Wheel{dz}", -0.5, 0.42, s * 3.2 + dz, 0.42, 0.42, 0.28, 16, "z")
    return parts


def build_human():
    skin = (0.85, 0.68, 0.54, 1.0)
    cloth = (0.12, 0.24, 0.48, 1.0)
    dark = (0.12, 0.13, 0.16, 1.0)
    hair = (0.16, 0.12, 0.09, 1.0)
    parts = []

    def add(builder_fn, mat_name, mat_kw, name, *a, **k):
        b = P(0)
        m = b.material(mat_name, **mat_kw)
        getattr(b, builder_fn)(m, *a, name=name, **k)
        parts.append((b, m, name))

    for s, nm in ((-1, "L"), (1, "R")):
        add("box", "pants", {"base": dark, "roughness": 0.9}, f"Leg{nm}", s * 0.11, 0.44, 0, 0.15, 0.82, 0.17)
        add("box", "shoe", {"base": (0.08, 0.08, 0.09, 1.0), "roughness": 0.7}, f"Shoe{nm}", s * 0.11, 0.05, 0.04, 0.15, 0.10, 0.30)
        add("box", "cloth", {"base": cloth, "roughness": 0.85}, f"Arm{nm}", s * 0.28, 1.08, 0, 0.11, 0.56, 0.13)
        add("box", "skin", {"base": skin, "roughness": 0.65}, f"Hand{nm}", s * 0.28, 0.76, 0, 0.10, 0.12, 0.12)
    add("box", "cloth", {"base": cloth, "roughness": 0.85}, "Torso", 0, 1.12, 0, 0.42, 0.60, 0.24)
    add("box", "skin", {"base": skin, "roughness": 0.65}, "Neck", 0, 1.45, 0, 0.10, 0.08, 0.10)
    add("sphere", "skin", {"base": skin, "roughness": 0.65}, "Head", 0, 1.60, 0, 0.115)
    add("sphere", "hair", {"base": hair, "roughness": 0.9}, "Hair", 0, 1.63, -0.015, 0.118, 1.0, 0.92, 1.0)
    return parts


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    models = {
        "chair.glb": build_chair(),
        "security_gate.glb": build_security_gate(),
        "fids_board.glb": build_fids_board(),
        "aircraft_a320.glb": build_aircraft(),
        "human.glb": build_human(),
    }
    for name, parts in models.items():
        merge(parts, OUT / name)


if __name__ == "__main__":
    main()
