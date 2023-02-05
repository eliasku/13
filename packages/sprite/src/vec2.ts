export interface Vec2 {
    x: number;
    y: number;
}

const eps = 1e-5;
// export const vec2_eq = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
export const vec2_eq = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
export const vec2_dist = (a: Vec2, b: Vec2) => Math.sqrt(vec2_distSq(a, b));
export const vec2_dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export const vec2_distSq = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const vec2 = (x: number, y: number) => ({x, y});
/// Returns true if the distance between v1 and v2 is less than dist.
export const vec2_near = (v1: Vec2, v2: Vec2, dist: number) => vec2_distSq(v1, v2) < dist * dist;
export const vec2_sub = (a: Vec2, b: Vec2) => ({x: a.x - b.x, y: a.y - b.y});
export const vec2_normalize = (a: Vec2) => {
    const f = 1.0 / (Math.sqrt(a.x * a.x + a.y * a.y) + eps);
    return {
        x: a.x * f,
        y: a.y * f,
    };
};
/// Returns a perpendicular vector. (90 degree rotation)
export const vec2_perp = (v: Vec2): Vec2 => ({
    x: -v.y,
    y: v.x,
});
