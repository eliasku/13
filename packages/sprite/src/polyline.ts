import {Vec2, vec2_dist, vec2_dot, vec2_eq, vec2_near, vec2_normalize, vec2_perp, vec2_sub} from "./vec2";

export type Polyline = Vec2[];
export type PolylineSet = Polyline[];

// Find the polyline that ends with v.

function polylineSetFindEnds(set: PolylineSet, v: Vec2): number {
    for (let i = 0; i < set.length; ++i) {
        const line = set[i];
        if (vec2_eq(line[line.length - 1], v)) return i;
    }
    return -1;
}

// Find the polyline that starts with v.
function polylineSetFindStarts(set: PolylineSet, v: Vec2): number {
    for (let i = 0; i < set.length; ++i) {
        const line = set[i];
        if (vec2_eq(line[0], v)) return i;
    }
    return -1;
}

// Push v onto the end of line.
function polylinePush(line: Polyline, v: Vec2): Polyline {
    line[line.length] = v;
    return line;
}

// Push v onto the beginning of line.
function polylineEnqueue(line: Polyline, v: Vec2): Polyline {
    line.unshift(v);
    return line;
}

// Join two cpPolylines in a polyline set together.
function polylineSetJoin(set: PolylineSet, before: number, after: number) {
    const lbefore = set[before];
    const lafter = set[after];

    // append
    lbefore.push(...lafter);

    // delete lafter
    set.splice(after, 1);
}

// Add a segment to a polyline set.
// A segment will either start a new polyline, join two others, or add to or loop an existing polyline.
export function polylineSetCollectSegment(v0: Vec2, v1: Vec2, set: PolylineSet) {
    const before = polylineSetFindEnds(set, v0);
    const after = polylineSetFindStarts(set, v1);

    if (before >= 0 && after >= 0) {
        if (before == after) {
            // loop by pushing v1 onto before
            set[before] = polylinePush(set[before], v1);
        } else {
            // join before and after
            polylineSetJoin(set, before, after);
        }
    } else if (before >= 0) {
        // push v1 onto before
        set[before] = polylinePush(set[before], v1);
    } else if (after >= 0) {
        // enqueue v0 onto after
        set[after] = polylineEnqueue(set[after], v0);
    } else {
        // create new line from v0 and v1
        set.push([v0, v1]);
    }
}

//// Path Simplification

// Returns true if the polyline starts and ends with the same vertex.
const polylineIsClosed = (line: Polyline): boolean => line.length > 1 && vec2_eq(line[0], line[line.length - 1]);

const Next = (i: number, count: number) => (i + 1) % count;

// Check if a cpPolyline is longer than a certain length
// Takes a range which can wrap around if the polyline is looped.
const polylineIsShort = (points: Vec2[], count: number, start: number, end: number, min: number): boolean => {
    let length = 0.0;
    for (let i = start; i !== end; i = Next(i, count)) {
        length += vec2_dist(points[i], points[Next(i, count)]);
        if (length > min) return false;
    }

    return true;
};

//MARK: Polyline Simplification

// TODO could speed this up by caching the normals instead of calculating each twice.
const Sharpness = (a: Vec2, b: Vec2, c: Vec2): number =>
    vec2_dot(vec2_normalize(vec2_sub(a, b)), vec2_normalize(vec2_sub(c, b)));

// Join similar adjacent line segments together. Works well for hard edged shapes.
// 'tol' is the minimum anglular difference in radians of a vertex.
export function polylineSimplifyVertexes(line: Polyline, tol: number): Polyline {
    let reduced = [{...line[0]}, {...line[1]}];

    const minSharp = -Math.cos(tol);

    for (let i = 2; i < line.length; ++i) {
        const vert = line[i];
        const sharp = Sharpness(reduced[reduced.length - 2], reduced[reduced.length - 1], vert);

        if (sharp <= minSharp) {
            reduced[reduced.length - 1] = vert;
        } else {
            reduced = polylinePush(reduced, vert);
        }
    }

    if (polylineIsClosed(line) && Sharpness(reduced[reduced.length - 2], reduced[0], reduced[1]) < minSharp) {
        reduced[0] = reduced[reduced.length - 2];
        reduced.pop();
    }

    return reduced;
}

// Recursive function used by cpPolylineSimplifyCurves().
function DouglasPeucker(
    verts: Vec2[],
    reduced: Polyline,
    length: number,
    start: number,
    end: number,
    min: number,
    tol: number,
): Polyline {
    // Early exit if the points are adjacent
    if ((end - start + length) % length < 2) return reduced;

    const a = verts[start];
    const b = verts[end];

    // Check if the length is below the threshold
    if (vec2_near(a, b, min) && polylineIsShort(verts, length, start, end, min)) return reduced;

    // Find the maximal vertex to split and recurse on
    let max = 0.0;
    let maxi = start;

    const n = vec2_normalize(vec2_perp(vec2_sub(b, a)));
    const d = vec2_dot(n, a);

    for (let i = Next(start, length); i !== end; i = Next(i, length)) {
        const dist = Math.abs(vec2_dot(n, verts[i]) - d);

        if (dist > max) {
            max = dist;
            maxi = i;
        }
    }

    if (max > tol) {
        reduced = DouglasPeucker(verts, reduced, length, start, maxi, min, tol);
        reduced = polylinePush(reduced, verts[maxi]);
        reduced = DouglasPeucker(verts, reduced, length, maxi, end, min, tol);
    }

    return reduced;
}

// Recursively reduce the vertex count on a polyline. Works best for smooth shapes.
// 'tol' is the maximum error for the reduction.
// The reduced polyline will never be farther than this distance from the original polyline.
export function polylineSimplifyCurves(line: Polyline, tol: number): Polyline {
    let reduced: Polyline = [];
    const min = tol / 2.0;
    if (polylineIsClosed(line)) {
        const [start, end] = loopIndexes(line, line.length - 1);
        reduced = polylinePush(reduced, line[start]);
        reduced = DouglasPeucker(line, reduced, line.length - 1, start, end, min, tol);
        reduced = polylinePush(reduced, line[end]);
        reduced = DouglasPeucker(line, reduced, line.length - 1, end, start, min, tol);
        reduced = polylinePush(reduced, line[start]);
    } else {
        reduced = polylinePush(reduced, line[0]);
        reduced = DouglasPeucker(line, reduced, line.length, 0, line.length - 1, min, tol);
        reduced = polylinePush(reduced, line[line.length - 1]);
    }
    return reduced;
}

//MARK: Quick Hull

function loopIndexes(verts: Vec2[], count: number): [number, number] {
    let start = 0;
    let end = 0;
    let min = verts[0];
    let max = min;

    for (let i = 1; i < count; i++) {
        const v = verts[i];

        if (v.x < min.x || (v.x == min.x && v.y < min.y)) {
            min = v;
            start = i;
        } else if (v.x > max.x || (v.x == max.x && v.y > max.y)) {
            max = v;
            end = i;
        }
    }
    return [start, end];
}
