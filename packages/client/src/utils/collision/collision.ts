import {max, min, sqrLength3, sqrt} from "../math.js";

export const testRayWithSphere = (
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    cx: number,
    cy: number,
    cz: number,
    r: number,
): number => {
    // https://www.scratchapixel.com/lessons/3d-basic-rendering/minimal-ray-tracer-rendering-simple-shapes/ray-sphere-intersection.html
    const Lx = cx - x;
    const Ly = cy - y;
    const Lz = cz - z;
    const tca = Lx * dx + Ly * dy + Lz * dz;
    const d2 = Lx * Lx + Ly * Ly + Lz * Lz - tca * tca;
    if (d2 > r * r) {
        return -1;
    }
    const thc = sqrt(r * r - d2);
    let t0 = tca - thc;
    let t1 = tca + thc;
    if (t0 > t1) {
        const tt = t1;
        t1 = t0;
        t0 = tt;
    }
    if (t0 < 0) {
        t0 = t1; // if t0 is negative, let's use t1 instead
        if (t0 < 0) return -1; // both t0 and t1 are negative
    }

    return t0;
};

// Given a ray and an aabb:
// return t at which the ray intersects the aabb.
// return -1 if there is no intersection
export const testRayWithAABB = (
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    l: number,
    t: number,
    r: number,
    b: number,
    z0: number,
    z1: number,
): number => {
    // https://gdbooks.gitbooks.io/3dcollisions/content/Chapter3/raycast_aabb.html
    const t1 = (l - x) / dx;
    const t2 = (r - x) / dx;
    const t3 = (t - y) / dy;
    const t4 = (b - y) / dy;
    const t5 = (z0 - z) / dz;
    const t6 = (z1 - z) / dz;

    const tmin = max(max(min(t1, t2), min(t3, t4)), min(t5, t6));
    const tmax = min(min(max(t1, t2), max(t3, t4)), max(t5, t6));

    // if tmax < 0, ray (line) is intersecting AABB, but whole AABB is behing us
    if (tmax < 0) {
        return -1;
    }

    // if tmin > tmax, ray doesn't intersect AABB
    if (tmin > tmax) {
        return -1;
    }

    if (tmin < 0) {
        return tmax;
    }
    return tmin;
};
